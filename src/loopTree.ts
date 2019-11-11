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
import {headHtml, UpdateUriFunc, commandLink,
  gotoExpansionLocLink, DisposableLikeList} from './functions';
import * as log from './log';
import * as msg from './messages';
import {Project, ProjectEngine} from './project';
import {ProjectWebviewProviderState,
  ProjectWebviewProvider} from './webviewProvider';

export function registerCommands(engine: ProjectEngine, subscriptions: DisposableLikeList) {
  let showFuncList = vscode.commands.registerCommand('tsar.function.list',
    (uri:vscode.Uri) => {
      let project = engine.project(uri);
      let state = project.providerState(LoopTreeProvider.scheme);
      state.active = true;
      let request = new msg.FunctionList;
      if (!state.actual(request))
        project.send(request);
    });
  let showLoopTree = vscode.commands.registerCommand('tsar.loop.tree',
    (uri:vscode.Uri) => {
      let project = engine.project(uri);
      let state = project.providerState(LoopTreeProvider.scheme);
      state.active = true;
      let looptree = new msg.LoopTree;
      let query = JSON.parse(uri.query);
      looptree.FunctionID = query.ID;
      if (!state.actual(looptree))
        project.send(looptree);
    });
  subscriptions.push(showFuncList, showLoopTree);
 }

interface Info {
  ShowSubtree: boolean;
  Function: msg.Function;
};

interface Data {
  FunctionList: msg.FunctionList;
  Info: Map<msg.Function|msg.Loop,Info>;
};

class LoopTreeProviderState extends ProjectWebviewProviderState<LoopTreeProvider> {
  actual(request: any): boolean {
    if (request instanceof msg.FunctionList)
      return this.data !== undefined;
    if (request instanceof msg.LoopTree) {
      let f = (this._data as Data).FunctionList.Functions.find(
        f => { return f.ID == request.FunctionID});
      return f === undefined ||
        (f.Loops != undefined && f.Loops.length > 0);
    }
    return false;
  }

  onResponse(response: any): Thenable<any> {
    return new Promise(resolve => {
      if (response !== undefined) {
        if (response instanceof msg.FunctionList) {
          this._data = {
            FunctionList: response,
            Info: new Map<any, Info>()
          };
        } else if (this._data != undefined) {
          // Add loop tree to the function representation.
          let looptree = response as msg.LoopTree;
          for (let f of (this._data as Data).FunctionList.Functions) {
            if (f.ID != looptree.FunctionID)
              continue;
            f.Loops = looptree.Loops;
            this.setSubtreeHidden(false, f);
            break;
          }
        }
      }
      resolve(this._data !== undefined
        ? (this._data as Data).FunctionList 
        : undefined);
    });
  }

  public setSubtreeHidden(hidden: boolean, f: msg.Function, l: msg.Loop = undefined) {
    let key = l === undefined ? f : l;
    let info = (this._data as Data).Info.get(key);
    if (info === undefined)
      (this._data as Data).Info.set(key, {ShowSubtree: !hidden, Function: f});
    else
      info.ShowSubtree = !hidden;
  }

  public isSubtreeHidden(obj: msg.Function|msg.Loop): boolean {
    let info = (this._data as Data).Info.get(obj);
    return info === undefined || !info.ShowSubtree;
  }
}

function isFunction(obj: msg.Function|msg.Loop): obj is msg.Function {
    return (obj as msg.Function).Loops !== undefined;
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

  protected _provideContent(project: Project, funclst: msg.FunctionList,
      asWebviewUri: UpdateUriFunc): string {
    let state = project.providerState(
      LoopTreeProvider.scheme) as LoopTreeProviderState;
    this._registerListeners(state, funclst);
    let linkInOut = {
      command: 'tsar.callee.func',
      project: project,
      title: log.CallGraph.io,
      body: '',
      query: {Attr: [msg.StatementAttr.InOut]}
    };
    let linkUnsafeCFG = {
      command: 'tsar.callee.func',
      project: project,
      title: log.CallGraph.unsafeCFG,
      body: '',
      query: {Attr: [msg.StatementAttr.UnsafeCFG]}
    };
    let linkExit = {
      command: 'tsar.callee.func',
      project: project,
      title: log.CallGraph.exit,
      body: '',
      query: {Attr: [msg.StatementAttr.Exit]}
    };
    let body = `
    <!doctype html>
    <html lang="en">
      ${headHtml(asWebviewUri)}
      <body>`;
    body +=`
      <script>
        const vscode = acquireVsCodeApi();
        window.addEventListener('message', event => {
          const message = event.data;
          switch (message.command) {
            case 'Subtree':
              const id = '#loopTree-' + message.func +
                ('loop' in message ? '-' + message.loop : '');
              if (message.hide === 'true')
                $(id).collapse('hide');
              else
                $(id).collapse('show');
              break;
          }
      });
      </script>`;
    body +=`
      <div class="row font-weight-bolder border-bottom py-3 text-center">
        <div class="col-4 text-left border-right">Functions and Loops</div>
        <div class="col-1">Parallel</div>
        <div class="col-1">Canonical</div>
        <div class="col-1">Perfect</div>
        <div class="col-1">Exit</div>
        <div class="col-1">IO</div>
        <div class="col-1">Readonly</div>
        <div class="col-1">Unsafe CFG</div>
      </div>`;
    for (let func of funclst.Functions) {
      if (!func.User)
        continue;
      linkInOut.query['FuncID'] = func.ID;
      linkInOut.query['LoopID'] = 0;
      linkUnsafeCFG.query['FuncID'] = func.ID;
      linkUnsafeCFG.query['LoopID'] = 0;
      linkExit.query['FuncID'] = func.ID;
      linkExit.query['LoopID'] = 0;
      linkExit.body = func.Exit === null ? '?' : func.Exit.toString();
      body += `
      <div class="row py-2 text-center border-bottom table-row
           ${func.Traits.Parallel == 'Yes' ? 'table-row-success' : ''}">
        <div class="col-4 text-left border-right">`;
      if (func.Traits.Loops == "Yes")
        if (!func.Loops.length) {
          body += commandLink({
            command: 'tsar.loop.tree',
            project,
            title: log.FunctionList.loopTree.replace('{0}', log.FunctionList.build),
            body: '&plus;',
            query: JSON.stringify({ ID: func.ID })
          });
        } else {
          let isSubtreeHidden = state.isSubtreeHidden(func);
          body += `
          <a id="collapse-loopTree-${func.ID}"
              class = "source-link"
              title="${log.FunctionList.loopTree.replace('{0}',
                         isSubtreeHidden ? log.FunctionList.show 
                                         : log.FunctionList.hide)}"
              data-toggle="collapse" href="#loopTree-${func.ID}" role="button"
              aria-expanded="${isSubtreeHidden ? 'false': 'true'}"
              aria-controls="loopTree-${func.ID}">
            ${isSubtreeHidden ? '&plus;' : '&minus;'}
          </a>`;
        }
      body += `
          <var>${func.Name}</var> at
          ${gotoExpansionLocLink(project, func.StartLocation)}
          &minus;${gotoExpansionLocLink(project, func.EndLocation)}
        </div>
        <div class="col-1">${this._checkTrait(func.Traits.Parallel)}</div>
        <div class="col-1"></div>
        <div class="col-1"></div>
        <div class="col-1">${func.Exit !== null ? commandLink(linkExit) : '?'}</div>
        <div class="col-1">
          ${this._checkTrait(func.Traits.InOut, func.Exit !== null ? linkInOut : undefined)}
        </div>
        <div class="col-1">${this._checkTrait(func.Traits.Readonly)}</div>
        <div class="col-1">
          ${this._checkTrait(func.Traits.UnsafeCFG, func.Exit !== null ? linkUnsafeCFG : undefined)}
        </div>
      </div>`;
      if (func.Traits.Loops == "No" || !func.Loops.length)
        continue;
      body +=`
      <div class="collapse ${state.isSubtreeHidden(func) ? '' : 'show'}"
           id="loopTree-${func.ID}">`;
      body +=`
      <script>
        (function () {
          const loopTree = $('#loopTree-${func.ID}');
          const button = document.getElementById('collapse-loopTree-${func.ID}');
          loopTree.on('hidden.bs.collapse', function () {
            if ($(this).hasClass("show"))
              return;
            button.title = '${log.FunctionList.loopTree.replace('{0}', log.FunctionList.show)}';
            button.innerHTML = '&plus;';
            vscode.postMessage({ command: 'Subtree', hide: 'true', func: '${func.ID}'});
          });
          loopTree.on('shown.bs.collapse', function () {
            if (!$(this).hasClass("show"))
              return;
            button.title = '${log.FunctionList.loopTree.replace('{0}', log.FunctionList.hide)}';
            button.innerHTML = '&minus;';
            vscode.postMessage({ command: 'Subtree', hide: 'false', func: '${func.ID}'});
          });
        }())
      </script>`;
      let currentLevel = 1;
      for (let idx = 0; idx < func.Loops.length; ++idx) {
        let loop = func.Loops[idx];
        linkInOut.query['LoopID'] = loop.ID;
        linkUnsafeCFG.query['LoopID'] = loop.ID;
        linkExit.query['LoopID'] = loop.ID;
        linkExit.body = loop.Exit === null ? '?' : loop.Exit.toString();
        if (loop.Level > currentLevel) {
          let parentLoop = func.Loops[idx - 1];
          body += `
          <div class="collapse ${state.isSubtreeHidden(parentLoop) ? '' : 'show'}"
               id="loopTree-${func.ID}-${func.Loops[idx - 1].ID}">`;
          body += `
          <script>
            (function () {
              const loopTree = $('#loopTree-${func.ID}-${parentLoop.ID}');
              const button = document.getElementById(
                'collapse-loopTree-${func.ID}-${parentLoop.ID}');
              loopTree.on('hidden.bs.collapse', function () {
                if ($(this).hasClass("show"))
                  return;
                button.title = '${log.FunctionList.loopTree.replace('{0}', log.FunctionList.show)}';
                button.innerHTML = '&plus;';
                vscode.postMessage({
                  command: 'Subtree',
                  hide: 'true',
                  func: '${func.ID}',
                  loop: '${parentLoop.ID}'
                });
              });
              loopTree.on('shown.bs.collapse', function () {
                if (!$(this).hasClass("show"))
                  return;
                button.title = '${log.FunctionList.loopTree.replace('{0}', log.FunctionList.hide)}';
                button.innerHTML = '&minus;';
                vscode.postMessage({
                  command: 'Subtree',
                  hide: 'false',
                  func: '${func.ID}',
                  loop: '${parentLoop.ID}'
                });
              });
            }())
          </script>`;
          ++currentLevel;
        } else if (loop.Level < currentLevel) {
          body += `</div>`;
          --currentLevel;
        }
        body += `
        <div class="row py-2 text-center border-bottom table-row
                    ${loop.Traits.Parallel == 'Yes' ? 'table-row-success' : ''}">
          <div class="col-4 text-left border-right">
            ${'&emsp;'.repeat(loop.Level)}`;
        if (idx < func.Loops.length - 1 && func.Loops[idx + 1].Level > loop.Level) {
          let isSubtreeHidden = state.isSubtreeHidden(loop);
          body += `
            <a id="collapse-loopTree-${func.ID}-${loop.ID}"
               class="source-link"
               title="${log.FunctionList.loopTree.replace('{0}',
                          isSubtreeHidden ? log.FunctionList.show
                                          : log.FunctionList.hide)}"
               data-toggle="collapse" href="#loopTree-${func.ID}-${loop.ID}" role="button"
               aria-expanded="${isSubtreeHidden ? 'false': 'true'}"
               aria-controls="loopTree-${func.ID}-${loop.ID}">
              ${isSubtreeHidden ? '&plus;' : '&minus;'}
            </a>`;
        }
        body += `
            <var>${loop.Type.toLowerCase()}</var> loop in <var>${func.Name}</var> at
              ${gotoExpansionLocLink(project, loop.StartLocation)}
              &minus;${gotoExpansionLocLink(project, loop.EndLocation)}
          </div>
          <div class="col-1 ">
            ${this._checkTrait(loop.Traits.Parallel)}
          </div>
          <div class="col-1">${this._checkTrait(loop.Traits.Canonical)}</div>
          <div class="col-1">${this._checkTrait(loop.Traits.Perfect)}</div>
          <div class="col-1">${loop.Exit !== null ? commandLink(linkExit) : ''}</div>
          <div class="col-1">
            ${this._checkTrait(loop.Traits.InOut,
               loop.Exit !== null ? linkInOut : undefined)}
           </div>
          <div class="col-1"></div>
          <div class="col-1">
            ${this._checkTrait(loop.Traits.UnsafeCFG,
               loop.Exit !== null ? linkUnsafeCFG : undefined)}
          </div>
        </div>`;
      }
      body += `</div>`;
    }
    body += `</body></html>`;
    return body;
  }

  private _registerListeners(state: LoopTreeProviderState, funclst: msg.FunctionList) {
    let panel = state.panel;
    panel.webview.onDidReceiveMessage(message => {
      switch(message.command) {
        case 'Subtree':
          let f = funclst.Functions.find(f => { return f.ID == message.func});
          if (!('loop' in message))
            state.setSubtreeHidden(message.hide === 'true', f);
          else
            state.setSubtreeHidden(message.hide === 'true',
              f, f.Loops.find(l => { return l.ID == message.loop}));
          break;
      }
    }, null, state.disposables);
    panel.onDidChangeViewState(e => {
      const panel = e.webviewPanel;
      if (!panel.visible)
        return;
      for (let [key,value] of (state.data as Data).Info) {
        if (isFunction(key))
          panel.webview.postMessage({
            command: 'Subtree',
            func: key.ID,
            hide: `${!value.ShowSubtree}`
          });
        else
          panel.webview.postMessage({
            command: 'Subtree',
            func: value.Function.ID,
            loop: key.ID,
            hide: `${!value.ShowSubtree}`
          });
      }
    }, null, state.disposables);
  }

  private _checkTrait(trait: string, commandJSON:any = undefined): string {
    if (trait === "Yes") {
      if (commandJSON !== undefined) {
        commandJSON.body = `&#10003`;
        return commandLink(commandJSON);
      }
      return `&#10003;`;
    }
    return `&minus;`;
  }
}
