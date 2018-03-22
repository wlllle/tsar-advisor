'use strict'

import * as vscode from 'vscode';
import * as path from 'path';
import {decodeLocation, encodeLocation,
  projectLink, moveToCode, commandLink, numberHtml, styleLink,
  unavailableHtml, waitHtml, checkTrait} from './functions';
import * as log from './log';
import * as msg from './messages';
import {ProjectEngine, Project,
  ProjectContentProvider, ProjectContentProviderState} from './project';

class CalleeFuncProviderState implements ProjectContentProviderState {
  private _provider: CalleeFuncProvider;
  constructor(provider: CalleeFuncProvider) { this._provider = provider; }
  response: any;
  get provider (): CalleeFuncProvider { return this._provider;}
  dispose(): any {}
}

export class CalleeFuncProvider implements ProjectContentProvider{
    static scheme = "tsar-calleefunc";
    private _onDidChange = new vscode.EventEmitter<vscode.Uri>();
    private _engine: ProjectEngine;
  
    constructor(engine: ProjectEngine) { this._engine = engine; }
    dispose() { this._onDidChange.dispose(); }

    state(): CalleeFuncProviderState {
      return new CalleeFuncProviderState(this);
    }

    update(project: Project) {
      this._onDidChange.fire(encodeLocation(CalleeFuncProvider.scheme, project.uri));
    }

    get onDidChange(): vscode.Event<vscode.Uri> {
      return this._onDidChange.event;
    }

  public provideTextDocumentContent(uri: vscode.Uri): Thenable<string>|string {
    let prjUri = <vscode.Uri>decodeLocation(uri).shift();
    let project = this._engine.project(prjUri);
    if (project === undefined)
      return unavailableHtml(prjUri);
    let state = <CalleeFuncProviderState>project.providerState(CalleeFuncProvider.scheme);
    if (project.response !== undefined &&
        project.response instanceof msg.CalleeFunc)
      state.response = project.response;
    let response = project.response;
    return new Promise((resolve, reject) => {
      if (response !== undefined && response instanceof msg.CalleeFunc) {
        return resolve(this._provideCalleeFunc(project, response));
      }
      return resolve(waitHtml(log.CalleeFunc.title, project));
    });
  }

  private _provideCalleeFunc(project: Project, calleefunc: msg.CalleeFunc): string {
    let bootstrap = vscode.Uri.file(
        path.resolve(__dirname, '..', '..', 'node_modules', 'bootstrap', 'dist'));
    let jquery = vscode.Uri.file(
        path.resolve(__dirname, '..', '..', 'node_modules', 'jquery', 'dist'));
    let bootstrapHeader =
      `<!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <meta name="description" content="">
          <meta name="author" content="">
          <title>Callee functions tree</title>
          <link href="${bootstrap}/css/bootstrap.min.css" rel="stylesheet">
          <script src="${jquery}/jquery.min.js"></script>
          <script src="${bootstrap}/js/bootstrap.min.js"></script>
        </head>
        <body>`;
    let bootstrapFooter = `</body></html>`;
    let body = `<ul class="list-unstyled">`;
    let funclen = calleefunc.Functions.length;
    for (let i = 0; i < funclen; i++) {
      body += `<li>${calleefunc.Functions[i].Name}</li>`;
    }
    body += `</ul>`;
    return bootstrapHeader + body + bootstrapFooter;
  }
}