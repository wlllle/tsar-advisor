//===--- log.ts ------------- Extension Constants ----------- TypeScript --===//
//
//                           TSAR Advisor (SAPFOR)
//
//===----------------------------------------------------------------------===//
//
// This contains constants for the whole extension. Note that some character
// strings contains {N} sub-strings which should be replaced with an appropriate
// value when a constant will be used. For example,
// console.log(Error.notDirectory.replace('{0}', 'foo'), the output will be
// 'foo already exists but it is not a directory'.
//
// This also contains the Log class to log extension behavior.
//
// Do not use here 'vscode' module, only standard Node.js modules can be used.
//===----------------------------------------------------------------------===//

'use strict';

import * as path from 'path';
import * as fs from 'fs';

export class Extension {
  static displayName = 'TSAR Advisor';
  static url = 'http://dvm-system.org';
  static langauges = {'c' : 'C', 'cpp' : 'C++'};
  static style = path.resolve(__dirname, 'style.css');
  static log = path.resolve(__dirname, '..', '..', 'log', 'tsar.log');
}

export class Project {
  static directory = '.tsar';
  static delimiter = '$';
  static pipe = 'db';
  static error = 'error.log';
  static output = 'output.log';
  static input = 'input.log';
}

export class Error {
  static general = 'some errors have been occurred';
  static alreadyActive = 'analysis session is already activated';
  static untitled = '{0} is untitled document, save it at first';
  static notDirectory = '{0} already exists but it is not a directory';
  static language = '{0} has unsupported language, the following languages are supported: ' +
    `${Object.keys(Extension.langauges).map(value => {
     return Extension.langauges[value]
    }).join(', ')}`;
  static internal = `internal error, if it will occur again, please contact the application developers (${Extension.url})`;
  static rejected = 'request has been rejected by the server';
  static unknownResponse = 'unknown response has been received {0}';
  static unknownMessage = 'unknown message has been received {0}';
  static openFile = 'can not open file {0}';
  static unavailable = 'project is unavailable'
  static openLog = 'can not open log file';
  static active = 'can not activate analysis session';
  static osIncompatible = 'incompatible type of platform, {0} expected';
  static environment = 'can not establish environment for compiler';
}

export class Message {
  static createLog = 'log file is created';
  static extension = 'extension is activated';
  static active = 'analysis session is activated for {0}';
  static close = 'analysis session is closed for {0}';
  static listening = 'server is listening for connection';
  static connection = 'connection is successfully established';
  static stopServer = 'server is stopped with {0} signal';
  static server = 'response from server {0}';
  static client = 'request from client {0}';
  static tryCompilerEnv = 'try to establish environment for compiler: {0}';
  static environment = 'environment for compiler is established: {0}';
  static generalEnv = 'general environment';
}

export class Server {
  static listening = "listening";
  static connection = "connection";
  static error = "error";
  static data = "data";
}

export class Terminal {
  static displayName = 'Output for {0}';
}

export class Command {
  static restart = 'Restart Now';
}

/**
 * This is a helpful class to log data.
 *
 * When constructed this open a specified file in append mode.
 * All data will be written in format '<date> <data>' where 'date' is a day and
 * time when 'data' is written.
 */
export class Log {
  /**
   * This is a storage for logs to share it between different files.
   */
  static logs: Log[] = [];

  private _log: fs.WriteStream;
  private _path: string;
  private _fd: number;

  /**
   * Open a specified file in append mode and prepare to log data. In case of
   * errors this function throws exception.
   */
  constructor(path: string) {
    this._path = path;
    this._fd = fs.openSync(path, 'a');
    this._log = fs.createWriteStream(path, {fd: this._fd, flags: 'a'});
  }

  dispose() {
    this._log.close();
  }

  /**
   * Write '<date> <data>' string in the log file.
   */
  write(data: string) {

    let now = new Date;
    let nowStr = now.toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour12: false,
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
    });
    this._write(`${nowStr}:${now.getMilliseconds()} ${data}\n`);
  }

  private _write(data: string) {
    if (!this._log.write(data))
      this._log.once('drain', () => {this._write(data)});
  }

  get path(): string { return this._path; }
}