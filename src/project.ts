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
import {encodeLocation} from './functions';
import {ProjectProvider} from './general';
import * as log from './log';
import * as msg from './messages';

/**
 * This controls all currently active projects evaluated by the extension.
 */
export default class ProjectEngine {
  private _projects = new Map<vscode.Uri, Project>();
  private _parser = new msg.Parser(
    msg.Diagnostic,
    msg.Statistic
  );
  private _context: vscode.ExtensionContext;

  /**
   * Creates engine is a specified extension context.
   */
  constructor(context: vscode.ExtensionContext) {
    this._context = context;
  }

  /**
   * Destroys engine.
   */
  dispose () {
    this._projects.clear();
    this._parser.dispose();
  }

  /**
   * Returns true if analysis of a specified project has been already activated.
   */
  isActive(uri: vscode.Uri): boolean {
    return this._projects.has(uri);
  }

  /**
   * Starts analysis of a specified project.
   *
   * TODO (kaniandr@gmail.com): currently each project consists of a single
   * file, update to support projects configured with a help of *.json file.
   */
  start(doc: vscode.TextDocument): Thenable<msg.Diagnostic|undefined> {
    return new Promise((resolve, reject) => {
      let check = this._checkDocument(doc);
      if (check)
        return reject(check);
      let uri = doc.uri;
      let prjDir = this._makeProjectDir(path.dirname(uri.fsPath));
      if (typeof prjDir != 'string')
        return reject(prjDir);
      this._startServer(uri, prjDir);
      return resolve(undefined);
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
    let project = this._projects.get(uri);
    if (project)
      project.dispose();
    this._projects.delete(uri);
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
    if (this.isActive(uri))
      diag.Error.push(log.Error.alreadyActive);
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
   */
  private _startServer(uri: vscode.Uri, prjDir: string) {
    const pipe = path.join('\\\\?\\pipe', uri.path, log.Project.pipe);
    // {execArgv: []} disables --debug options otherwise the server.js tries to
    // use the same port as a main process for debugging and will not be run
    // in debug mode
    const server = child_process.fork(
      path.join(__dirname,'server.js'), [pipe], {execArgv: [], silent: true});
    server.stdout.setEncoding('utf8')
    server.stdout.on('data', (data)=>{console.log(data)});
    server.on('error', (err) => {this._internalError(err)});
    server.on('close', () => {this._stop(uri)});
    server.on('message', (data) => {
      let client: net.Socket;
      try {
        // if data is not listening then it is en error description
        if (data !== log.Message.listening)
          throw JSON.parse(data);
        let project: Project;
        client = net.connect(pipe, () => {client.setEncoding('utf8')});
        project = new Project(uri, prjDir, client, server);
        this._context.subscriptions.push(project);
        project.register(ProjectProvider.scheme, new ProjectProvider(project));
        this._projects.set(uri, project);
        client.on('error', (err) => {this._internalError(err)});
        client.on('data', (data) => {console.log(`server: ${data}`)});
        client.on('data', this._onResponse.bind(this, project, client));
        vscode.commands.executeCommand('vscode.previewHtml',
          encodeLocation(
            project.providerScheme(ProjectProvider.scheme), project.uri),
          vscode.ViewColumn.Two,
          `${log.Extension.displayName} | ${project.prjname}`).
        then((success) => {this._runAnalysis(project)}, (reason) => {});
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
          throw log.Error.rejected;
        let obj = this._parser.fromJSON(data);
        if (!obj)
          throw log.Error.unknownResponse.replace('{0}', data);
        project.update(ProjectProvider.scheme, obj);
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
   * extension log, propose the user to send report to the DVM team
   * (add appropriate button in error message box).
   */
  private _internalError(err: Error): void {
    console.log(err);
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
      case msg.Status.Error:
        vscode.window.showInformationMessage(
          `${log.Extension.displayName} | ${project.prjname}: ${log.Message.active}`);
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
   * Update visible content.
   */
  update();
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
  private _providers = new Map<string, ProjectContentProvider>();
  private _output: vscode.OutputChannel
  private _disposable;

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
    this._client.write(JSON.stringify(request) + log.Project.delimiter);
  }

  /**
   * Registers content provider with a specified base scheme.
   *
   * Note that 'scheme' parameter will be used to construct unique scheme in
   * accordance to the project identifier. So 'scheme' parameter must not be
   * unique for different project but must be different for different provider
   * classes, for example see ProjectProvider.scheme field.
   */
  register(scheme: string, provider: ProjectContentProvider) {
    this._providers.set(scheme, provider);
    this._disposable = vscode.Disposable.from(this._disposable,
      vscode.workspace.registerTextDocumentContentProvider(
        this.providerScheme(scheme), provider));
  }

  /**
   * Returns unique scheme for a provider with a specified base scheme.
   */
  providerScheme(scheme: string) : string {
    return encodeURIComponent(
      `${scheme}:///${this._prjUri.toString()}`).replace(/%/g,'+');
  }

  /**
   * Updates provider with a specified base scheme.
   *
   * The specified response will be stored in a queue of response and can be
   * accessed via response() getter.
   */
  update(scheme: string, response: any) {
    this._responses.push(response);
    this._providers.get(scheme).update();
  }

  /**
   * Returns number of responses in a stack.
   */
  responseNumber(): number { return this._responses.length; }

  /**
   * Extract the first response which has not been evaluated yet from a response
   * queue stack.
   *
   * Returns undefined if there are no responses in a queue.
   */
  pop(): any|undefined {
    return (this._responses.length &&
      this._newResponse < this._responses.length) ?
      this._responses[this._newResponse++] : undefined;
  }

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
   * Returns the last extracted response.
   */
  get response(): any|undefined {
    return (this._responses.length && this._newResponse > 0) ?
      this._responses[this._newResponse - 1] : undefined;
  }

  /**
   * Returns output channel to represent terminal output.
   */
  get output(): vscode.OutputChannel {return this._output;}
}
