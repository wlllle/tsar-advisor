//===--- log.ts ------------- Extension Constants ----------- TypeScript --===//
//
//                           TSAR Advisor (SAPFOR)
//
//===----------------------------------------------------------------------===//
//
// This contains constants for the whole extension. Note that some character
// strings contains {N} substrings which should be replaced with an appropriate
// value when a constant will be used. For example,
// console.log(Error.notDirectory.replace('{0}', 'foo'), the output will be
// 'foo already exists but it is not a directory'.
//
// Do not use here 'vscode' module, only standard Node.js modules can be used.
//===----------------------------------------------------------------------===//

'use strict';

import * as path from 'path';

export class Extension {
  static displayName = 'TSAR Advisor';
  static url = 'http://dvm-system.org';
  static langauges = {'c' : 'C', 'cpp' : 'C++'};
  static style = path.resolve(__dirname, 'style.css');
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
}

export class Message {
  static active = 'analysis session is active';
  static listening = 'server is listening for connection';
}

export class Terminal {
  static displayName = 'Output for {0}';
}

export class Command {
  static restart = 'Restart Now';
}