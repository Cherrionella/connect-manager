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

//SessionManager.prototype = {
//    constructor: SessionManager,
//    statistics: new Statistics(),
//    sessions: {},
//    /**
//     * Mapping session by owner for ease of use broadcasting methods
//     * @type {Object}
//     */
//    mapOwner: {},
//    /**
//     * Mapping session by rights for easy of use broadcasting methods
//     * @type {Object}
//     */
//    mapAccess: {},
//    /**
//     * Method handlers. `*` represents common handler. All handlers are run in defined order
//     * You can define more than one handler on method
//     * If one of handlers returns `err=true`, methods execution stops
//     * @TODO: Implement onConnect and onTerminate
//     */
//    handlers: {
//        '*': []
//    },
//    use: function(func) {
//        this.addMethodHandler('*', func);
//        return this;
//    },
//    addMethodHandler: function(name, func) {
//        if(_.isFunction(func) && name) {
//            if(name.length > 0) {
//                if (!this.handlers[name])
//                    this.handlers[name] = [];
//                this.handlers[name].push(func);
//            }
//        }
//        return this;
//    },
//    runMethodHandlers: function(name, session, message, callback) {
//        if(!_.isFunction(callback))
//            callback = _.noop;
//        async.detectSeries(this.handlers[name], function (handler, cb) {
//            handler.call(null, session, message, cb);
//        }, function (result) {
//            callback(result);
//        });
//    },
//    startSession: function(connection) {
//        var self = this;
//        this.statistics.connection();
//        var session = new Session();
//        session.setConnection(connection);
//        session.start();
//        this.sessions[session.id] = session;
//
//        connection.on("text", function (str) {
//            self.statistics.packetIn();
//            try {
//                var msg = Message(str);
//                if (msg.method !== '*') {
//                    self.processMessage(session, msg);
//                }
//            } catch (e) {
//                console.error(e + '\t\t' + str);
//            }
//        });
//
//        connection.on("close", function (code, reason) {
//            self.stopSession(session);
//        });
//
//        connection.on("error", function() {
//            self.statistics.connectionError();
//            self.stopSession(session);
//        });
//
//    },
//    stopSession: function(session) {
//        if(this.mapOwner[session.owner])
//            this.mapOwner[session.owner] = null;
//        if(this.mapAccess[session.access]) {
//            this.mapAccess[session.access].splice(this.mapAccess[session.access].indexOf(session.id), 1);
//        }
//        this.sessions[session.id] = null;
//    },
//    processMessage: function(session, message) {
//        var self = this;
//
//        async.series([
//            function CommonHandlers(cb) {
//                self.runMethodHandlers('*', session, message, function(result) {
//                    cb(result);
//                });
//            },
//            function MethodHandlers(cb) {
//                if(self.handlers[message.method]) {
//                    self.runMethodHandlers(message.method, session, message, function (result) {
//                        cb(result);
//                    });
//                } else {
//                    message.error = Error.prototype.createRpcError('METHOD_NOT_FOUND');
//                    cb(true);
//                }
//            }
//        ], function(err) {
//            if(!message.suppressSend)
//                session.send(message);
//        });
//    },
//    broadcast: function(message) {
//        _.each(this.sessions, function(session) {
//            session.send(message);
//        });
//    },
//    broadcastByUser: function(userId, message) {
//        if(this.mapOwner[userId]) {
//            this.sessions[this.mapOwner[userId]].send(message);
//        }
//    },
//    broadcastByGroup: function(access, message) {
//        var self = this;
//        if(this.mapAccess[access]) {
//            this.mapAccess[access].forEach(function(sessionId) {
//                self.sessions[sessionId].send(message);
//            });
//        }
//    }
//};

module.exports = ConnectManager;