//===--- project.ts ------------ Project Engine ------------- TypeScript --===//
//
//                           TSAR Advisor (SAPFOR)
//
//===----------------------------------------------------------------------===//
//
// This implements active project controller and single project representation.
//
//===----------------------------------------------------------------------===//

'use strict';

import * as child_process from 'child_process';
import * as fs from 'fs';
import * as net from 'net';
import * as path from 'path';
import * as vscode from 'vscode';
import {encodeLocation, decodeLocation, establishVSEnvironment} from './functions';
import {ProjectProvider} from './general';
import * as log from './log';
import * as msg from './messages';

/**
 * This controls all currently active projects evaluated by the extension.
 */
export class ProjectEngine {
  private _projects = new Map<string, Project>();
  private _parser = new msg.Parser(
    msg.Diagnostic,
    msg.Statistic
  );
  private _context: vscode.ExtensionContext;
  private _providers = {};
  private _environment = {};

  /**
   * Creates engine is a specified extension context.
   */
  constructor(context: vscode.ExtensionContext) {
    this._context = context;
    if (!process.platform.match(/^win/i)) {
      this._environment = process.env;
      log.Log.logs[0].write(
        log.Message.environment.replace('{0}', log.Message.generalEnv));
      return;
    }
    this._environment = establishVSEnvironment((err) => {
      if (err instanceof Error)
        log.Log.logs[0].write(
          log.Message.environment.replace('{0}', err.message));
      else
        log.Log.logs[0].write(
          log.Message.environment.replace('{0}', err));
    });
    if (this._environment === undefined) {
      log.Log.logs[0].write(
        log.Message.environment.replace('{0}', log.Error.environment));
      vscode.window.showWarningMessage(
        `${log.Extension.displayName}: ${log.Error.environment}`);
      this._environment = process.env;
    } else {
      log.Log.logs[0].write(
        log.Message.environment.replace('{0}', `VS version ${this._environment['VisualStudioVersion']}`));
    }
  }

  /**
   * Destroys engine.
   */
  dispose () {
    this._projects.clear();
    this._parser.dispose();
  }

  /**
   * Register list of project content providers.
   *
   * Only these  content providers can be used to show some information about
   * analyzed project.
   */
  register(...args: [string, ProjectContentProvider][]) {
    for (let arg of args) {
      this._context.subscriptions.push(
        vscode.workspace.registerTextDocumentContentProvider(
          arg[0], arg[1]));
      this._providers[arg[0]] = arg[1];
    }
  }

  /**
   * Returns true if analysis of a specified project has been already activated.
   */
  isActive(uri: vscode.Uri): boolean {
    return this._projects.has(uri.toString());
  }

  /**
   * Returns project with a specified URI.
   */
  project(uri: vscode.Uri): Project|undefined {
    return this._projects.get(uri.toString());
  }

  /**
   * Starts analysis of a specified project.
   *
   * TODO (kaniandr@gmail.com): currently each project consists of a single
   * file, update to support projects configured with a help of *.json file.
   */
  start(doc: vscode.TextDocument): Thenable<msg.Diagnostic|undefined> {
    return new Promise((resolve, reject) => {
      let project = this.project(doc.uri);
      if (project !== undefined) {
        vscode.commands.executeCommand('vscode.previewHtml',
          encodeLocation(ProjectProvider.scheme, project.uri),
          vscode.ViewColumn.Two,
          `${log.Extension.displayName} | ${project.prjname}`);
        return undefined;
      }
      let check = this._checkDocument(doc);
      if (check)
        return reject(check);
      let uri = doc.uri;
      let prjDir = this._makeProjectDir(path.dirname(uri.fsPath));
      if (typeof prjDir != 'string')
        return reject(prjDir);
      this._startServer(uri, <string>prjDir, this._environment);
      return undefined;
    })
  }

  /**
   * Stops analysis of a specified project.
   */
  stop(doc: vscode.TextDocument) {
   this._stop(doc.uri);
  }

  /**
   * Stops analysis of a specified project.
   */
  private _stop(uri: vscode.Uri) {
    let project = this.project(uri);
    if (project === undefined)
      return;
    let dir = project.uri.toString();;
    project.dispose();
    this._projects.delete(project.uri.toString());
    log.Log.logs[0].write(log.Message.close.replace('{0}', dir));
  }

  /**
  *  Checks that a specified document can be analyzed.
  */
  private _checkDocument(doc: vscode.TextDocument): msg.Diagnostic|undefined {
    let uri = doc.uri;
    let diag = new msg.Diagnostic;
    /// TODO (kaniadnr@gmail.com): suggest save it and open appropriate dialog.
    if (doc.isUntitled)
      diag.Error.push(log.Error.untitled.replace('{0}', uri.fsPath));
    if (!log.Extension.langauges[doc.languageId])
      diag.Error.push(log.Error.language.replace('{0}', uri.fsPath));
    return (diag.Error.length > 0) ? diag : undefined;
  }

  /**
   *  Creates directory for a project-specific files, returns full path of
   *  created directory on success, otherwise returns appropriate diagnostics.
   */
  private _makeProjectDir(pathToPrj: string): msg.Diagnostic|string {
    let prjDir = path.join(pathToPrj, log.Project.directory);
    try {
      if (fs.existsSync(prjDir)) {
        let stat = fs.statSync(prjDir);
        if (!stat.isDirectory()) {
          let diag = new msg.Diagnostic;
          diag.Error.push(
            log.Error.notDirectory.replace('{0}', prjDir));
          return diag;
        }
      } else {
        fs.mkdirSync(prjDir);
      }
    }
    catch (err) {
      let diag = new msg.Diagnostic;
      diag.Error.push(err.message);
      return diag;
    }
    return prjDir;
  }
  /**
   * Starts server to analyze project and initialize connection between the
   * server and adviser, returns true on success.
   *
   * If some errors occur during initialization they will be treated
   * and evaluated as internal errors.
   * Function _onResponse() will be set as listener for responses from server.
   *
   * @param env This parameter is used to specified environment of server
   *  execution.
   */
  private _startServer(uri: vscode.Uri, prjDir: string, env: any) {
    const pipe = this._pipe(uri);
    // {execArgv: []} disables --debug options otherwise the server.js tries to
    // use the same port as a main process for debugging and will not be run
    // in debug mode
    let options = {execArgv: [], env: env};
    const server = child_process.fork(
      path.join(__dirname, 'server.js'), [pipe], options);
    server.on('error', (err) => {this._internalError(err)});
    server.on('close', () => {this._stop(uri);});
    server.on('exit', (code, signal) => {
      log.Log.logs[0].write(log.Message.stopServer.replace('{0}', signal))});
    // do not move project inside 'message' event listener it must be shared
    // between all messages evaluation
    let project: Project;
    server.on('message', (data: string) => {
      let client: net.Socket;
      try {
        if (data === log.Server.listening) {
          log.Log.logs[0].write(log.Message.listening);
          client = net.connect(pipe, () => {client.setEncoding('utf8')});
          project = new Project(uri, prjDir, client, server);
          this._context.subscriptions.push(project);
          for (let scheme in this._providers)
            project.register(scheme, this._providers[scheme].state());
          this._projects.set(uri.toString(), project);
          client.on('error', (err) => {this._internalError(err)});
          client.on('data', (data:string) => {
            log.Log.logs[0].write(log.Message.server.replace('{0}', data));
          });
          client.on('data', this._onResponse.bind(this, project, client));
        } else if (data === log.Server.connection) {
          log.Log.logs[0].write(log.Message.connection);
          vscode.commands.executeCommand('vscode.previewHtml',
            encodeLocation(ProjectProvider.scheme, project.uri),
            vscode.ViewColumn.Two,
            `${log.Extension.displayName} | ${project.prjname}`).
          then((success) => {
            log.Log.logs[0].write(log.Message.active.replace('{0}', project.uri.toString()));
            this._runAnalysis(project);
          }, null);
        } else {
          let match = data.match(/^\s*(\w*)\s*{\s*(.*)\s*}\s*$/);
          if (!match)
            throw new Error(data);
          else if (match[1] === log.Server.data)
            log.Log.logs[0].write(log.Message.client.replace('{0}', match[2]));
          else if (match[1] === log.Server.error)
            throw new Error(match[2]);
          else
            throw new Error(data);
        }
      }
      catch(err) {
        this._internalError(err);
      if (server)
        server.kill();
      if (client)
        client.destroy();
      }
    });
  }

  /**
   * Returns pipe to exchange messages between client (GUI) and server (TSAR).
   * TODO (kaniandr@gmail.com): For Linux OS pipe is a file, so check that it
   * does not exist.
   */
  private _pipe(uri: vscode.Uri): string {
    if (!process.platform.match(/^win/i)) {
      return `${uri.path}.${log.Project.pipe}`;
    } else {
      return path.join('\\\\?\\pipe', uri.path, log.Project.pipe);
    }
  }

  /**
   * Send response to run analysis and obtain general statistic information.
   */
  private _runAnalysis(project: Project) {
    let cl = new msg.CommandLine(log.Extension.displayName);
    cl.Args[1] = project.uri.fsPath;
    cl.Output = path.join(project.dirname, log.Project.output);
    cl.Error = path.join(project.dirname, log.Project.error);
    project.send(cl);
    project.send(new msg.Statistic);
  }

  /**
   * Evaluates response received from the server.
   */
  private _onResponse(project: Project, client: net.Socket, response: string) {
    try {
      let array = response.split(log.Project.delimiter);
      if (array[array.length - 1] == '')
        array.pop(); // ignore the last empty substring
      for (let data of array) {
        if (data === 'REJECT')
          throw new Error(log.Error.rejected);
        let obj = this._parser.fromJSON(data);
        if (!obj)
          throw new Error(log.Error.unknownResponse.replace('{0}', data));
        project.update(obj);
        if (obj instanceof msg.Diagnostic && obj.Status != msg.Status.Success) {
          // Do not invoke client.end() here because it prevents showing errors
          // in output channel project.output.
          this._diagnostic(project, obj);
          return;
        }
      }
    }
    catch(err) {
      this._internalError(err);
      client.destroy();
    }
  }

  /**
   * This function evaluates internal errors, which is not clear for user and
   * should be evaluated by extension developer team.
   *
   * TODO (kaniadnr@gmail.com): store internal errors in a special
   * extension log and crash.report file, propose the user to send report
   * to the DVM team (add appropriate button in error message box).
   */
  private _internalError(err: Error): void {
    log.Log.logs[0].write(`${log.Error.internal}: ${err.message}`);
    vscode.window.showErrorMessage(
      `${log.Extension.displayName}: ${log.Error.internal}`);
  }

  /**
   * Shows diagnostics to a user.
   */
  private _diagnostic(project: Project, diag: msg.Diagnostic) {
    switch (diag.Status) {
      case msg.Status.Error:
      case msg.Status.Invalid:
        vscode.window.showErrorMessage(
          `${log.Extension.displayName} | ${project.prjname}: ${log.Error.general}`);
        break;
      case msg.Status.Success:
        vscode.window.showInformationMessage(
          `${log.Extension.displayName} | ${project.prjname}: ${log.Message.active.replace('{0}', project.prjname)}`);
        break;
    }
    for (let err in diag.Error)
      vscode.window.showErrorMessage(
        `${log.Extension.displayName} | ${project.prjname}: ${diag.Error[err]}`);
    if (diag.Terminal) {
      project.output.appendLine(diag.Terminal);
      project.output.show(true);
    }
  }
}

/**
 * This text document content provider allows to add readonly documents
 * which represents project traits to the editor.
 */
export interface ProjectContentProvider
    extends vscode.TextDocumentContentProvider {
  /**
   * Returns new description of a project content provider state.
   */
  state(): ProjectContentProviderState;

  /**
   * Update visible content for a specified project.
   */
  update(project: Project);
}

/**
 * This describes state of a project content provider.
 */
export interface ProjectContentProviderState {
  /**
   * Content provider with a current state.
   */
  provider: ProjectContentProvider;

  /**
   * Disposes the state.
   *
   * Do not dispose providers when state is disposed.
   */
  dispose(): any;
}

/**
 * This represents one of evaluated projects.
 *
 * Each project has a unique identifier (uri). Only one project with the same
 * uri can be analyzed at a time.
 *
 * Project is a disposable object and can be stored in vscode.Disposable.
 */
export class Project {
  private _prjUri: vscode.Uri;
  private _prjDir: string;
  private _client: net.Socket;
  private _server: child_process.ChildProcess;
  private _responses = [];
  private _newResponse = 0;
  private _providers = new Map<string, ProjectContentProviderState>();
  private _output: vscode.OutputChannel
  private _disposable: vscode.Disposable;

  /**
   * Creates a project with a specified uri.
   *
   * @param projectUri Unique identifier of a project.
   * @param projectDir Basename of a directory which will contain project
   * internal data (logs and etc.), for example .tsar.
   * @param client Socket to interconnect with TSAR analyzer.
   * @param server A standalone process where TSAR analyzer is running.
   */
  constructor(projectUri: vscode.Uri, projectDir: string,
      client: net.Socket, server: child_process.ChildProcess) {
    this._prjUri = projectUri;
    this._prjDir = projectDir;
    this._client = client;
    this._server = server;
    this._output = vscode.window.createOutputChannel(
      log.Terminal.displayName.replace('{0}', this.prjname));
    this._disposable = vscode.Disposable.from(this._output);
  }

  /**
   * Disposes project and its data (sockets, processes, windows).
   */
  dispose() {
    this._providers.clear();
    this._output.hide();
    this._client.end();
    this._server.kill();
    this._disposable.dispose();
  }

  /**
   * Sends request to a server.
   */
  send(request: any) {
    if (!this._client.write(JSON.stringify(request) + log.Project.delimiter))
      this._client.once('drain', () => {this.send(request)});
  }

  /**
   * Registers content provider with a specified base scheme.
   */
  register(scheme: string, state: ProjectContentProviderState) {
    this._providers.set(scheme, state);
    this._disposable = vscode.Disposable.from(this._disposable, state);
  }

  /**
   * Returns state of content provider with a specified scheme.
   *
   * The provider with a specified scheme must be at first registered in a
   * project with register() method.
   */
  providerState(scheme: string) : ProjectContentProviderState|undefined {
    return this._providers.get(scheme);
  }

  /**
   * Updates provider with a specified scheme.
   *
   * The specified response will be stored in a queue of response and can be
   * accessed via response() getter from provider.
   * After execution of ProjectProvider::update() method the response will
   * be popped out. Consider this in case of asyncronous update() method.
   */
  updateProvider(scheme: string, response: any) {
    this._responses.push(response);
    let state = this.providerState(scheme);
    if (state)
      state.provider.update(this);
    this._pop();
  }

  /**
   * Updates all registered providers.
   *
   * The specified response will be stored in a queue of response and can be
   * accessed via response() getter from provider.
   * After execution of ProjectProvider::update() methods for each provider
   * the response will be popped out. Consider this in case of asyncronous
   * update() method.
   */
  update(response: any) {
    this._responses.push(response);
    this._providers.forEach(state => {state.provider.update(this)});
    this._pop();
  }

  /**
   * Returns number of all responses some of which have been already evaluated
   * and other are new responses.
   */
  responseNumber(): number { return this._responses.length; }

  /**
   * Returns project unique identifier.
   */
  get uri(): vscode.Uri { return this._prjUri; }

  /**
   * Returns project internal directory name.
   */
  get dirname(): string { return this._prjDir; }

  /**
   * Returns project name.
   */
  get prjname(): string { return path.basename(this._prjUri.fsPath); }

  /**
   * Returns the first response which has not been evaluated yet, to mark that
   * it is evaluated use pop() function.
   */
  get response(): any|undefined {
    return (this._newResponse < this._responses.length) ?
      this._responses[this._newResponse] : undefined;
  }

  /**
   * Returns output channel to represent terminal output.
   */
  get output(): vscode.OutputChannel {return this._output;}

  /**
   * Extract the first response which has not been evaluated yet from a response
   * queue.
   */
  private _pop(): any|undefined  {
    if (this._newResponse < this._responses.length)
      return this._responses[this._newResponse++];
  }
}
