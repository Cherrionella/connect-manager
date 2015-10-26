var util = require('util'),
    EventEmitter = require('events'),
    crypto = require('crypto'),
    _ = require('lodash');


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
 * @constructor
 */
function AbstractSession(params, storage) {
    this.timeout = params.timeout || 3600;
    this.storage = storage;
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

AbstractSession.prototype.updateActivity = function() {
    this.lastActive = Date.now();
    this._setSync(this.id + '_timeout', this.lastActive);
    this.exipreSync(this.id + '_timeout', this.timeout);
    this.emit('update');
};

AbstractSession.prototype.isActive = function() {
    return !!this._getSync(this.id + '_timeout');
};

AbstractSession.prototype.start = function(id) {
    this.id = id || crypto.randomBytes(16).toString('hex');
    //Owner and access fields added here only to speedup base checks
    this.owner = null;
    this.access = null;
    this.emit('start', this.id);
};

AbstractSession.prototype.stop = function() {
    this.id = 0;
    this.owner = null;
    this.access = 0;
    this.purgeSessionSync();
    this.emit('stop', this.id);
};

AbstractSession.prototype.setOwner = function(owner) {
    this.owner = owner;
    this.setSync('owner', owner);
    this.emit('owner', this.id, owner);
};

AbstractSession.prototype.setAccess = function(access) {
    this.access = access;
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
    if(this.access == 0)
        return false;
    if(this.access == -1)
        return true;
    if(strict == null)
        strict = true;
    if(!_.isArray(desired))
        desired = [desired];
    var result = true;
    var target = this.access;
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
    if(this.owner == userId)
        return true;
    else
        return this.hasAccess(desired, strict);
};

AbstractSession.prototype.send = function() {/* Dummy func */};

module.exports = AbstractSession;