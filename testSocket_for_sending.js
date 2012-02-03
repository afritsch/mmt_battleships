// this socket is for sending udp pakets to any socket that is created locally or on another computer


var dgram = require('dgram');

var message = new Buffer('mmtships:Weihnachtsmann:startgame');

var client = dgram.createSocket('udp4');

client.send(message, 0, message.length, 1234, 'localhost', function(err, bytes) {
  client.close();
});
