var Constants = require('./constants');

function hasProperty(obj, prop) { Object.prototype.hasOwnProperty.call(obj, prop) }
function isObjectLike(value) { return !!value && typeof value == 'object' }
function isObject(value) { var type = typeof value; return !!value && (type == 'object' || type == 'function') }
function isString(value) { return typeof value == 'string' || (isObjectLike(value) && Object.prototype.toString.call(value) == stringTag) }


/**
 * JSON-RPC message instance
 * @class
 * @constructor
 */
function Message(id, method, params, result, error) {
    var args = Array.prototype.slice.call(arguments);
    if(this.constructor == arguments.callee) {
        args.unshift(this);
    } else {
        args.unshift(null)
    }
    var toRet = Message.prototype.init.apply(null, args);
    toRet.isSuppressed = false;
    return toRet;
}

Message.prototype.init = function() {
    var args = Array.prototype.slice.call(arguments);
    var ctx = args.shift();
    var msg = ctx || new Message();
    if(args.length !== 1) {
        msg.fromParams.apply(msg, args);
        return msg;
    } else {
        if(isString(args[0])) {
            msg.fromString.call(msg, args[0]);
        } else if (isObject(args[0])) {
            msg.fromObject.call(msg, args[0]);
        } else {
            msg.fromParams.call(msg, args[0]);
        }
        return msg;
    }
};

Message.prototype.suppress = function() {
    this.isSuppressed = true;
};

Message.prototype.setError = function(error, message) {
    if(isObject(error)) {
        this.error = error;
    } else {
        this.error = Constants.ERROR.UNKNOWN;
    }
    if(message) {
        this.error.message = message;
    }
};

Message.prototype.fromObject = function(msgObj) {
    msgObj = msgObj || {};
    if(!(msgObj.method || !msgObj.id))
        throw new Error('Invalid JSON-RPC Object');
    this.id = msgObj.id || 0;
    this.method = msgObj.method || '';
    this.params = msgObj.params || {};
    this.result = msgObj.result || {};
    this.error = msgObj.error || null;
    return this;
};

Message.prototype.fromString = function(str) {
    var msg = JSON.parse(str);
    if(!(hasProperty(msg, 'method') || !hasProperty(msg, 'id')))
        throw new Error('Invalid Message Object');
    return this.fromObject(msg);
};

Message.prototype.fromParams = function(id, method, params, result, error) {
    this.id = id || 0;
    this.method = method || '';
    this.params = params || {};
    this.result = result || {};
    this.error = error || null;
};

Message.prototype.toJSON = function() {
    var ret = {
        id: this.id,
        result: this.result
    };
    if(this.id == null) {
        ret = {
            method: this.method,
            params: this.result
        }
    }
    if(this.error) {
        ret = {
            id: this.id,
            error: {
                code: this.error.status || this.error.code,
                message: this.error.message
            }
        }
    }
    return ret;
};

Message.prototype.toString = function() {
    return JSON.stringify(this.toJSON());
};

module.exports = Message;
