var _ = require('lodash');

var hasProperty = function(obj, prop) { Object.hasOwnProperty.call(obj, prop) };

/**
 * JSON-RPC message instance
 * @param id
 * @param method
 * @param params
 * @param result
 * @param error
 * @param isClient
 * @class
 * @constructor
 */
function MessageObject(id, method, params, result, error, isClient) {
    this.id = id || 0;
    this.method = method || '';
    this.isClient = !!isClient;
    this.params = params || {};
    this.result = result || {};
    this.error = error || null;
}

MessageObject.prototype = {
    constructor: MessageObject,
    /**
     * Message id
     * @type {Number}
     */
    id: 0,
    /**
     * Method name
     * @type {String}
     */
    method: '',
    /**
     * Indicates that this message was sent c->s
     */
    isClient: false,
    /**
     * Message params
     * @type {Object}
     */
    params: {},
    /**
     * Result field
     * @type {Object}
     */
    result: {},
    /**
     * Error object
     * @type {null|Object}
     */
    error: null,

    suppressSend: false,
    suppress: function() {
        this.suppressSend = true;
    },
    setError: function(error, message) {
        if(_.isObject(error)) {
            this.error = error;
        } else {
            this.error = {
                code: -1,
                message: "Unknown Error"
            };
        }
        if(message) {
            this.error.message = message;
        }
    },
    /**
     * Fill data fields from JSON-RPC object
     * @param msgObj {Object} JSON-RPC object
     */
    fromObject: function(msgObj) {
        msgObj = msgObj || {};
        if(!(msgObj.method || !msgObj.id))
            throw new Error('Invalid JSON-RPC Object');
        this.id = msgObj.id || 0;
        this.method = msgObj.method || '';
        this.isClient = false;
        this.params = msgObj.params || {};
        this.result = msgObj.result || {};
        this.error = msgObj.error || null;
        return this;
    },
    fromString: function(str) {
        var msg = JSON.parse(str);
        if(!(hasProperty(msg, 'method') || !hasProperty(msg, 'id')))
            throw new Error('Invalid Message Object');
        return this.fromObject(msg);
    },
    /**
     * Converts Message object to JSON-RPC object
     * @return {{}}
     */
    toJSON: function() {
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
    },
    /**
     * Overrides Object.prototype.toString()
     * Converts Message object to string
     * @return {String}
     */
    toString: function() {
        return JSON.stringify(this.toJSON());
    }
};

/**
 *
 * @param arg
 * @returns {MessageObject}
 */
function Message(arg) {
    var msg = new MessageObject();
    if(_.isString(arg))
        return msg.fromString(arg);
    else if (_.isObject)
        return msg.fromObject(arg);
    else
        throw new Error('Invalid Message Object');
}

module.exports = {
    Message: Message,
    MessageObject: MessageObject
};
