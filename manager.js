var _ = require('lodash'),
    deasync = require('deasync'),
    Constants = require('./constants'),
    Message = require('./message'),
    util = require('util'),
    EventEmitter = require('events');

function ConnectManager(sessionPrototype, Storage, defaultSessionParams) {
    this.sessions = {};
    this._storage = Storage;
    this._sessionParams = defaultSessionParams;
    this._sessionPrototype = sessionPrototype;
}

util.inherits(ConnectManager, EventEmitter);

ConnectManager.prototype.handlers = [];

ConnectManager.prototype.use = function(func) {
    this.addMethodHandler('*', func);
    return this;
};

ConnectManager.prototype.useAfter = function(func) {
    this.addMethodHandler('**', func);
    return this;
};

ConnectManager.prototype.addMethodHandler = function(name, func) {
    if(_.isFunction(func) && name) {
        if(name.length > 0) {
            if (!this.handlers[name])
                this.handlers[name] = [];
            this.handlers[name].push(deasync(func));
        }
    }
    return this;
};

/**
 * Returns false if failed, true is success
 * @param name
 * @param session
 * @param message
 */
ConnectManager.prototype.runMethodHandlers = function(name, session, message) {
    var res = true;
    var self = this;
    return this.handlers[name].some(function(handler) {
        res = handler.call(null, self.sessions[session], message);
        return !(res === false);
    });
};

ConnectManager.prototype.processMessage = function(message, session) {
    var res = this.runMethodHandlers('*', session, message);
    try {
        if (res) {
            if (this.handlers[message.method]) {
                res = this.runMethodHandlers(message.method, session, message);
                if (!res) {
                    //useAfter handlers
                    this.runMethodHandlers('**', session, message);
                }
            } else {
                message.error = Constants.ERROR.METHOD_NOT_FOUND;
            }
        }
    } catch (e) {
        message.error = e;
    }
    if(!message.isSuppressed)
        this.sessions[session].send(message);
};

ConnectManager.prototype.startSession = function(id, params) {
    var self = this;
    params = params || {};
    id = id || 0;
    if(this.sessions[id]) {
        if(this.sessions[id].isActive()) {
            this.sessions[id].updateActivity();
            return id;
        } else {
            this.sessions[id].stop();
            this.sessions[id] = null;
        }
    }
    var session = new this._sessionPrototype(_.extend(params, this._sessionParams), this._storage);
    session.on('stop', function (id) {
        self.sessions[id] = null;
    });
    session.start(id);
    this.sessions[session.id] = session;
    this.emit('start', session.id);
    return session.id;
};

ConnectManager.prototype.broadcast = function(msg) {
    msg = Message(msg);
    _.each(this.sessions, function(session) {
        session.send(msg);
    });
};

ConnectManager.prototype.broadcastByOwner = function(owner, msg) {
    msg = Message(msg);
    _.each(this.sessions, function(session) {
        if(session.getValueSync('owner')[session.ownerIdField] == owner) {
            session.send(msg);
        }
    });
};

ConnectManager.prototype.broadcastByAccess = function(access, msg) {
    msg = Message(msg);
    _.each(this.sessions, function(session) {
        if(session.hasAccess(access)) {
            session.send(msg);
        }
    });
};

module.exports = ConnectManager;