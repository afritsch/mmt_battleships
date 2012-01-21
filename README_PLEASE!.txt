WHEN YOU WANT TO TEST EVERTHING:

1. install npm and node (just visit webside and follow the steps)

2. start server.js by entering (node server.js) in your shell

3. open localhost:3001 in your browser (you are advised to use firefox)

4. send an udp paket by entering (node testSocjet_for_sending.js) in your shell

5. when you have done the steps you should see a name and button in the playerlist

6. by clicking the spielen button you send a play query mmtships:{Playername}:startgame



summary:

when you four sockets at the moment:

1.socket for sending udp paket in the server.js

2.socket for getting udp messages in the server.js

3.socket for communication between server.js and client.html

4.socket for sending and getting udp messages in the client.html  



Maybe we can reduce number of socket.
This is it at the moment, See you later alligator. 