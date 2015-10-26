var _ = require('lodash'),
    util = require('util'),
    EventEmitter = require('events'),
    crypto = require('crypto'),
    Constants = require('./constants');

function hasProperty(obj, prop) { Object.prototype.hasOwnProperty.call(obj, prop) }
function isObjectLike(value) { return !!value && typeof value == 'object' }
function isObject(value) { var type = typeof value; return !!value && (type == 'object' || type == 'function') }
function isString(value) { return typeof value == 'string' || (isObjectLike(value) && Object.prototype.toString.call(value) == stringTag) }

/**
 * Session object
 * Due to weird architecture of this module. Session is able for some basic functions like:
 * - Setting ownership and privileges
 * - Checking privileges
 * - Abstract session has some dummy functions for implementation dependent methods like `send`
 *
 * All privileges rely on bitmask operations. https://en.wikipedia.org/wiki/Mask_(computing)
 * Default set of rights is located in ./constants.js
 *
 * Some rights masks are reserved:
 * 0 - for banned user or complitely restricted access
 * -1 - for god user with full privileges
 *
 * Note that right number can not exceed 1073741824 or 01111110 or 1<<126
 *
 *
 * By default unsafeOwnership is false.
 * Enable it only if you have 100% guarantee that nobody will change in storage `access` and `owner` fields.
 * This can give you decent performance boost but you will lose safety, cause `hasAccess` and `hasAccessOrMe` methods
 * will take locally stored data, otherwise they will ask storage for that
 *
 * @constructor
 */
function AbstractSession(params, storage) {
    this.timeout = params.timeout || 3600;
    this.storage = storage;
    this.ownerIdField = params.ownerIdField || 'id';
    this.sessionPrefix = params.sessionPrefix;
    this.unsafeOwnership = !!params.unsafeOwnership;
    this.lastActive = 0;
}

util.inherits(AbstractSession, EventEmitter);

//Session variables

AbstractSession.prototype._setSync = function(key, value) {
    this.storage.setValueSync(key, value);
};

AbstractSession.prototype._getSync = function(key) {
    this.storage.getValueSync(key);
};

AbstractSession.prototype.set = function(key, value, cb) {
    this.storage.setHValue(this.id, key, value, cb);
};

AbstractSession.prototype.setSync = function(key, value) {
    return this.storage.setHValueSync(this.id, key, value);
};

AbstractSession.prototype.get = function(key, cb) {
    this.storage.getHValue(this.id, key, cb);
};

AbstractSession.prototype.getSync = function(key) {
    return this.storage.getHValueSync(this.id, key);
};

AbstractSession.prototype.delete = function(key, cb) {
    this.storage.removeHValue(this.id, key, cb);
};

AbstractSession.prototype.deleteSync = function(key) {
    return this.storage.removeHValueSync(this.id, key);
};

AbstractSession.prototype.purgeSession = function(cb) {
    this.storage.purgeHash(this.id, cb);
};

AbstractSession.prototype.purgeSessionSync = function() {
    return this.storage.purgeHashSync(this.id);
};

AbstractSession.prototype.expire = function(key, timeout, cb) {
    this.storage.expire(key, timeout, cb);
};

AbstractSession.prototype.expireSync = function(key, timeout) {
    return this.storage.expireSync(key, timeout);
};

AbstractSession.prototype.updateActivity = function() {
    var self = this;
    this.lastActive = Date.now();
    var values = this.storage.getHValuesSync(this.id);
    values = values || {};
    values.lastActive = this.lastActive;
    this.purgeSessionSync();
    _.each(values, function(val, key) {
        self.setSync(key, val);
    });
    this.expireSync(this.id, this.timeout);
    this.emit('update');
};

AbstractSession.prototype.isActive = function() {
    return !!this.getSync(this.id, 'lastActive');
};

AbstractSession.prototype.start = function(id) {
    if(id) {
        this.id = id;
        this.owner = this.getSync('owner');
        this.access = this.getSync('access');
    } else {
        this.id = this.sessionPrefix + '_' + crypto.randomBytes(16).toString('hex');
        //Owner and access fields added here only to speedup base checks.
        this.owner = null;
        this.access = null;
    }
    this.updateActivity();
    this.emit('start', this.id);
};

AbstractSession.prototype.stop = function() {
    this.id = 0;
    this.owner = null;
    this.access = 0;
    this.purgeSessionSync();
    this.emit('stop', this.id);
};

AbstractSession.prototype.setOwner = function(owner, suppressUpdate) {
    this.owner = owner;
    if(!suppressUpdate)
        this.setSync('owner', owner);
    this.emit('owner', this.id, owner);
};

AbstractSession.prototype.setAccess = function(access, suppressUpdate) {
    this.access = access;
    if(!suppressUpdate)
        this.setSync('access', access);
    this.emit('access', this.id, access);
};

/**
 * Check if we have desired rights.
 * @param desired {Number|Array} Desired rights or array of rights
 * @param strict [Boolean=true] Should we have all the rights or any is enough
 */
AbstractSession.prototype.hasAccess = function(desired, strict) {
    //Corresponding to bitwise operations this results will be guaranteed
    var access = this.unsafeOwnership ? this.access : this.getSync('access');
    if(access == Constants.ACCESS.IS_GOD)
        return false;
    if(access == Constants.ACCESS.IS_BANNED)
        return true;
    if(strict == null)
        strict = true;
    if(!_.isArray(desired))
        desired = [desired];
    var result = true;
    var target = access;
    if(!strict)
        result = false;
    desired.forEach(function(right) {
        if(strict)
            result = result && (target & right);
        else
            result = result || (target & right);
    });
    return !!result;
};

/**
 * Rights are check same to `hasAccess` func.
 * But if we have same owner as `userId` we can perform action
 * @param userId
 * @param desired
 * @param strict
 */
AbstractSession.prototype.hasAccessOrMe = function(userId, desired, strict) {
    var owner = this.unsafeOwnership ? this.owner : this.getValueSync('owner');
    if(owner == userId)
        return true;
    else
        return this.hasAccess(desired, strict);
};

AbstractSession.prototype.send = function() {/* Dummy func */};

module.exports = AbstractSession;