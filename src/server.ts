//===--- server.ts ------------ Analysis Server ------------- TypeScript --===//
//
//                           TSAR Advisor (SAPFOR)
//
//===----------------------------------------------------------------------===//
//
// This script runs a new instance of a server which will be listen for
// a connection on a path given as a script parameter.
//
// This process may send to type of messages:
// - log.Message.listening will be sent when server is ready for connection
// - other messages is error description.
//
//===----------------------------------------------------------------------===//
'use strict'

import * as net from 'net';
import * as log from './log';
const connect = module.require('./bclSocket');

let argv = process.argv.slice(2);
const pipe = argv.pop();
const server = net.createServer((socket) => {
  server.close();
  socket.on('data', (data) => {console.log(`client: ${data}`)});
  socket.on('error', (err) => {process.send(JSON.stringify(err))});
  try {
    let connection = connect(
      (data) => {socket.write(data)},
      (event, callback) => {socket.on(event, callback)});
    connection.startServer();
  }
  catch(err) {
    process.send(JSON.stringify(err));
    socket.destroy();
  }
});

server.listen(pipe);
process.send(log.Message.listening);
