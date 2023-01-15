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
  static id = 'tsar-advisor';
  static displayName = 'TSAR Advisor';
  static url = 'http://dvm-system.org';
  static langauges = {'c' : 'C', 'cpp' : 'C++', 'llvm' : 'LLVM'};
  static style = path.resolve(__dirname, 'style.css');
  static logo = path.resolve(__dirname, 'images', 'logo.png');
  static visNetwork = path.resolve(__dirname, '..', '..', 'node_modules', 'vis-network', 'dist');
  static bootstrap = path.resolve(__dirname, '..', '..', 'node_modules', 'bootstrap', 'dist');
  static jquery = path.resolve(__dirname, '..', '..', 'node_modules', 'jquery', 'dist');
  static icons = path.resolve(__dirname, '..', '..', 'icons');
  static log = path.resolve(__dirname, '..', '..', 'log', 'tsar.log');
}

export class Project {
  static directory = '.tsar';
  static delimiter = '$';
  static pipe = 'db';
  static error = 'error.log';
  static output = 'output.log';
  static input = 'input.log';
  static session = 'session.{0}.log'
  static tooltip = 'Name of the project';
}

export class Error {
  static serverNotFound = 'cannot find analysis server {0}';
  static serverVersion = 'unable to determine server version'
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
  static invalidProjectsJson = 'invalid project json file';
  static invalidProjectCompilationDatabase = 'invalid compilation database';
  static active = 'can not activate analysis session';
  static osIncompatible = 'incompatible type of platform, {0} expected';
  static environment = 'can not establish environment for compiler';
  static closeReminder = 'Examine output and do not forget to close the analysis session!';
}

export class Message {
  static enableLog = 'log is enabled';
  static disableLog = 'log is disabled';
  static createLog = 'log file is created';
  static extension = 'extension is activated';
  static active = 'analysis session is activated for {0}';
  static close = 'analysis session is closed for {0}';
  static listening = 'server is listening for connection';
  static connection = 'connection is successfully established, client {0}, server {1}';
  static serverFound = 'analysis server found {0}';
  static serverVersion = 'version of the analysis server is {0}';
  static stopServer = 'server is stopped with {0} signal';
  static serverState = 'server in state {0}: {1}';
  static serverIORedirected = 'server IO has been redirected';
  static server = 'response from server {0}';
  static client = 'request from client {0}';
  static tryCompilerEnv = 'try to establish environment for compiler: {0}';
  static environment = 'environment for compiler is established: {0}';
  static generalEnv = 'general environment';
  static selectOptions: 'Select additional options if necessary.'
}

export class Server {
  static start = "start";
  static listening = "listen";
  static connection = "accept";
  static close = "close";
  static send = "send";
  static receive = "receive";
  static error = "error";
  static data = "data";
}

export class Terminal {
  static displayName = 'Output for {0}';
}

export class Command {
  static restart = 'Restart Now';
  static gotoCode = 'Go to Source Code';
}

export class FunctionList {
  static title = 'List of functions in {0}';
  static build = 'Build';
  static hide = 'Hide';
  static show = 'Show';
  static loopTree = '{0} loop tree';
}

export class CallGraph {
  static title = 'List of calls from {0}';
  static io = 'View statements which perform in/out operations.';
  static unsafeCFG = 'View statements which lead to unsafe control flow.';
  static exit = 'View all possible exits from this region.';
  static callList = 'List of calls';
  static from = 'View calls from a region';
  static callees = 'Callees';
}

export class AliasTree {
  static title = 'Alias tree for {0}';
  static build = 'Build alias tree';
  static nodeSelf = 'Memory in node';
  static nodeCovered = 'Covered memory';
  static nodeOverlap = 'Overlap with memory';
  static traisList = 'List of traits';
  static hasSeparate = 'Trait is set for some of memory locations separately';
  static hasCombined = 'Trait is set for the whole node';
}

export class Summary {
  static title = 'Analysis result summary for {0}';
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
  private _enabled: boolean;

  set enabled(flag: boolean) {
    if (flag) {
      this._enabled = flag;
      this.write(Message.enableLog);
    } else {
      this.write(Message.disableLog);
      this._enabled = flag;
    }
  }

  get enabled() { return this._enabled; }

  /**
   * Open a specified file in append mode and prepare to log data. In case of
   * errors this function throws exception.
   */
  constructor(path: string, enabled:boolean = false) {
    this._path = path;
    this._fd = fs.openSync(path, 'a');
    this._log = fs.createWriteStream(path, {fd: this._fd, flags: 'a'});
    this.enabled = enabled;
  }

  dispose() {
    this._log.close();
  }

  /**
   * Write '<date> <data>' string in the log file.
   */
  write(data: string) {
    if (!this.enabled)
      return;
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
    this._log.write(`${nowStr}:${now.getMilliseconds()} ${data}\n`);
  }

  get path(): string { return this._path; }
}
