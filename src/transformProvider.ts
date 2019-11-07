//===- transformProvider.ts - Transformation Provider ------- TypeScript --===//
//
//                           TSAR Advisor (SAPFOR)
//
// This file implements provider and its state to display transformation progress.
//
//===----------------------------------------------------------------------===//

'use strict'

import * as vscode from 'vscode';
import * as log from './log';
import * as msg from './messages';
import {DisposableLikeList, onReject} from './functions'; 
import {Project, ProjectEngine, ProjectContentProvider,
  ProjectContentProviderState} from './project';
/**
 * Register transformation command.
 * 
 * @param command Command descriptions: name, title and corresponding TSAR option.
 */
export function registerCommands(
    commandList: {command: string, title: string, run: string}[],
    engine: ProjectEngine, subscriptions: DisposableLikeList) {
  for (let info of commandList)
    subscriptions.push(vscode.commands.registerCommand(
      info.command, (uri:vscode.Uri) => {
        vscode.workspace.openTextDocument(uri)
          .then((success) => {return engine.start(success) })
          .then(
            project => {
              let state = project.providerState(TransformationProvider.scheme);
              vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                cancellable: true,
                title: `${log.Extension.displayName} | ${project.prjname}: ${info.title}`,
              }, (progress, token) => {
                token.onCancellationRequested(() => {
                  vscode.commands.executeCommand('tsar.stop', project.uri);
                });
                return new Promise(resolve => {
                  state.onDidChangeActiveState(isActive => {
                    if (!isActive) {
                      resolve();
                    }
                  });
                });
              }).then(value => {vscode.commands.executeCommand('tsar.stop', project.uri)});
              state.active = true;
              engine.runTool(project, info.run)
              project.send('');
            },
            reason => { return onReject(reason, uri) })
      }))
}

class TransformationProviderState implements ProjectContentProviderState {
  private _provider: TransformationProvider;
  private _isActive = false;

  private _onDidDisposeContent = new vscode.EventEmitter<void>();
  readonly onDidDisposeContent = this._onDidDisposeContent.event;

  private _onDidChangeActiveState = new vscode.EventEmitter<boolean>();
  readonly onDidChangeActiveState = this._onDidChangeActiveState.event;

  readonly disposables: vscode.Disposable[] = [];

  constructor(provider: TransformationProvider) {
    this._provider = provider;
  }

  get provider(): TransformationProvider { return this._provider; }

  actual(request: any): boolean { return false; }

  get active(): boolean { return this._isActive; }
  set active(is: boolean) {
    this._isActive = is;
    this._onDidChangeActiveState.fire(this._isActive);
  }

  dispose() {
    this.disposables.forEach(d => d.dispose());
    this.disposables.length = 0;
  }
};

export class TransformationProvider implements ProjectContentProvider {
  static scheme = "tsar-transform";
  private _onDidAriseInternalError = new vscode.EventEmitter<Error>();
  readonly onDidAriseInternalError = this._onDidAriseInternalError.event;

  state(): TransformationProviderState { return new TransformationProviderState(this) };

  update(project: Project) {
    let state = project.providerState(
      TransformationProvider.scheme) as TransformationProviderState;
    if (!state.active)
      return;
    if (project === undefined) {
      this._onDidAriseInternalError.fire(new Error(log.Error.unavailable));
      vscode.window.showErrorMessage(log.Extension.displayName +
        `: ${project.prjname} ${log.Error.unavailable}`, 'Try to restart', 'Go to Project')
        .then(item => {
          if (item === 'Try to restart') {
            vscode.commands.executeCommand('tsar.stop', project.uri);
            vscode.commands.executeCommand('tsar.start', project.uri);
          }
          else if (item == 'Go to Project') {
            vscode.commands.executeCommand('tsar.open-project', project.uri);
          }
        });
    } else if (project.response instanceof msg.Diagnostic) {
      if (project.response.Status == msg.Status.Done)
        state.active = false;
    }
  }

  dispose() {}
};