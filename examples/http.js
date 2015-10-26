var Session = require('../session'),
    Storage = require('session-storage').create('redis'),
    ConnectManager = require('../manager'),
    Message = require('../message'),
    crypto = require('crypto'),
    http = require('http'),
    url = require('url'),
    _ = require('lodash');

function HTTPSession(params, storage) {
    Session.call(this, params, storage);
}

HTTPSession.prototype = Object.create(Session.prototype);
HTTPSession.prototype.constructor = HTTPSession;

HTTPSession.prototype.response = null;
HTTPSession.prototype.request = null;

HTTPSession.prototype.send = function(message) {
    this.response.statusCode = message.result.status || message.error.code;
    var length = message.result.size || (message.result.data) ? message.result.data.length : message.error.message.length;
    var headers = {
        'Content-Length': length,
        'Content-Type': message.result.type || 'text/html',
        'Cache-Control': 'no-cache',
        'Date': new Date(),
        'Server': 'test'
    };

    console.log(this.response.statusCode);

    if(message.result.cookies) {
        var exdate = new Date();
        exdate.setDate(exdate.getDate() + 30);
        var cookieStr = '';
        _.each(message.result.cookies, function(val, cookie) {
            cookieStr += cookie + '=' + val.value + ';expires=' + exdate.toUTCString() + ';domain='+ val.domain +';path=/;'
        });
        if(cookieStr.length > 0)
            headers['Set-Cookie'] = cookieStr;
    }

    this.response.writeHead(this.response.statusCode, headers);
    this.response.end(message.result.data || message.error.message);
};

function parseCookies(request) {
    var list = {},
        rc = request.headers.cookie;

    rc && rc.split(';').forEach(function( cookie ) {
        var parts = cookie.split('=');
        list[parts.shift().trim()] = decodeURI(parts.join('='));
    });

    return list;
}

var Manager = new ConnectManager(HTTPSession, Storage, {
    sessionPrefix: 'http',
    timeout: 2
});

Manager.use(function(session, message, next) {
    console.log(message.method);
    console.log('Session id: ' + session.id);
    var owner = session.getSync('owner');
    if(owner)
        console.log('User ' + owner.name + ' connected!');
    else {
        console.log('New user connected');
        session.setOwner({id: Math.round(Math.random() * 100000), name: 'Roodie ' + crypto.randomBytes(4).toString('hex')});
        message.result.cookies = {
            sess_id: {
                value: session.id,
                domain: session.request.headers.host.split(':')[0]
            }
        }
    }
    next(null, true);
}).addMethodHandler('GET /', function(session, message, next) {
    message.result.status = 200;
    message.result.data = 'Hi from connect-manager. Your name is <b>' + session.getSync('owner').name + '</b>';
    next(null, true);
}).addMethodHandler('GET /404', function(session, message, next) {
    message.result.status = 404;
    message.result.data = 'Not found';
    next(null, false);
}).addMethodHandler('GET /time', function(session, message, next) {
    message.result.status = 200;
    message.result.data = Date.now() + '';
    next(null, true);
});

var reqCount = 0;

var server = http.createServer(function(req, res) {
    var uri = url.parse(req.url);
    var cookies = parseCookies(req);
    var msg = Message(reqCount++, req.method.toUpperCase() + ' ' + uri.pathname, {cookies: cookies, uri: uri});
    var id = cookies['sess_id'] || null;
    id = Manager.startSession(id);
    Manager.sessions[id].request = req;
    Manager.sessions[id].response = res;
    Manager.processMessage(msg, id);
});

server.on('connection', function(socket) {
    socket.setNoDelay();
});

server.listen(80, function() {
    console.log('connect-manager listening on 3000');
});

