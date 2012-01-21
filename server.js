/*http server + websockets*/

// Array methods added for later use
Array.prototype.
	eraseEmptyElements = function (){
		
		for(var i=0; i < this.length;i++){
			if(!this[i]){
				this.splice(i,1);
				i--;
			}
		}
		
		return this;
	}
Array.prototype.
		findPlayerIP = function(playername){
		
		for(var i=0; i < this.length;i++)
			if(playername == this[i].playername)
				return this[i].playerIP;
		
		return false;
	}
	
	
// vars set
var app = require('http').createServer(handler)
  , io = require('socket.io').listen(app)
  , fs = require('fs')
  , players = []
  , dgram = require('dgram')
  , connectionQuerySent = false
  , myPlayername = "Babsi"
	, lastReceivingPlayer = ""
  , deniedMsg = false
  , showInfo = true
  , id = 0
  , lastId = 0
  , status = "waiting"
  , stopSendAliveMsg = false
  , timeout = 20000
  , chosenPlayer = "";
  
  
app.listen(3001);

// the server itself just renders client.html and nothing else
function handler (req, res) {

  fs.readFile(__dirname + '/battleships/index.html', function (err, data) {
    
    if (err) {
      res.writeHead(500);
      return res.end('Error loading index.html');
    }

    res.writeHead(200);
    res.end(data);
  });

}



// method that is called when socket in client.html is created

io.sockets.on('connection', function (socket) {
	
  console.log("is Connected");
  

  if(!connectionQuerySent){ // when socket is created a udp paket is being sent -> mmtships:{Playername} 
    
    sendConnectionQuery(); // our query to get attraction and listed -> mmtships:{PlayerName}
    createMessageSocket(socket); // socket for getting messages
    connectionQuerySent = true;
    
  }
  
 
  
  // socket to communicate between html client and server
  // this method is always called when socket in client.html calls emit method
  // emit method is used by the server too to communicate with socket in client.html
  socket.on('myGameSocket', function (data) {
  
    var playerIP = players.findPlayerIP( parseMsg(data)[0] );
    // socket to send messages to all registered players
    var client = dgram.createSocket("udp4");
    var message;
    

    if( parseMsg(data)[1] == "startgame" ){ // start game with foreign player 
        message = new Buffer("mmtships:"+myPlayername+":startgame"); // 
        chosenPlayer = parseMsg(data)[0]; // save temporarily playername to play with
        sendPlayingMsg(playerIP, "startgame", true);
    }
    else if( parseMsg(data)[1] == "accepted" || parseMsg(data)[1] == "declined" ){ // start game with foreign player 
        message = new Buffer("mmtships:"+parseMsg(data)[1]); 
        
        var c = dgram.createSocket("udp4");

        c.send(message, 0, message.length, 1234, playerIP, function(err, bytes) {
          c.close();
        });
        
      if(parseMsg(data)[1] == "accepted"){
        status = "playing";
        startConnectionTimeout();
        sendAliveMsg( playerIP );
        sendUdpMsg( playerIP, "positionsset" );
        
      }
    }
    else if( parseMsg(data)[0] == "showInfoAgain")
      showInfo = true;
    
    
    console.log("message sent: "+message+" to: "+playerIP);
    
  });
  
 
  
});


// send query to get attraction of other players
function sendConnectionQuery(){
  
  var stopSendingQuery = setInterval(function(){
  
    var m = new Buffer(String("mmtships:"+myPlayername));
    var c = dgram.createSocket("udp4");
    
    c.send(m, 0, m.length, 1234, "78.104.171.255", function(err, bytes) {
        c.close();
    });
    
    if(status == "playing")
      clearInterval(stopSendingQuery);
      
  }, 5000);
  
  
  
}

function createMessageSocket(playerSocket){

  var mSocket = dgram.createSocket("udp4");
  
  // message socket for listening 
  mSocket.on("message", function (msg, rinfo) {
      console.log("got message: " + msg + " from " + rinfo.address + ":" + rinfo.port);
   
	  var tmp_msg = parseMsg(msg); // returns array -> mmtships:{PlayerName}:{SpielerStatus} parsed 1.elem mmtships   2.elem PlayerName ...	  
	  
	  if( tmp_msg.length == 2 && !isPlayerListed(rinfo.address) && status == "waiting" && myPlayername != tmp_msg[1] ){	// waiting: we got message in this form mmtships:Playername 
	  		players.push( { playername : tmp_msg[1], playerIP : rinfo.address } ); 
	  		sendPlayerList(playerSocket); 
	  }
	  
    else if( tmp_msg[2] == "startgame" && status == "waiting" && showInfo ){// waiting: we got message in this form mmtships:Playname:startgame
		  	if(!isPlayerListed)
          players.push( { playername: tmp_msg[1], playerIP: rinfo.address } );
          
        sendMePlayRequest(playerSocket, tmp_msg[1]);
        showInfo = false;
	  }
	  // waiting or playing: we are sending a message in this form mmtships:shipNeutrilaizers:status
	  else if( lastReceivingPlayer != rinfo.adress && tmp_msg[2] != "startgame"  &&  myPlayername != tmp_msg[1] ){
	  		sendPlayingMsg( rinfo.address, status); 
				lastReceivingPlayer = rinfo.adress;
	  }
    
    // in playing mode: check messages from right player
    if( rinfo.address != players.findPlayerIP( chosenPlayer ) )
      return;
    
    
    if( tmp_msg[1] == "alive" && status == "playing" ){ // playing: we got a message in this form mmtships:alive
			timeout = 20000;
	  }
    
    // playing: we got a message in this form mmtships:accecpted or mmtships:declined
    else if( (tmp_msg[1] == "accepted" || tmp_msg[1] == "declined") && status == "waiting" ){
      
      if(tmp_msg[1] == "accepted"){
        status = "playing";
        startConnectionTimeout();
        sendAliveMsg( players.findPlayerIP( chosenPlayer ) );
        sendUdpMsg( players.findPlayerIP( chosenPlayer ), "positionsset" );
        
      }
      
      deniedMsg = true;
      
      
    }
    
    // playing: we got a message in this form mmtships:positionsset:id
    else if( tmp_msg[1] == "positionsset" && status == "playing" ){
      
      
    }
    
    // playing: we got a message in this form mmtships:shot:x:y:id
    else if ( tmp_msg[1] == "shot" && status == "playing" ){
   
        playerSocket.emit('playerSocket', "shot,"+tmp_msg[2]+","+tmp_msg[3]); 
    }
    
    // playing: we got a message in this form mmtships:hit:id
    else if( tmp_msg[1] == "hit" && status == "playing" ){
    
    }
    // playing: we got a message in this form mmtships:miss:id
    else if( tmp_msg[1] == "miss" && status == "playing" ){
    
    }
    
		
	
      
  });
  mSocket.bind(1234);
  console.log("mSocketCreated");
}


function parseMsg(m){
  	return String(m).split(/[:]/).eraseEmptyElements(); // array -> 1.elem mmtships ...
}


function sendPlayerList(s){
	
	var tmp_playernames = "PLIST:";
	
	for(var i=0; i < players.length; i++)
		tmp_playernames += players[i].playername + "#";
	
	console.log("PLIST sent: "+tmp_playernames);
	s.emit('playerSocket', tmp_playernames); 
}

function isPlayerListed(playerIP){
	
	for(var i=0; i < players.length; i++)
		if(playerIP == players[i].playerIP)
			return true;
			
	return false;
}


function sendMePlayRequest(s, playername){
	s.emit('playerSocket', String(playername+",startgame")); 
}


function sendAliveMsg(playerIP){
	
	var m = new Buffer(String("mmtships:alive"));
  	var c = dgram.createSocket("udp4");
  
  stopSendAliveMsg = setInterval(function(){
      c.send(m, 0, m.length, 1234, playerIP, function(err, bytes) {
	    c.close();
    });
    
    if( stopSendAliveMsg )
      clearInterval(stopSendAliveMsg);
      
    }, 2000);
    
	
}


function sendPlayingMsg(playerIP, connectionAnswer, recursive){
	
  
  if(recursive){
    
    var stopSendingMsg = 0;
    var interval = setInterval(function(){
      
      var m = new Buffer(String("mmtships:"+myPlayername+":"+connectionAnswer));
      var c = dgram.createSocket("udp4");
      
      if(stopSendingMsg >= 30000 || deniedMsg){
        clearInterval(interval);
        deniedMsg = false;
        return;
      }
      
      c.send(m, 0, m.length, 1234, playerIP, function(err, bytes) {
        c.close();
      });
      
      stopSendingMsg += 5000;
      
    }, 5000);
    
  }
  else{
    
    var m = new Buffer(String("mmtships:"+myPlayername+":"+connectionAnswer));
    var c = dgram.createSocket("udp4");

    c.send(m, 0, m.length, 1234, playerIP, function(err, bytes) {
      c.close();
    });
  }
  
}

function startConnectionTimeout(){
	
	if( timeout <= 0 ){
		status = "waiting";
		timeout = 20000;
		stopSendAliveMsg = true;
	}
	else{
		setTimeout(startConnectionTimeout, 1000);
		timeout -= 1000;
	}
}

function sendUdpMsg(playerIP, msg){
  
  var m = new Buffer(String("mmtships:" + msg + ":" + id));
  var c = dgram.createSocket("udp4");

  c.send(m, 0, m.length, 1234, playerIP, function(err, bytes) {
    c.close();
  });
} 

function sendStartGameResponse(playerIP, msg){
  
  var stopSendingMsg = 0;
  
  var interval = setInterval(function(){
    
    var m = new Buffer(String("mmtships:" + msg));
    var c = dgram.createSocket("udp4");

    if(stopSendingMsg >= 20000){
        clearInterval(interval);
        return;
    }
    
    c.send(m, 0, m.length, 1234, playerIP, function(err, bytes) {
      c.close();
    });
    
    stopSendingMsg += 2000;
    
  }, 2000);
  
} 

