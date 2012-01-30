/*http server + websockets*/
// Array methods added for later use
Array.prototype.
eraseEmptyElements = function () {

  for(var i = 0; i < this.length; i++) {
    if(!this[i]) {
      this.splice(i, 1);
      i--;
    }
  }

  return this;
}
Array.prototype.
findPlayerIP = function (playername) {

  for(var i = 0; i < this.length; i++)
  if(playername == this[i].playername) return this[i].playerIP;

  return false;
}


// vars set

var app = require('http').createServer(handler)
  , io = require('socket.io').listen(app)
  , fs = require('fs')
  , players = []
  , dgram = require('dgram')
  , myPlayername = "Josef"
  , broadcastSent = false
	, lastReceivingPlayer = ""
  , nextCommand = false
  , gameStarted = false
  , gotMissedOrHit = false
  , stopSendingMissOrHit = true
  , showInfo = true
  , gotInvitation = false
  , startGameSent = false
  , id = 0
  , lastId = 0
  , status = "waiting"
  , stopSendAliveMsg = false
  , timeout = 20000
  , chosenPlayer = ""
  , broadcastAddress = "78.104.171.255"
  , sendPort = "1234"
  , receivePort = "1234";
  
app.listen(3001);


// the server itself just renders client.html and nothing else
function handler(req, res) {

  fs.readFile(__dirname + '/battleships/index.html', function (err, data) {

    if(err) {
      res.writeHead(500);
      return res.end('Error loading index.html');
    }

    res.writeHead(200);
    res.end(data);
  });

}

// method that is called when socket in client.html is created
io.sockets.on('connection', function (socket) {

  console.log('is Connected');

  if(!broadcastSent) { // when socket is created a udp paket is being sent -> mmtships:{Playername} 
    sendMessage(broadcastAddress, myPlayername, true, 99999, 5000, status, 'playing') // our query to get attraction and listed -> mmtships:{PlayerName}
    createMessageSocket(socket); // socket for getting messages
    broadcastSent = true;
  }

  // socket to communicate between html client and server
  // this method is always called when socket in client.html calls emit method
  // emit method is used by the server too to communicate with socket in client.html
  socket.on('myGameSocket', function (data) {

    var playerIP = players.findPlayerIP(parseMsg(data)[0]);
    // socket to send messages to all registered players
    var client = dgram.createSocket('udp4');
    var consoleMessage;

    if( parseMsg(data)[1] == "startgame" ){ // start game with foreign player 
        consoleMessage = new Buffer(myPlayername+":startgame"); // 
        chosenPlayer = parseMsg(data)[0]; // save temporarily playername to play with
        sendMessage(playerIP, myPlayername+":startgame", true, 30000, 2000, startGameSent, true);
    }
    else if( parseMsg(data)[1] == "accepted" || parseMsg(data)[1] == "declined" ){ // start game with foreign player 
      consoleMessage = new Buffer(parseMsg(data)[1]); 
      
      if(parseMsg(data)[1] == "accepted"){
        sendMessage(playerIP, parseMsg(data)[1], true, timeout, 2000, nextCommand, true);
        status = "playing";
				gameStarted = true;
				 console.log('status' + status );
        startGameTimeout();
        //sendMessage(playerIP, "positionsset:"+id, true, timeout, 2000, nextCommand, true);
        //id++;
        sendMessage(playerIP, "alive", true, timeout, 2000, stopSendAliveMsg, true); //sendAliveMessage
      }
      else
        sendMessage(playerIP, parseMsg(data)[1], true, 6000, 2000, false, true); // send declined
    }
    else if( parseMsg(data)[1] == "shot"){
      stopSendingMissOrHit = true;
      gotMissedOrHit = false;
      console.log("shot:" + parseMsg(data)[2] + ":" + parseMsg(data)[3]);
      sendMessage(playerIP, "shot:" + parseMsg(data)[2] + ":" + parseMsg(data)[3], true, timeout, 2000, gotMissedOrHit, true);
    }
    else if( parseMsg(data)[1] == "miss"){
      stopSendingMissOrHit = false;
      sendMessage(playerIP, "miss", true, timeout, 2000, stopSendingMissOrHit, true);
    }
    else if( parseMsg(data)[1] == "hit"){
      stopSendingMissOrHit = false;
      sendMessage(playerIP, "hit", true, timeout, 2000, stopSendingMissOrHit, true);
    }
  });
});

function createMessageSocket(playerSocket) {

  var mSocket = dgram.createSocket('udp4');

  // message socket for listening 

  mSocket.on("message", function (msg, rinfo) {
    console.log("got message: " + msg + " from " + rinfo.address + ":" + rinfo.port);
   
	  var tmp_msg = parseMsg(msg); // returns array -> mmtships:{PlayerName}:{SpielerStatus} parsed 1.elem mmtships   2.elem PlayerName ...	  
     
	  if( tmp_msg.length == 2 && !isPlayerListed(rinfo.address) && status == "waiting" && myPlayername != tmp_msg[1] && !gameStarted ){	// waiting: we got message in this form mmtships:Playername 
	  		players.push( { playername : tmp_msg[1], playerIP : rinfo.address } ); 
	  		sendPlayerList(playerSocket); 
	  }
	  
    else if( tmp_msg[2] == "startgame" && status == "waiting" && showInfo && !gameStarted ){// waiting: we got message in this form mmtships:Playname:startgame
		  	if(!isPlayerListed(rinfo.address))
          players.push( { playername: tmp_msg[1], playerIP: rinfo.address } );
        
        chosenPlayer = tmp_msg[1];
        sendMePlayRequest(playerSocket, tmp_msg[1]);
        showInfo = false;
        gotInvitation = true;
	  }
	  // waiting or playing: we are sending a message in this form mmtships:shipNeutrilaizers:status
	  else if( lastReceivingPlayer != rinfo.adress && tmp_msg[2] != "startgame"  &&  myPlayername != tmp_msg[1] ){
	  		sendMessage(rinfo.address, status, false); 
				lastReceivingPlayer = rinfo.adress;
	  }
    
    // at this point I play with other
    
    if( tmp_msg[1] == "alive" && status == "playing" && gameStarted ){ // playing: we got a message in this form mmtships:alive
			console.log (tmp_msg + ", "+ status + ","+gameStarted);
			timeout = 20000;
	  }
    
    if( tmp_msg[1] == "positionsset" && status == "playing"){
       console.log("got positionsset");
      nextCommand = true;
      
      id = Number(tmp_msg[2]) + 1;
      console.log("okyourturn: "+id+" sent");
      sendMessage(players.findPlayerIP( chosenPlayer ), "okyourturn:"+id, true, timeout, 2000, nextCommand, false);
    }

    // playing: we got a message in this form mmtships:accecpted or mmtships:declined

    else if( (tmp_msg[1] == "accepted" || tmp_msg[1] == "declined") && status == "waiting" && !gameStarted ){
    console.log("accepted or declined got");
      startGameSent = true;
      
      if(tmp_msg[1] == "accepted"){
        gotInvitation = false;
        status = 'playing';
        startGameTimeout();
        sendMessage(players.findPlayerIP(chosenPlayer), 'positionsset:' + id, true, timeout, 2000, nextCommand, true);
        sendMessage(players.findPlayerIP(chosenPlayer), 'alive', true, timeout, 2000, stopSendAliveMsg, true);
      }

      else{
        console.log("declined got");
        playerSocket.emit('playerSocket', chosenPlayer + ",declined");
        }
    }
    else if( tmp_msg[1] == "okyourturn" && status == "playing" && !gameStarted ){
      gameStarted = true;
      nextCommand = false;
      id = Number(tmp_msg[2]) + 1;
      playerSocket.emit('playerSocket', chosenPlayer + ",myturn");
    }
    
    // playing: we got a message in this form mmtships:shot:x:y:id

    else if(tmp_msg[1] == 'shot' && status == 'playing' && gameStarted ) {
      nextCommand = false;
      stopSendingMissOrHit = true;
      playerSocket.emit('playerSocket', 'shot,' + tmp_msg[2] + ',' + tmp_msg[3]);
      id = Number(tmp_msg[4]) + 1;
    }

    // playing: we got a message in this form mmtships:hit:id
    console.log("gameStarted:"+gameStarted + " !gotMissedOrHit: "+gotMissedOrHit);
    else if( tmp_msg[1] == "hit" && status == "playing" && !gameStarted && !gotMissedOrHit){
      id = Number(tmp_msg[2]) + 1;
      gotMissedOrHit = true;
      playerSocket.emit('playerSocket', 'hit');
    }
    // playing: we got a message in this form mmtships:miss:id
    else if( tmp_msg[1] == "miss" && status == "playing" && !gameStarted && !gotMissedOrHit){
      id = Number(tmp_msg[2]) + 1;
      gotMissedOrHit = true;
      playerSocket.emit('playerSocket', 'miss');
    }

  });
  mSocket.bind(receivePort);
  console.log('mSocketCreated');
}

function parseMsg(m) {
  return String(m).split(/[,:]/g).eraseEmptyElements(); // array -> 1.elem mmtships ...
}

function sendPlayerList(s) {

  var tmp_playernames = 'PLIST:';

  for(var i = 0; i < players.length; i++)
  tmp_playernames += players[i].playername + '#';

  console.log('PLIST sent: ' + tmp_playernames);
  s.emit('playerSocket', tmp_playernames);
}

function isPlayerListed(playerIP) {

  for(var i = 0; i < players.length; i++)
  if(playerIP == players[i].playerIP) return true;

  return false;
}

function sendMePlayRequest(s, playername) {
  s.emit('playerSocket', String(playername + ',startgame'));
}

function startGameTimeout(){
	if( timeout <= 0 ){
		status = "waiting";
		timeout = 20000;
		stopSendAliveMsg = true;
    gameStarted = false;
    startGameSent = false;
    id = 0;
	}
	else{
		setTimeout(startGameTimeout, 1000);
		timeout -= 1000;
	}
}

function sendMessage(IP, message, recursive, timeout, frequency, stopper, value) {

  if(recursive) {
    var stopSendingMessage = 0;
    var interval = setInterval(function () {

      var m = new Buffer(String('mmtships:' + message));
      var c = dgram.createSocket('udp4');

      if(stopSendingMessage >= timeout || stopper == value) {
        clearInterval(interval);
        nextCommand = false;
        return;
      }
      
      //console.log(m + ' ' +m.length); 
      c.send(m, 0, m.length, sendPort, IP, function (err, bytes) {
        c.close();
      });

      stopSendingMessage += frequency;
    }, frequency);
  } else {
    var m = new Buffer(String('mmtships:' + message));
    var c = dgram.createSocket('udp4');

    c.send(m, 0, m.length, sendPort, IP, function (err, bytes) {
      c.close();
    });
  }

}
