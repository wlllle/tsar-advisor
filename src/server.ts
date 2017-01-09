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
// - log.Server.listening will be sent when server is ready for connection;
// - log.Server.connection will be sent when connection with server is
//  successfully established;
// - log.Server.data {message} will be sent when request from a client has been
// received, the message is a request;
// - log.Server.error {message} will be sent if an error occurs, the message
//  is an error description.
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
  socket.on('error', (err) => {sendError(err)});
  socket.on('data', (data) => {process.send(`${log.Server.data}{${data}}`)});
  try {
    let connection = connect(
      (data) => {socket.write(data)},
      (event, callback) => {socket.on(event, callback)});
    connection.startServer();
    process.send(log.Server.connection);
  }
  catch(err) {
    sendError(err);
    socket.destroy();
  }
});
server.on('error', (err) => {sendError(err)});
server.listen(pipe);
process.send(log.Server.listening);

function sendError(err: any) {
  if (err instanceof Error)
    process.send(`${log.Server.error}{${err.message}}`);
  else
    process.send(`${log.Server.error}{${err}}`);
}