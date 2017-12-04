'use strict'

import * as vscode from 'vscode';
import * as path from 'path';
import {decodeLocation, encodeLocation,
  projectLink, commandLink, numberHtml, styleLink,
  unavailableHtml, waitHtml} from './functions';
import * as log from './log';
import * as msg from './messages';
import {ProjectEngine, Project,
  ProjectContentProvider, ProjectContentProviderState} from './project';

/**
 * State of a loop tree content provider.
 */
class LoopTreeProviderState implements ProjectContentProviderState {
  private _provider: LoopTreeProvider;
  constructor(provider: LoopTreeProvider) { this._provider = provider; }
  response: any;
  get provider (): LoopTreeProvider { return this._provider;}
  dispose(): any {}
}

/**
 * Provides a general information about analyzed project.
 */
export class LoopTreeProvider implements ProjectContentProvider{
  static scheme = "tsar-looptree";
  private _onDidChange = new vscode.EventEmitter<vscode.Uri>();
  private _engine: ProjectEngine;

  constructor(engine: ProjectEngine) { this._engine = engine; }
  dispose() { this._onDidChange.dispose(); }

  /**
   * Returns new description of a project content provider state.
   */
  state(): LoopTreeProviderState {
    return new LoopTreeProviderState(this);
  }

  /**
   * Informs listeners about content changes.
   *
   * If this provider has been registered after call of this method
   * provideTextDocumentContent() will be called to update visible content.
   */
  update(project: Project) {
    this._onDidChange.fire(encodeLocation(LoopTreeProvider.scheme, project.uri));
  }

  /**
   * Returns event to subscribe for content changes.
   */
  get onDidChange(): vscode.Event<vscode.Uri> {
    return this._onDidChange.event;
  }

  /**
   * Provides html with general information about analyzed project.
   */
  public provideTextDocumentContent(uri: vscode.Uri): Thenable<string>|string {
    let prjUri = <vscode.Uri>decodeLocation(uri).shift();
    let project = this._engine.project(prjUri);
    if (project === undefined)
      return unavailableHtml(prjUri);
    let state = <LoopTreeProviderState>project.providerState(LoopTreeProvider.scheme);
    if (project.response !== undefined &&
        project.response instanceof msg.FunctionList)
      state.response = project.response;
    let response = project.response;
    return new Promise((resolve, reject) => {
      if (response !== undefined && response instanceof msg.FunctionList) {
        return resolve(this._provideFunctionList(project, response));
      } else if (response !== undefined && response instanceof msg.LoopTree) {
        return resolve(this._provideLoopTree(project, response));
      }
      return resolve(waitHtml(log.FunctionList.title, project));
    });
  }

  private _provideFunctionList(project: Project, funclst: msg.FunctionList): string {
    //let result = `<!DOCTYPE html><html><head>${styleLink()}</head><body>`;
    //result += `<table><tr><th>Functions and Loops</th><th>Level</th></tr>`;
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
          <title>Functions and Loop Tree</title>
          <link href="${bootstrap}/css/bootstrap.min.css" rel="stylesheet">
        </head>
        <body>`;
    let bootstrapFooter =
      `   <script src="${jquery}/jquery.min.js"></script>
          <script src="${bootstrap}/js/bootstrap.min.js"></script>
        </body>
      </html>`
    let body =
      `   <table class="table table-hover">
            <tr><th>Functions and Loops</th><th>Level</th></tr>`;
    let funclen = funclst.Functions.length;
    for (let i = 0; i < funclen; i++) {
      let func = funclst.Functions[i];
      let looplen = func.Loops.length;
      if (looplen) {
        body += `<tr><td>${commandLink('tsar.loop.tree', project, 'Loops', '-', `${func.ID}`)}${func.Name}</th><td>0</td></tr>`;
      } else {
        body += `<tr><td>${commandLink('tsar.loop.tree', project, 'Loops', '+', `${func.ID}`)}${func.Name}</th><td>0</td></tr>`;
      }
      for (let j = 0; j < looplen; j++) {
        let loop = func.Loops[j];
        body += `<tr><td>`;
        for (let k = 0; k < loop.Level; k++) {
          body += `&emsp;`;
        }
        if ((loop.StartLocation.Line == loop.StartLocation.MacroLine) &&
            (loop.StartLocation.Column == loop.StartLocation.MacroColumn)) {
          body += `loop in ${func.Name} at ${loop.StartLocation.Line}:${loop.StartLocation.Column}
              - ${loop.EndLocation.Line}:${loop.EndLocation.Column}</td><td>${loop.Level}</td></tr>`;
        } else {
          body += `loop in ${func.Name} at ${loop.StartLocation.Line}:${loop.StartLocation.Column}
              (${loop.StartLocation.MacroLine}:${loop.StartLocation.MacroColumn})
              - ${loop.EndLocation.Line}:${loop.EndLocation.Column}
              (${loop.EndLocation.MacroLine}:${loop.EndLocation.MacroColumn})</td><td>${loop.Level}</td></tr>`;
        }
      }
    }
    body += `</table>`;
    return bootstrapHeader + body + bootstrapFooter;
  }

  private _provideLoopTree(project: Project, func: msg.LoopTree): string {
    let state = <LoopTreeProviderState>project.providerState(LoopTreeProvider.scheme);
    let funclist: msg.FunctionList = state.response;
    let funclen = funclist.Functions.length;
    for (let i = 0; i < funclen; i++) {
      if (funclist.Functions[i].ID != func.ID)
        continue;
      funclist.Functions[i].Loops = func.Loops;
      return this._provideFunctionList(project, funclist);
    }
    return `<!DOCTYPE html><html></html>`;
  }
}