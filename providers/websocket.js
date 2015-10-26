var Session = require('../session'),
    Message = require('../message');

function WebsocketSession(params, storage) {
    Session.call(this, params, storage);
    this.connection = params.connection;

    var self = this;
    this.connection.on("close", function (code, reason) {
        self.stop();
    });

    this.connection.on("error", function() {
        self.stop();
    });
}

WebsocketSession.prototype = Object.create(Session.prototype);
WebsocketSession.prototype.constructor = WebsocketSession;
WebsocketSession.prototype.send = function(msg) {
    msg = Message(msg);
    this.connection.sendText(msg.toString());
};