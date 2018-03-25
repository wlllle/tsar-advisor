'use strict'

import * as vscode from 'vscode';
import * as path from 'path';
import {decodeLocation, encodeLocation,
  projectLink, moveToCode, commandLink, numberHtml, styleLink,
  unavailableHtml, waitHtml, checkTrait, getStrLocation} from './functions';
import * as log from './log';
import * as msg from './messages';
import * as lt from './loopTree';
import {ProjectEngine, Project,
  ProjectContentProvider, ProjectContentProviderState} from './project';

export class CalleeFuncProviderState implements ProjectContentProviderState {
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
    let response = project.response;
    return new Promise((resolve, reject) => {
      if (response !== undefined && response instanceof msg.CalleeFuncList) {
        return resolve(this._provideCalleeFunc(project, response));
      } else if (state.response !== undefined) {
        return resolve(this._provideCalleeFunc(project, state.response));
      }
      return resolve(waitHtml(log.CalleeFunc.title, project));
    });
  }

  private _provideCalleeFunc(project: Project, msgfunclist: msg.CalleeFuncList): string {
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
    let state = <CalleeFuncProviderState>project.providerState(CalleeFuncProvider.scheme);
    let calleefunclist: msg.CalleeFuncList = state.response;
    if (calleefunclist.ID == '') {
      for (let i = 0; i < msgfunclist.Functions.length; i++) {
        calleefunclist.Functions[i] = msgfunclist.Functions[i];
        calleefunclist.Functions[i].Level = 0;
      }
    } else {
      let functions: msg.CalleeFuncInfo [] = [];
      let idx = 0;
      while (calleefunclist.ID != calleefunclist.Functions[idx].ID)
        functions.push(calleefunclist.Functions[idx++]);
      functions.push(calleefunclist.Functions[idx]);
      for (let i = 0; i < msgfunclist.Functions.length; i++) {
        msgfunclist.Functions[i].Level = calleefunclist.Functions[idx].Level + 1;
        msgfunclist.Functions[i].ID = calleefunclist.Functions[idx].ID + msgfunclist.Functions[i].ID;
        functions.push(msgfunclist.Functions[i]);
      }
      idx++;
      while (idx != calleefunclist.Functions.length)
        functions.push(calleefunclist.Functions[idx++]);
      calleefunclist.Functions = functions;
    }
    state.response = calleefunclist;
    let body = `<ul>`;
    let funclen = calleefunclist.Functions.length;
    for (let i = 0; i < funclen; i++) {
      let sublevel = 0;
      if (i != funclen - 1)
        sublevel = calleefunclist.Functions[i].Level - calleefunclist.Functions[i + 1].Level;
      if (sublevel < 0) {
        body += `<li>${calleefunclist.Functions[i].Name}</li><ul>`;
      } else {
        let looptreestate = <lt.LoopTreeProviderState>project.providerState(lt.LoopTreeProvider.scheme);
        let funclist = looptreestate.response;
        let id = 0;
        for (let j = 0; j < funclist.Functions.length; j++)
          if (funclist.Functions[j].Name == calleefunclist.Functions[i].Name)
            id = funclist.Functions[j].ID;
        if (id) {
          let query = {ID: calleefunclist.Functions[i].ID, FuncID: id, LoopID: 0, Attr: calleefunclist.Attr};
          body += `<li>` +
              `${commandLink('tsar.callee.func', project, 'CalleeFunc', '+', JSON.stringify(query))}` +
              `${calleefunclist.Functions[i].Name}`;
        } else {
          body += `<li>${calleefunclist.Functions[i].Name}`;
        }
        body += `\t` + getStrLocation(project, calleefunclist.Functions[i].Locations[0]);
        for (let j = 1; j < calleefunclist.Functions[i].Locations.length; j++)
          body += `, ` + getStrLocation(project, calleefunclist.Functions[i].Locations[j]);
        body += `</li>`;
        if (sublevel > 0)
          for (let i = 0; i < sublevel; i++)
            body += `</ul>`;
      }
    }
    body += `</ul>`;
    return bootstrapHeader + body + bootstrapFooter;
  }
}
