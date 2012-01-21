// this socket is for sending udp pakets to any socket that is created locally or on another computer


var dgram = require('dgram');

var message = new Buffer("mmtships:{Weihnachtsmann}");

var client = dgram.createSocket("udp4");

// localhost must not be changed when testing local otherwise udp paket won't reach target socket

client.send(message, 0, message.length, 1234, "78.104.171.255", function(err, bytes) {
  client.close();
});
