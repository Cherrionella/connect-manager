require('./rpcError');

var _ = require('lodash'),
    async = require('async'),
    Statistics = require('./statistics'),
    Session = require('./session'),
    Message = require('./message').Message,
    util = require('util'),
    EventEmitter = require('events'),
    EventBus = require('../events/bus');

var SessionManager = function() {
    var self = this;

    EventBus.on('Session:setOwner', function(sessionId, owner) {
        self.mapOwner[owner] = sessionId;
    });

    EventBus.on('Session:setAccess', function(sessionId, access) {
        if(!self.mapAccess[access])
            self.mapAccess[access] = [];
        self.mapAccess[access].push(sessionId);
    });
};

util.inherits(SessionManager, EventEmitter);

SessionManager.prototype = {
    constructor: SessionManager,
    statistics: new Statistics(),
    sessions: {},
    /**
     * Mapping session by owner for ease of use broadcasting methods
     * @type {Object}
     */
    mapOwner: {},
    /**
     * Mapping session by rights for easy of use broadcasting methods
     * @type {Object}
     */
    mapAccess: {},
    /**
     * Method handlers. `*` represents common handler. All handlers are run in defined order
     * You can define more than one handler on method
     * If one of handlers returns `err=true`, methods execution stops
     * @TODO: Implement onConnect and onTerminate
     */
    handlers: {
        '*': []
    },
    use: function(func) {
        this.addMethodHandler('*', func);
        return this;
    },
    addMethodHandler: function(name, func) {
        if(_.isFunction(func) && name) {
            if(name.length > 0) {
                if (!this.handlers[name])
                    this.handlers[name] = [];
                this.handlers[name].push(func);
            }
        }
        return this;
    },
    runMethodHandlers: function(name, session, message, callback) {
        if(!_.isFunction(callback))
            callback = _.noop;
        async.detectSeries(this.handlers[name], function (handler, cb) {
            handler.call(null, session, message, cb);
        }, function (result) {
            callback(result);
        });
    },
    startSession: function(connection) {
        var self = this;
        this.statistics.connection();
        var session = new Session();
        session.setConnection(connection);
        session.start();
        this.sessions[session.id] = session;

        connection.on("text", function (str) {
            self.statistics.packetIn();
            try {
                var msg = Message(str);
                if (msg.method !== '*') {
                    self.processMessage(session, msg);
                }
            } catch (e) {
                console.error(e + '\t\t' + str);
            }
        });

        connection.on("close", function (code, reason) {
            self.stopSession(session);
        });

        connection.on("error", function() {
            self.statistics.connectionError();
            self.stopSession(session);
        });

    },
    stopSession: function(session) {
        if(this.mapOwner[session.owner])
            this.mapOwner[session.owner] = null;
        if(this.mapAccess[session.access]) {
            this.mapAccess[session.access].splice(this.mapAccess[session.access].indexOf(session.id), 1);
        }
        this.sessions[session.id] = null;
    },
    processMessage: function(session, message) {
        var self = this;

        async.series([
            function CommonHandlers(cb) {
                self.runMethodHandlers('*', session, message, function(result) {
                    cb(result);
                });
            },
            function MethodHandlers(cb) {
                if(self.handlers[message.method]) {
                    self.runMethodHandlers(message.method, session, message, function (result) {
                        cb(result);
                    });
                } else {
                    message.error = Error.prototype.createRpcError('METHOD_NOT_FOUND');
                    cb(true);
                }
            }
        ], function(err) {
            if(!message.suppressSend)
                session.send(message);
        });
    },
    broadcast: function(message) {
        _.each(this.sessions, function(session) {
            session.send(message);
        });
    },
    broadcastByUser: function(userId, message) {
        if(this.mapOwner[userId]) {
            this.sessions[this.mapOwner[userId]].send(message);
        }
    },
    broadcastByGroup: function(access, message) {
        var self = this;
        if(this.mapAccess[access]) {
            this.mapAccess[access].forEach(function(sessionId) {
                self.sessions[sessionId].send(message);
            });
        }
    }
};

module.exports = SessionManager;