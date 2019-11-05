//===--- calleeFunc.ts ------- Call Graph Provider ---------- TypeScript --===//
//
//                           TSAR Advisor (SAPFOR)
//
// This file implements provider to show call graph or its subgraph which
// produces some traits of analyzed project.
//
//===----------------------------------------------------------------------===//

'use strict';

import * as vscode from 'vscode';
import * as path from 'path';
import {UpdateUriFunc, commandLink, getStrLocation} from './functions';
import * as log from './log';
import * as msg from './messages';
import * as lt from './loopTree';
import {Project} from './project';
import {ProjectWebviewProviderState,
  ProjectWebviewProvider} from './webviewProvider';

export class CalleeFuncProviderState extends ProjectWebviewProviderState<CalleeFuncProvider> {
  set data(obj: any) { this._data = obj; }
  onResponse(response: any): Thenable<any> {
    return new Promise(resolve => {
      if (response === undefined)
        resolve(this._data);
      if (this._data.ID == '') {
        for (let i = 0; i < response.Functions.length; i++) {
          this._data.Functions[i] = response.Functions[i];
          this._data.Functions[i].Level = 0;
        }
      } else {
        let functions: msg.CalleeFuncInfo [] = [];
        let idx = 0;
        while (this._data.ID != this._data.Functions[idx].ID)
          functions.push(this._data.Functions[idx++]);
        functions.push(this._data.Functions[idx]);
        for (let i = 0; i < response.Functions.length; i++) {
          response.Functions[i].Level = this._data.Functions[idx].Level + 1;
          response.Functions[i].ID = this._data.Functions[idx].ID + response.Functions[i].ID;
          functions.push(response.Functions[i]);
        }
        idx++;
        while (idx != this._data.Functions.length)
          functions.push(this._data.Functions[idx++]);
        this._data.Functions = functions;
      }
      resolve(this._data);
    });
  }
}

export class CalleeFuncProvider extends ProjectWebviewProvider {
  static scheme = "tsar-calleefunc";

  public scheme(): string { return CalleeFuncProvider.scheme; }

  public state(): CalleeFuncProviderState {
    return new CalleeFuncProviderState(this);
  }

  protected _title(): string { return log.CalleeFunc.title; }

  protected _needToHandle(response: any): boolean {
    return response instanceof msg.CalleeFuncList;
  }

  protected _provideContent(project: Project, calleefunclist: msg.CalleeFuncList, asWebvwieUri: UpdateUriFunc): string {
    let bootstrap = asWebvwieUri(vscode.Uri.file(
        path.resolve(__dirname, '..', '..', 'node_modules', 'bootstrap', 'dist')));
    let jquery = asWebvwieUri(vscode.Uri.file(
        path.resolve(__dirname, '..', '..', 'node_modules', 'jquery', 'dist')));
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
    let body = `<ul>`;
    let funclen = calleefunclist.Functions.length;
    for (let i = 0; i < funclen; i++) {
      let sublevel = 0;
      if (i != funclen - 1)
        sublevel = calleefunclist.Functions[i].Level - calleefunclist.Functions[i + 1].Level;
      if (sublevel < 0) {
        body += `<li>${calleefunclist.Functions[i].Name}</li><ul>`;
      } else {
        let looptreestate = <ProjectWebviewProviderState<lt.LoopTreeProvider>>project.providerState(lt.LoopTreeProvider.scheme);
        let funclist = looptreestate.data;
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
