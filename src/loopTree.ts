//===- loopTree.ts --------------- Loop Tree Provider ------- TypeScript --===//
//
//                           TSAR Advisor (SAPFOR)
//
// This file implements provider to show list of functions in a project and
// a loop tree for each function. Some general trais are also shown.
//
//===----------------------------------------------------------------------===//

'use strict';

import * as vscode from 'vscode';
import * as path from 'path';
import {UpdateUriFunc, commandLink, checkTrait,
  getStrLocation} from './functions';
import * as log from './log';
import * as msg from './messages';
import {Project} from './project';
import {ProjectWebviewProviderState,
  ProjectWebviewProvider} from './webviewProvider';

class LoopTreeProviderState extends ProjectWebviewProviderState<LoopTreeProvider> {
  get actual(): boolean { return this.data !== undefined; }

  onResponse(response: any): Thenable<any> {
    return new Promise(resolve => {
      if (response !== undefined) {
        if (response instanceof msg.FunctionList) {
          this._data = response;
        } else if (this._data != undefined) {
          // Add loop tree to the function representation.
          let looptree = response as msg.LoopTree;
          for (let f of (<msg.FunctionList>this._data).Functions) {
            if (f.ID != looptree.FunctionID)
              continue;
            f.Loops = looptree.Loops;
            break;
          }
        }
      }
      resolve(this._data);
    });
  }
}

/**
 * Provides a general information about analyzed project.
 */
export class LoopTreeProvider extends ProjectWebviewProvider {
  static scheme = "tsar-looptree";

  public scheme(): string { return LoopTreeProvider.scheme; }

  public state(): LoopTreeProviderState {
    return new LoopTreeProviderState(this);
  }

  protected _title(): string { return log.FunctionList.title; }

  protected _needToHandle(response: any): boolean {
    return response instanceof msg.FunctionList ||
      response instanceof msg.LoopTree;
  }

  protected _provideContent(project: Project, funclst: msg.FunctionList, asWebviewUri: UpdateUriFunc): string {
    let bootstrap = asWebviewUri(vscode.Uri.file(
      path.resolve(__dirname, '..', '..', 'node_modules', 'bootstrap', 'dist')));
    let jquery = asWebviewUri(vscode.Uri.file(
      path.resolve(__dirname, '..', '..', 'node_modules', 'jquery', 'dist')));
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
          <script src="${jquery}/jquery.min.js"></script>
          <script src="${bootstrap}/js/bootstrap.min.js"></script>
        </head>
        <body>`;
    let bootstrapFooter = `</body></html>`;
    let body =
      `   <table class="table table-hover">
            <tr><th>Functions and Loops</th><th>Canonical</th><th>Perfect</th><th>Exit</th>
            <th>IO</th><th>Readonly</th><th>UnsafeCFG</th></tr>`;
    let funclen = funclst.Functions.length;
    for (let i = 0; i < funclen; i++) {
      let func = funclst.Functions[i];
      let looplen = func.Loops.length;
      let linkInOut = {command: 'tsar.callee.func', project: project, title: 'View statements which perform in/out operations.',
          query: JSON.stringify({ID: '', FuncID: func.ID, Attr: [msg.StatementAttr.InOut]})};
      let linkUnsafeCFG = {command: 'tsar.callee.func', project: project, title: 'View statements which lead to unsafe control flow.',
          query: JSON.stringify({ID: '', FuncID: func.ID, Attr: [msg.StatementAttr.UnsafeCFG]})};
      let linkExit = {command: 'tsar.callee.func', project: project, title: 'View all possible exits from this region.',
          query: JSON.stringify({ID: '', FuncID: func.ID, Attr: [msg.StatementAttr.Exit]})};
      body += `<tr><td>`;
      if (looplen) {
        if (func.Loops[0].Hide)
          body += `${commandLink('tsar.expcol.looptree', project, 'Expand', '+',
              JSON.stringify({FuncID: func.ID, LoopID: 0, Hide: false}))}`;
        else
          body += `${commandLink('tsar.expcol.looptree', project, 'Collapse', '&minus;',
              JSON.stringify({FuncID: func.ID, LoopID: 0, Hide: true}))}`;
      } else if (func.Traits.Loops == "Yes") {
        body += `${commandLink('tsar.loop.tree', project, 'Loops', '+', JSON.stringify({ID: func.ID}))}`;
      }
      body += `${func.Name} ` + getStrLocation(project, func.StartLocation) + ` - ` +
          getStrLocation(project, func.EndLocation) + `</td>
          <td></td>
          <td></td>`;
      body += `<td>${commandLink('tsar.callee.func', project,
          linkExit.title, func.Exit === null ? '?' : func.Exit.toString(), linkExit.query)}</td>`;
      body += checkTrait(func.Traits.InOut, linkInOut) +
          checkTrait(func.Traits.Readonly) +
          checkTrait(func.Traits.UnsafeCFG, linkUnsafeCFG) + `</tr>`;
      for (let j = 0; j < looplen; j++) {
        let loop = func.Loops[j];
        if (loop.Hide == undefined && loop.Level != 1)
          loop.Hide = true;
        else if (loop.Hide == undefined && loop.Level == 1)
          loop.Hide = false;
      }
      let Hide = false;
      let PrevLevel = 0;
      for (let j = 0; j < looplen; j++) {
        let loop = func.Loops[j];
        if (Hide && loop.Level > PrevLevel)
          continue;
        if (loop.Hide) {
          Hide = true;
          PrevLevel = loop.Level;
          continue;
        }
        Hide = false;
        linkInOut.query = JSON.stringify(
            {ID: '', FuncID: func.ID, LoopID: loop.ID, Attr: [msg.StatementAttr.InOut]});
        linkUnsafeCFG.query = JSON.stringify(
            {ID: '', FuncID: func.ID, LoopID: loop.ID, Attr: [msg.StatementAttr.UnsafeCFG]});
        linkExit.query = JSON.stringify(
            {ID: '', FuncID: func.ID, LoopID: loop.ID, Attr: [msg.StatementAttr.Exit]});
        body += `<tr><td>`;
        for (let k = 0; k < loop.Level; k++) {
          body += `&emsp;`;
        }
        if (j != looplen - 1 && func.Loops[j + 1].Level > loop.Level) {
          if (func.Loops[j + 1].Hide)
            body += `${commandLink('tsar.expcol.looptree', project, 'Expand', '+',
                JSON.stringify({FuncID: func.ID, LoopID: loop.ID, Hide: false}))}`;
          else
            body += `${commandLink('tsar.expcol.looptree', project, 'Collapse', '&minus;',
                JSON.stringify({FuncID: func.ID, LoopID: loop.ID, Hide: true}))}`;
        }
        body += `loop in ${func.Name} at ` +
            getStrLocation(project, loop.StartLocation) + ` - ` +
            getStrLocation(project, loop.EndLocation) + `</td>` +
            checkTrait(loop.Traits.Canonical) + checkTrait(loop.Traits.Perfect);
        body += `<td>${commandLink('tsar.callee.func', project,
            linkExit.title, loop.Exit === null ? '?' : loop.Exit.toString(), linkExit.query)}</td>`;
        body += checkTrait(loop.Traits.InOut, linkInOut) +
            `<td></td>` +
            checkTrait(loop.Traits.UnsafeCFG, linkUnsafeCFG) +
            `</tr>`;
      }
    }
    body += `</table>`;
    return bootstrapHeader + body + bootstrapFooter;
  }
}
