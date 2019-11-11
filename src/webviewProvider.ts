//===- webviewProvider.ts - Abstract Webview Provider ------- TypeScript --===//
//
//                           TSAR Advisor (SAPFOR)
//
// This file implements abstract provider and its state which allow to use
// Webview to render content.
//
//===----------------------------------------------------------------------===//

'use strict'

import * as vscode from 'vscode';
import {waitHtml, UpdateUriFunc} from './functions';
import * as log from './log';
import {Project, ProjectContentProvider,
  ProjectContentProviderState} from './project';

/**
 * State of a project content provider which uses Webview to visualize content.
 */
export class ProjectWebviewProviderState<ProviderT extends ProjectWebviewProvider>
    implements ProjectContentProviderState {
  private _provider: ProviderT;
  private _panel: vscode.WebviewPanel;
  private _hasPanel = false;
  private _isActive = false;

  readonly disposables: vscode.Disposable[] = [];

  private _onDidDisposeContent = new vscode.EventEmitter<void>();
  readonly onDidDisposeContent = this._onDidDisposeContent.event;

  private _onDidChangeActiveState = new vscode.EventEmitter<boolean>();
  readonly onDidChangeActiveState = this._onDidChangeActiveState.event;

  protected _data: any;

  get data(): any { return this._data; }

  /**
   * Process response and promise data to build webview content.
   */
  onResponse(response: any, project: Project): Thenable<any> {
    // If there were some responses and they already evaluated then let us
    // evaluate the last one.
    return new Promise(resolve => {
      if (response !== undefined)
        this._data = response;
      resolve(this._data);
    });
  }

  constructor(provider: ProviderT) {
    this._provider = provider;
  }

  /**
   * Content is not actual by default. Override in derived classes if necessary.
   */
  actual(_request: any): boolean { return false; }

  get active(): boolean { return this._isActive; }
  set active(is: boolean) {
    this._isActive = is;
    // Hide content if state is not active.
    if (!this._isActive && this._hasPanel)
      this._panel.dispose();
    this._onDidChangeActiveState.fire(this._isActive);
  }

  get provider(): ProviderT { return this._provider; }

  /**
   * Return webview panel, create a new one if it does not exist. 
   */
  get panel (): vscode.WebviewPanel {
    if (!this._hasPanel) {
      const columnToShowIn = vscode.window.activeTextEditor
        ? vscode.window.activeTextEditor.viewColumn
        : undefined;
      this._panel = vscode.window.createWebviewPanel(
        this._provider.scheme(),
        log.Extension.displayName,
        columnToShowIn,
        {
          enableCommandUris: true,
          enableScripts: true,
        }
      );
      this._panel.onDidDispose(() => {
        this._hasPanel = false;
        this._onDidDisposeContent.fire();
      }, null, this.disposables);
      this._hasPanel = true;
    }
    return this._panel;
  }

  dispose(): any {
    if (this._hasPanel)
      this._panel.dispose();
    this.disposables.forEach(d => d.dispose());
    this.disposables.length = 0;
  }
}

export abstract class ProjectWebviewProvider implements ProjectContentProvider{
  protected readonly _disposables: vscode.Disposable[];

  protected _onDidAriseInternalError = new vscode.EventEmitter<Error>();
  readonly onDidAriseInternalError = this._onDidAriseInternalError.event;

  dispose() { this._disposables.forEach(d => d.dispose()); }

  /**
   * Return a new description of a project content provider state.
   */
  state(): ProjectWebviewProviderState<ProjectWebviewProvider> {
    return new ProjectWebviewProviderState<ProjectWebviewProvider>(this);
  }

  /**
   * Update visible content for a specified project.
   */
  update(project: Project) {
    let state = project.providerState(
      this.scheme()) as ProjectWebviewProviderState<ProjectWebviewProvider>;
    let content = this.provideContent(project);
    content.then(data => {
      if (!state.active)
        return;
      let panel = state.panel;
      panel.title = `${log.Extension.displayName} | ${project.prjname}`;
      panel.webview.html = data;
      panel.reveal();
    }, data => {
      this._onDidAriseInternalError.fire(new Error(data));
      vscode.window.showErrorMessage(log.Extension.displayName +
        `: ${project.prjname} ${data}`, 'Try to restart', 'Go to Project')
      .then(item => {
        if (item === 'Try to restart') {
          vscode.commands.executeCommand('tsar.stop', project.uri);
          vscode.commands.executeCommand('tsar.start', project.uri);
        }
        else if (item == 'Go to Project')
          vscode.commands.executeCommand('tsar.open-project', project.uri);
      });
    });
  }

  /**
   * Promise html to display in webview panel.
   */
  public provideContent(project: Project): Thenable<string> {
    if (project === undefined)
      return Promise.reject(log.Error.unavailable);
    let state = project.providerState(
      this.scheme()) as ProjectWebviewProviderState<ProjectWebviewProvider>;
    let response =
      project.response !== undefined &&
      this._needToHandle(project.response) ? project.response : undefined;
    return state.onResponse(response, project).then((data: any) => {
      if (!state.active)
        return Promise.resolve('');
      return new Promise((resolve, reject) => {
        let asWebviewUri =
          (uri: vscode.Uri) => state.panel.webview.asWebviewUri(uri);
        if (data !== undefined)
          resolve(this._provideContent(project, data, asWebviewUri));
        else
          resolve(waitHtml(this._title(data), project, asWebviewUri));
      })
    }, (data: any) => Promise.reject(log.Error.unavailable));
  }

  /**
   * Return unique ID for this provider.
   */
  public abstract scheme(): string;

  /**
   * Return true if provider could handle a specified response.
   */
  protected abstract _needToHandle(response: any): boolean;

  /**
   * Provide html according to a specified response.
   */
  protected abstract _provideContent(
    project: Project, data: any, asWebviewUri: UpdateUriFunc): string;

  /**
   * Return title of content to be rendered.
   *
   * This may be used in some diagnostic messages.
   */
  protected abstract _title(response: any|undefined): string;
 };
