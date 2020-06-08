//===--- fileList.ts ------- List of Files Provider --------- TypeScript --===//
//
//                           TSAR Advisor (SAPFOR)
//
// This file implements provider to store description of all analyzed sources.
// State of this provider gives access to the list of file.
//
//===----------------------------------------------------------------------===//

'use strict';

import * as vscode from 'vscode';
import * as log from './log';
import * as msg from './messages';
import {
  Project,
  ProjectContentProvider,
  ProjectContentProviderState,
} from './project';

export class FileListProviderState implements ProjectContentProviderState {
  private _provider: FileListProvider;
  private _isActive = false;
  private _fileList: Map<number, msg.File>;

  readonly disposables: vscode.Disposable[] = [];

  private _onDidDisposeContent = new vscode.EventEmitter<void>();
  readonly onDidDisposeContent = this._onDidDisposeContent.event;

  private _onDidChangeActiveState = new vscode.EventEmitter<boolean>();
  readonly onDidChangeActiveState = this._onDidChangeActiveState.event;

  constructor(provider: FileListProvider) { this._provider = provider; }

  get provider(): FileListProvider { return this._provider; }

  get active(): boolean { return this._isActive; }
  set active(is: boolean) {
    this._isActive = is;
    this._onDidChangeActiveState.fire(this._isActive);
  }

  actual(request: any): boolean {
    if (request instanceof msg.FileList)
      return this._fileList !== undefined;
    return false;
  }

  getFile(ID: number) : msg.File { return this._fileList.get(ID) }
  hasFile(ID: number) : boolean { return this._fileList.has(ID) }

  dispose(): any {
    this.disposables.forEach(d => d.dispose());
    this.disposables.length = 0;
  }

  onResponse(response: msg.FileList): Thenable<undefined> {
    if (this._fileList !== undefined) {
      this._fileList = undefined;
      this._onDidDisposeContent.fire();
    }
    return new Promise(resolve => {
      this._fileList = new Map<number, msg.File>();
      for (let f of response.Files)
        this._fileList.set(f.ID, f);
      return resolve();
    })
  }
}

export class FileListProvider implements ProjectContentProvider {
  static scheme = "tsar-filelist";

  private readonly _disposables: vscode.Disposable[];

  private _onDidAriseInternalError = new vscode.EventEmitter<Error>();
  readonly onDidAriseInternalError = this._onDidAriseInternalError.event;

  state(): FileListProviderState { return new FileListProviderState(this); }
  update(project: Project) {
    let state = project.providerState(FileListProvider.scheme) as
      FileListProviderState;
    if (project.response !== undefined &&
      project.response instanceof msg.FileList)
      state.onResponse(project.response).then(
        () => { },
        error => {
          this._onDidAriseInternalError.fire(new Error(error));
          vscode.window.showErrorMessage(log.Extension.displayName +
            `: ${project.prjname} ${error}`, 'Try to restart', 'Go to Project')
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
  dispose() {
    this._disposables.forEach(d => d.dispose());
    this._disposables.length = 0;
  }
}