//===--- project.ts ------------ Project Engine ------------- TypeScript --===//
//
//                           TSAR Advisor (SAPFOR)
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
import {establishVSEnvironment} from './functions';
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
    msg.Statistic,
    msg.FunctionList,
    msg.LoopTree,
    msg.CalleeFuncList
  );
  private _context: vscode.ExtensionContext;
  private _providers = new Map<string, ProjectContentProvider>();
  private _environment = {};

  /**
   * Build internal identifier for a specified project uri.
   */
  private static _projectID(uri: vscode.Uri): string {
    return uri.with({query: null}).toString();
  }

  /**
   * Return true if a specified object represent URI.
   *
   */
  private static _isUri(obj: vscode.TextDocument | Project | vscode.Uri):
     obj is vscode.Uri {
    return (obj as vscode.Uri).with !== undefined;
  }

  /**
   * Create engine is a specified extension context.
   */
  constructor(context: vscode.ExtensionContext) {
    this._context = context;
    if (!process.platform.match(/^win/i)) {
      this._environment = process.env;
      if (this._environment['LD_LIBRARY_PATH'] === undefined)
        this._environment['LD_LIBRARY_PATH'] = __dirname;
      else
        this._environment['LD_LIBRARY_PATH'] += `:${__dirname}`;
      log.Log.logs[0].write(
        log.Message.environment.replace('{0}', `LD_LIBRARY_PATH=${this._environment['LD_LIBRARY_PATH']}`));
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
   * Destroy engine.
   */
  dispose () {
    this._projects.forEach(project => {project.dispose()});
    this._projects.clear();
    this._providers.clear();
    this._parser.dispose();
  }

  /**
   * Register list of project content providers.
   *
   * Only these content providers can be used to show some information about
   * analyzed project.
   */
  register(...args: [string, ProjectContentProvider][]) {
    for (let arg of args)
      this._providers[arg[0]] = arg[1];
  }

  /**
   * Return true if analysis of a specified project has been already activated.
   */
  isActive(uri: vscode.Uri): boolean {
    return this._projects.has(ProjectEngine._projectID(uri));
  }

  /**
   * Return project with a specified URI.
   */
  project(uri: vscode.Uri): Project|undefined {
    return this._projects.get(ProjectEngine._projectID(uri));
  }

  /**
   * Start analysis of a specified project.
   *
   * TODO (kaniandr@gmail.com): currently each project consists of a single
   * file, update to support projects configured with a help of *.json file.
   */
  start(doc: vscode.TextDocument): Thenable<Project> {
    return new Promise((resolve, reject) => {
      let project = this.project(doc.uri);
      if (project !== undefined) {
        let state = project.providerState(ProjectProvider.scheme);
        state.provider.update(project);
        return undefined;
      }
      let check = this._checkDocument(doc);
      if (check)
        return reject(check);
      let uri = doc.uri;
      let prjDir = this._makeProjectDir(path.dirname(uri.fsPath));
      if (typeof prjDir != 'string')
        return reject(prjDir);
      this._startServer(uri, <string>prjDir, this._environment, resolve, reject);
      return undefined;
    })
  }

  /**
   * Stop analysis of a specified project.
   */
  stop(target: vscode.TextDocument | Project | vscode.Uri) {
    if (ProjectEngine._isUri(target))
      this._stop(target)
    else
      this._stop(target.uri);
  }

  /**
   * Send response to run analysis or perform transformation.
   */
  runTool(project: Project, query?: string) {
    let cl = new msg.CommandLine(log.Extension.displayName);
    cl.Args[1] = project.uri.fsPath;
    if (query)
      cl.Query = query;
    cl.Output = path.join(project.dirname, log.Project.output);
    cl.Error = path.join(project.dirname, log.Project.error);
    project.send(cl);
  }

  /**
   * Stop analysis of a specified project.
   */
  private _stop(uri: vscode.Uri) {
    let project = this.project(uri);
    if (project === undefined)
      return;
    let id = ProjectEngine._projectID(project.uri);
    this._projects.delete(id);
    project.dispose();
    log.Log.logs[0].write(
      log.Message.close.replace('{0}', project.uri.toString()));
  }

  /**
  *  Check that a specified document can be analyzed.
  */
  private _checkDocument(doc: vscode.TextDocument): Error[]|undefined {
    let uri = doc.uri;
    /// TODO (kaniandr@gmail.com): suggest save it and open appropriate dialog.
    let errors: Error[] = [];
    if (doc.isUntitled)
      errors.push(
        new Error(log.Error.untitled.replace('{0}', uri.fsPath)));
    if (!log.Extension.langauges[doc.languageId])
      errors.push(
        new Error(log.Error.language.replace('{0}', uri.fsPath)));
    return (errors.length > 0) ? errors : undefined;
  }

  /**
   *  Create directory for a project-specific files, returns full path of
   *  created directory on success, otherwise returns appropriate diagnostics.
   */
  private _makeProjectDir(pathToPrj: string): Error|string {
    let prjDir = path.join(pathToPrj, log.Project.directory);
    try {
      if (fs.existsSync(prjDir)) {
        let stat = fs.statSync(prjDir);
        if (!stat.isDirectory())
          return new Error(log.Error.notDirectory.replace('{0}', prjDir));
      } else {
        fs.mkdirSync(prjDir);
      }
    }
    catch (err) {
      return new Error(err.message);
    }
    return prjDir;
  }
  /**
   * Start server to analyze project and initialize connection between the
   * server and adviser, returns true on success.
   *
   * If some errors occur during initialization they will be treated
   * and evaluated as internal errors.
   * Function _onResponse() will be set as listener for responses from server.
   *
   * @param env This parameter is used to specified environment of server
   *  execution.
   */
  private _startServer(uri: vscode.Uri, prjDir: string, env: any, resolve: any, reject: any) {
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
          for (let scheme in this._providers) {
            let provider= this._providers[scheme];
            provider.onDidAriseInternalError(this._internalError,
              this, this._context.subscriptions);
            project.register(scheme, provider.state());
          }
          this._projects.set(ProjectEngine._projectID(uri), project);
          client.on('error', (err) => {this._internalError(err)});
          client.on('data', (data:string) => {
            log.Log.logs[0].write(log.Message.server.replace('{0}', data));
          });
          client.on('data', this._onResponse.bind(this, project, client));
        } else if (data === log.Server.connection) {
          log.Log.logs[0].write(log.Message.connection);
          log.Log.logs[0].write(
            log.Message.active.replace('{0}', project.uri.toString()));
          resolve(project);
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
        reject(err);
        if (server)
          server.kill();
        if (client)
          client.destroy();
      }
    });
  }

  /**
   * Return pipe to exchange messages between client (GUI) and server (TSAR).
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
   * Evaluate response received from the server.
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
   * Show diagnostics to a user.
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
 * This content provider allows to add readonly documents
 * which represent project traits to the editor.
 */
export interface ProjectContentProvider {
  /**
   * Fired when an internal error occured.
   */
  readonly onDidAriseInternalError : vscode.Event<Error>;

  /**
   * Returns new description of a project content provider state.
   */
  state(): ProjectContentProviderState;

  /**
   * Update visible content for a specified project.
   */
  update(project: Project): any;

  /**
   *  Dispose provider.
   */
  dispose(): any;
}

/**
 * This describes state of a project content provider.
 */
export interface ProjectContentProviderState {
  /**
   * Content provider with a current state.
   */
  readonly provider: ProjectContentProvider;

  /**
   * Fired when a visible content is disposed.
   *
   * It should not dispose the whole state.
   * Implementation must allow to safely use state after it.
   */
  readonly onDidDisposeContent: vscode.Event<void>;

  /**
   * True if actual content is available, otherwise some data
   * should be loaded from server.
   *
   * @param request Data which would be requested if necessary.
   */
  actual(request: any): boolean;

  /**
   * Access 'active' property of the state.
   *
   * Return `true` if state is active.
   *
   * Usage example. If set to `true` fire event `onDidChangeActiveState` event
   * and notify listeners that the state wait for content to show. Project is
   * listening for this event and try to show content on activation.
   */
  active: boolean;

  /**
   * Fired when state 'active' property is changed.
   */
  readonly onDidChangeActiveState : vscode.Event<boolean>;

  /**
   * List of disposable objects which should be disposed with this state.
   */
  readonly disposables: vscode.Disposable [];

  /**
   * Dispose of the state.
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
  private _isDisposed = false;

  /**
   * Create a project with a specified uri.
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
   * Dispose project and its data (sockets, processes, windows).
   */
  dispose() {
    if (this._isDisposed)
      return;
    this._isDisposed = true;
    this._providers.clear();
    this._output.hide();
    this._client.end();
    this._server.kill();
    this._disposable.dispose();
  }

  /**
   * Send request to a server.
   */
  send(request: any) {
    if (!this._client.write(JSON.stringify(request) + log.Project.delimiter))
      this._client.once('drain', () => {this.send(request)});
  }

  /**
   * Register content provider with a specified base scheme.
   */
  register(scheme: string, state: ProjectContentProviderState) {
    this._providers.set(scheme, state);
    this._disposable = vscode.Disposable.from(this._disposable, state);
    state.onDidChangeActiveState((isActive: boolean) => {
      if (isActive)
        state.provider.update(this);
    });
  }

  /**
   * Return state of content provider with a specified scheme.
   *
   * The provider with a specified scheme must be at first registered in a
   * project with register() method.
   */
  providerState(scheme: string) : ProjectContentProviderState|undefined {
    return this._providers.get(scheme);
  }

  /**
   * Update provider with a specified scheme.
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
   * Update all registered providers.
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
   * Return number of all responses some of which have been already evaluated
   * and other are new responses.
   */
  responseNumber(): number { return this._responses.length; }

  /**
   * Return project unique identifier.
   */
  get uri(): vscode.Uri { return this._prjUri; }

  /**
   * Return project internal directory name.
   */
  get dirname(): string { return this._prjDir; }

  /**
   * Return project name.
   */
  get prjname(): string { return path.basename(this._prjUri.fsPath); }

  /**
   * Return the first response which has not been evaluated yet, to mark that
   * it is evaluated use pop() function.
   */
  get response(): any|undefined {
    return (this._newResponse < this._responses.length) ?
      this._responses[this._newResponse] : undefined;
  }

  /**
   * Return output channel to represent terminal output.
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
