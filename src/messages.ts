//===--- messages.ts ------ Requests and Responses ---------- TypeScript --===//
//
//                           TSAR Advisor (SAPFOR)
//
//===----------------------------------------------------------------------===//
//
// This contains possible requests and responses to interact with an analysis
// server. This file also implements parser to parses JSON string and build
// appropriate object.
//
// For each message an interface MessageNameJSON should be available it must
// extends MessageJSON, for example, CommandLineJSON. According to each
// interface a special class should be implemented which contains at least
// two methods:
// - toJSON(): MessageNameJSON
// - static fromJSON(json: MessageNameJSON|string) : MessageName
//
//===----------------------------------------------------------------------===//

'use strict';

/**
 * This parses a message represented in a JSON format and store it in
 * appropriate object.
 *
 * The search for such object is based on object type name property.
 * For example,
 * let _parser = new Parser(mst.Diagnostic, msg.Statistic);
 * let diag = _parser.fromJSON('{"name": "Diagnostic", "Error": []}');
 * if (diag instanceof msg.Diagnostic) {
 *   console.log("Diagnostic message has been parsed successfully!");
 * }
 */
export class Parser {
  private _messages = new Map<string, any>();

  /**
   * Clear list of supported messages.
   */
  dispose() {
    this._messages.clear();
  }

  /**
   * Creates a parser which support a specified messages.
   */
  constructor(...msgs: any[]) {
    for(let msg of msgs) {
      this._messages.set(msg.name, msg);
    }
  }

  /**
   * Parses a specified message and returns appropriate object on success,
   * otherwise returns undefined.
   */
  fromJSON(json: string): any|undefined {
    let obj = JSON.parse(json);
    let kind = this._messages.get(obj.name);
    if (!kind)
      return undefined;
    return kind.fromJSON(json);
  }
}

/**
 * Indexable list of arguments.
 */
export interface Arguments {
  [index: number]: string;
  length: number;
  push(item: string): number;
}

export enum Status {Success, Error, Invalid};
export enum Analysis {Yes, No, Invalid};

/**
 * This contains diagnostics which describes tool behavior: errors, warnings,
 * execution characteristics.
 */
export class Diagnostic {
  Error: Arguments = [];
  Warning: Arguments = [];
  Terminal: string;
  Status: Status = Status.Invalid;

  toJSON(): DiagnosticJSON {
    return Object.assign({name: Diagnostic.name}, this);
  }

  static fromJSON(json: DiagnosticJSON|string) : Diagnostic {
    if (typeof json === 'string') {
      return JSON.parse(json, Diagnostic.reviver);
    } else {
      let obj = Object.create(Diagnostic.prototype);
      return Object.assign(obj, json);
    }
  }

  static reviver(key: string, value: any): any {
    return key === "" ? Diagnostic.fromJSON(value) : value;
  }
}

/**
* Command line which is used to run a tool.
*
* This consists of the following elements:
* - list of arguments which contains options and input data,
* - specification of an input/output redirection.
*/
export class CommandLine {
  Args: Arguments;
  Input?: string;
  Output?: string;
  Error?: string;

  constructor(exec: string) {
    this.Args = [exec];
  }

  toJSON(): CommandLineJSON {
     return Object.assign({name: CommandLine.name}, this);
  }

  static fromJSON(json: CommandLineJSON|string): CommandLine {
    if (typeof json === 'string') {
      return JSON.parse(json, CommandLine.reviver);
    } else {
      let obj = Object.create(CommandLine.prototype);
      return Object.assign(obj, json);
    }
  }

  static reviver(key: string, value: any): any {
    return key === "" ? CommandLine.fromJSON(value) : value;
  }
}

/**
 * This represents statistic for analyzed project.
 */
export class Statistic {
  Files: {string:number};
  Functions: number;
  Loops: [number,number];
  Variables: number;
  Privates: number;
  LastPrivates: number;
  FirstPrivates: number;
  DynamicPrivates: number;
  Dependencies: number;
  Reductions: number;

  toJSON(): StatisticJSON {
    let json:any = Object.assign({name: Statistic.name}, this);
    json.Loops = undefined;
    if (this.Loops !== undefined) {
      json.Loops[Analysis[Analysis.Yes]] = this.Loops[Analysis.Yes];
      json.Loops[Analysis[Analysis.No]] = this.Loops[Analysis.No];
    }
    return json;
  }

  static fromJSON(json: StatisticJSON|string) : Statistic {
    if (typeof json === 'string') {
      return JSON.parse(json, Statistic.reviver);
    } else {
      let obj = Object.create(Statistic.prototype);
      for (let key in json)
        if (key != 'Loops')
          obj[key] = json[key];
      obj.Loops = {};
      obj.Loops[Analysis.Yes] = json.Loops[Analysis[Analysis.Yes]];
      obj.Loops[Analysis.No] = json.Loops[Analysis[Analysis.No]];
      return obj;
    }
  }

  static reviver(key: string, value: any): any {
    return key === '' ? Statistic.fromJSON(value) : value;
  }
}

/**
 * JSON representation of a request identifier.
 */
interface MessageJSON {
  readonly name: string;
}

/**
 * JSON representation of a command line parameters.
 */
export interface CommandLineJSON extends MessageJSON {
  Args: Arguments;
  Input?: string;
  Output?: string;
  Error?: string;
}

/**
 * JSON representation of diagnostics.
 */
export interface DiagnosticJSON extends MessageJSON {
  Error: Arguments;
  Warning: Arguments;
  Terminal: string;
  Status: Status;
}

/**
 * JSON representation of analysis statistic.
 */
export interface StatisticJSON extends MessageJSON {
  Functions: number;
  Loops: {string:number};
  Variables: number;
  Privates: number;
  LastPrivates: number;
  FirstPrivates: number;
  DynamicPrivates: number;
  Dependencies: number;
  Reductions: number;
}

