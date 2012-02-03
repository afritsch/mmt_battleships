// socket for listening for udp pakets that are being sent from any sockets locally or on another computer


var dgram = require('dgram');

var server = dgram.createSocket('udp4');

server.on('message', function (msg, rinfo) {
  console.log('server got: ' + msg + ' from ' +
    rinfo.address + ':' + rinfo.port);
});

// when getting udp paket this method is called
server.on('listening', function () {
  var address = server.address();
  console.log('server listening ' +
      address.address + ':' + address.port);
});

// socket port
server.bind(1234);
