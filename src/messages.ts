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
    let json:any = Object.assign({name: Diagnostic.name}, this);
    json.Status = Status[this.Status];
    return json;
  }

  static fromJSON(json: DiagnosticJSON|string) : Diagnostic {
    if (typeof json === 'string') {
      return JSON.parse(json, Diagnostic.reviver);
    } else {
      let obj = Object.create(Diagnostic.prototype);
      Object.assign(obj, json);
      obj.Status = Status[json['Status']];
      return obj;
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
 * This represents statistic of traits explored in an analyzed project.
 */
export interface TraitStatistic {
  AddressAccess: number;
  HeaderAccess: number;
  NoAccess: number;
  Readonly: number;
  Shared: number;
  Private: number;
  FirstPrivate: number;
  SecondToLastPrivate: number;
  LastPrivate: number;
  DynamicPrivate: number;
  Reduction: number;
  Induction: number;
  Anti: number;
  Output: number;
  Flow: number;
}

/**
 * This represents statistic for analyzed project.
 */
export class Statistic {
  Files: {string:number};
  Functions: number;
  Loops: [number, number];
  Variables: [number, number];
  Traits: TraitStatistic;

  toJSON(): StatisticJSON {
    let json:any = Object.assign({name: Statistic.name}, this);
    json.Loops = undefined;
    if (this.Loops !== undefined) {
      json.Loops[Analysis[Analysis.Yes]] = this.Loops[Analysis.Yes];
      json.Loops[Analysis[Analysis.No]] = this.Loops[Analysis.No];
    }
    json.Variables = undefined;
    if (this.Variables !== undefined) {
      json.Variables[Analysis[Analysis.Yes]] = this.Variables[Analysis.Yes];
      json.Variables[Analysis[Analysis.No]] = this.Variables[Analysis.No];
    }
    return json;
  }

  static fromJSON(json: StatisticJSON|string) : Statistic {
    if (typeof json === 'string') {
      return JSON.parse(json, Statistic.reviver);
    } else {
      let obj = Object.create(Statistic.prototype);
      for (let key in json)
        if (key != 'Loops' && key != 'Variables')
          obj[key] = json[key];
      obj.Loops = [undefined, undefined];
      obj.Loops[Analysis.Yes] = json.Loops[Analysis[Analysis.Yes]];
      obj.Loops[Analysis.No] = json.Loops[Analysis[Analysis.No]];
      obj.Variables = [undefined, undefined];
      obj.Variables[Analysis.Yes] = json.Variables[Analysis[Analysis.Yes]];
      obj.Variables[Analysis.No] = json.Variables[Analysis[Analysis.No]];
      return obj;
    }
  }

  static reviver(key: string, value: any): any {
    return key === '' ? Statistic.fromJSON(value) : value;
  }
}

export interface Location {
  Line: number;
  Column: number;
  MacroLine: number;
  MacroColumn: number;
}

export interface TraitsLoops {
  IsAnalyzed: string;
  Perfect: string;
  InOut: string;
  Canonical: string;
}

export interface Loop {
  ID: number; 
  StartLocation: Location;
  EndLocation: Location;
  Traits: TraitsLoops;
  Exit: number;
  Level: number;
  Type: string;
  Hide: boolean;
}

export class LoopTree {
  FunctionID: number;
  Loops: Loop [] = [];

  toJSON(): LoopTreeJSON {
    return Object.assign({name: LoopTree.name}, this);
  }

  static fromJSON(json: LoopTreeJSON|string) : LoopTree {
    if (typeof json === 'string') {
      return JSON.parse(json, LoopTree.reviver);
    } else {
      let obj = Object.create(LoopTree.prototype);
      return Object.assign(obj, json);
    }
  }

  static reviver(key: string, value: any): any {
    return key === '' ? LoopTree.fromJSON(value) : value;
  }
}

export interface FunctionTraits {
  Readonly: string;
  UnsafeCFG: string;
  InOut: string;
  Loops: string;
}

export interface Function {
  ID: number;
  Name: string;
  StartLocation: Location;
  EndLocation: Location;
  Loops: Loop [];
  Traits: FunctionTraits;
}

export class FunctionList {
  Functions: Function [] = [];

  toJSON(): FunctionListJSON {
    return Object.assign({name: FunctionList.name}, this);
  }

  static fromJSON(json: FunctionListJSON|string) : FunctionList {
    if (typeof json === 'string') {
      return JSON.parse(json, FunctionList.reviver);
    } else {
      let obj = Object.create(FunctionList.prototype);
      return Object.assign(obj, json);
    }
  }

  static reviver(key: string, value: any): any {
    return key === '' ? FunctionList.fromJSON(value) : value;
  }
}

export interface CalleeFuncInfo {
  ID: string;
  Level: number;
  Name: string;
  Locations: Location [];
}

export class CalleeFuncList {
  ID: string;
  FuncID: number;
  LoopID: number;
  Attr: number;
  Functions: CalleeFuncInfo [] = [];

  toJSON(): CalleeFuncListJSON {
    return Object.assign({name: CalleeFuncList.name}, this);
  }

  static fromJSON(json: CalleeFuncListJSON|string) : CalleeFuncList {
    if (typeof json === 'string') {
      return JSON.parse(json, CalleeFuncList.reviver);
    } else {
      let obj = Object.create(CalleeFuncList.prototype);
      return Object.assign(obj, json);
    }
  }

  static reviver(key: string, value: any): any {
    return key === '' ? CalleeFuncList.fromJSON(value) : value;
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
  Status: string;
}

/**
 * JSON representation of analysis statistic.
 */
export interface StatisticJSON extends MessageJSON {
  Functions: number;
  Loops: {string:number};
  Variables: {string: number};
  Traits: TraitStatistic;
}

export interface FunctionListJSON extends MessageJSON {
  Functions: Function [];
}

export interface LoopTreeJSON extends MessageJSON {
  FunctionID: number;
  Loops: Loop [];
}

export interface CalleeFuncListJSON extends MessageJSON {
  FuncID: number;
  LoopID: number;
  Attr: number;
  Functions: CalleeFuncInfo [];
}
