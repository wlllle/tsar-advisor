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
import {UpdateUriFunc, gotoExpansionLocLink, headHtml} from './functions';
import * as log from './log';
import * as msg from './messages';
import {Project} from './project';
import {ProjectWebviewProviderState,
  ProjectWebviewProvider} from './webviewProvider';

interface Target {
  FuncID: number;
  LoopID: number;
  Attr: msg.StatementAttr [];
}

interface Data {
  Target: Target,
  Complete: boolean,
  Functions: Map<number, msg.Function>,
  CallGraph: Map<msg.Function|msg.Loop, msg.CalleeFuncInfo[]>
}

export class CalleeFuncProviderState extends ProjectWebviewProviderState<CalleeFuncProvider> {
  actual(request: any): boolean {
    if (request instanceof msg.FunctionList)
      return this.data !== undefined &&
             this.data.functions !== undefined;
    return false;
  }

  get active(): boolean { return super.active }

  set active(is: boolean) {
    if (!is && this._data !== undefined) {
      let data = this._data as Data;
      data.Target = undefined;
      data.CallGraph = undefined;
      data.Complete = false;
    }
    super.active = is;
  }

  onResponse(response: any, project: Project): Thenable<Data|undefined> {
    return new Promise(resolve => {
      if (response === undefined) {
        if (this.data !== undefined && this.data.Complete)
          return resolve(this.data);
        return resolve(undefined);
      }
      // Remember list of functions for further usage.
      if (response instanceof msg.FunctionList) {
        // We receive a new list of functions, so dropout a constructed graph
        // because it may be out of data.
        this.active = false;
        let functions = new Map<number, msg.Function>();
        for (let f of response.Functions)
          functions.set(f.ID, f);
        let data:Data = {
          Target: undefined,
          Functions: functions,
          Complete: false,
          CallGraph: undefined};
        this._data = data;
        return resolve(undefined);
      }
      if (response instanceof msg.CalleeFuncList) {
        // We should build call graph however there is no information about
        // functions. So, let us send corresponding requests to the server.
        if (this._data === undefined ||
            (this._data as Data).Functions === undefined) {
          let data:Data = {
            Target: {
              FuncID: response.FuncID,
              LoopID: response.LoopID,
              Attr: response.Attr
            },
            Complete: false,
            Functions: undefined,
            CallGraph: new Map<msg.Function|msg.Loop, msg.CalleeFuncInfo[]>()
          };
          this._data = data;
          vscode.commands.executeCommand('tsar.function.list', project.uri);
          vscode.commands.executeCommand('tsar.loop.tree',
            project.uri.with({query: JSON.stringify({ID: data.Target.FuncID})}));
          // It is also necessary to repeat current request to remember list of callees.
          let request = new msg.CalleeFuncList();
          Object.assign(request, data.Target);
          project.send(request);
          return resolve(undefined);
        }
        // List of functions is available, so try to build call graph.
        let info = this._data as Data;
        let targetObj:msg.Function|msg.Loop = info.Functions.get(response.FuncID);
        if (info.Target === undefined) {
          info.Target = {
            FuncID: response.FuncID,
            LoopID: response.LoopID,
            Attr: response.Attr
          }
          info.CallGraph = new Map<msg.Function|msg.Loop, msg.CalleeFuncInfo[]>();
          if (response.LoopID)
            targetObj = targetObj.Loops.find(l=> { return l.ID == response.LoopID});
          if (targetObj === undefined) {
            // We should build a call graph for a loop. However, there is no description
            // of a required loop. So, let us send a corresponding request to the server.
            vscode.commands.executeCommand('tsar.loop.tree',
              project.uri.with({query: JSON.stringify({ID: this._data.target.FuncID})}));
            // It is also necessary to repeat current request to remember list of callees.
            let request = new msg.CalleeFuncList();
            Object.assign(request, info.Target);
            return resolve(undefined);
          }
        }
        if (!info.CallGraph.has(targetObj))
          info.CallGraph.set(targetObj, response.Functions);
        for (let callees of info.CallGraph.values())
          for (let callee of callees)
            if (callee.Kind == msg.StatementKind.Call && callee.CalleeID &&
                !info.CallGraph.has(info.Functions.get(callee.CalleeID))) {
              let request = new msg.CalleeFuncList;
              request.FuncID = callee.CalleeID;
              request.Attr = info.Target.Attr;
              request.LoopID = 0;
              project.send(request);
              return resolve(undefined);
            }
        info.Complete = true;
        return resolve(this._data);
      }
      resolve(undefined);
    });
  }
}

function isFunction(obj: msg.Function|msg.Loop): obj is msg.Function {
    return (obj as msg.Function).Loops !== undefined;
}

export class CalleeFuncProvider extends ProjectWebviewProvider {
  static scheme = "tsar-calleefunc";

  public scheme(): string { return CalleeFuncProvider.scheme; }

  public state(): CalleeFuncProviderState {
    return new CalleeFuncProviderState(this);
  }

  protected _title(): string { return log.CallGraph.title; }

  protected _needToHandle(response: any): boolean {
    return response instanceof msg.CalleeFuncList ||
      response instanceof msg.FunctionList;
  }

  protected _provideContent(project: Project, info: Data, asWebvwieUri: UpdateUriFunc): string {
    let state = project.providerState(
      CalleeFuncProvider.scheme) as CalleeFuncProviderState;
    let panel = state.panel;
    // Implement Go To command. Note, that identifier for a function
    // must be a number represented as a string. The first symbol
    // for other identifiers must be '.'. For such objects Go To
    // command is not supported at this moment.
    panel.webview.onDidReceiveMessage(message => {
      switch(message.command) {
        case 'goto':
          if ((<string>message.func).startsWith('.', 0))
            break;
          let f = info.Functions.get(Number(message.func));
          if (f.User)
            vscode.commands.executeCommand('tsar.open-project',
              project.uri.with({
                query: JSON.stringify({
                  Line: f.StartLocation.Line,
                  Column: f.StartLocation.Column
                })
              }));
          break;
      }
    }, null, state.disposables);
    let targetFunc = info.Functions.get(info.Target.FuncID);
    let targetObj:msg.Function|msg.Loop = targetFunc;
    let gotoTarget = '';
    if (info.Target.LoopID) {
      targetObj = targetFunc.Loops.find(l=> { return l.ID == info.Target.LoopID});
      gotoTarget = `loop at ${gotoExpansionLocLink(project, targetObj.StartLocation)} in `;
    }
    gotoTarget += `<var>${targetFunc.Name}</var> declared at ` +
      gotoExpansionLocLink(project, targetFunc.StartLocation);
    // Build array of nodes and edges.
    let nodes = '';
    let edges = '';
    let edgeNumber = 0; // use to set id of a new edge
    let stmtNodes = []; // nodes for statements like goto, break, etc.
    info.CallGraph.forEach((callees, caller) => {
       let callerID = `${caller.ID}`;
       if (caller == targetObj) {
         if (caller == targetFunc) {
           nodes += `{id: '${targetFunc.ID}', label: '${targetFunc.Name}'`;
         } else {
           callerID = `.${targetFunc.ID}.${targetObj.ID}`;
           nodes += `{id: '${callerID}', label: 'loop'`;
         }
         nodes += ',color: "darkorange"';
       } else {
        let f = caller as msg.Function;
        nodes += `{id: '${callerID}', label: '${f.Name}'`;
        if (!f.User)
          nodes += ',color: "lightgrey"';
        else if (f.Traits.Parallel === 'Yes')
          nodes += ',color: "lightgreen"';
        else
          nodes += ',color: "lightcoral"';
       }
       nodes += "},";
       for (let callee of callees) {
         ++edgeNumber;
         let calleeID = `${callee.CalleeID}`;
         // Create node for statement like goto, break etc. if a node is not exist.
         if (callee.Kind != msg.StatementKind.Call || !callee.CalleeID) {
           calleeID = '.' + msg.StatementKind[callee.Kind];
           stmtNodes[callee.Kind] = `{id: '${calleeID}',` +
             `label: '${msg.StatementKind[callee.Kind].toLocaleLowerCase()}', color: "lightsalmon"},`;
         }
         edges += `{id: ${edgeNumber}, from: '${callerID}', to: '${calleeID}'`;
         // Add property to Go To a corresponding statement in a source code from webview.
         if (callee.StartLocation.length > 0 &&
             (!isFunction(caller) || caller.User)) {
          edges += `,location: [`;
          for (let loc of callee.StartLocation) {
            let goto = encodeURI('command:tsar.open-project?' +
              JSON.stringify(project.uri.with({
                query: JSON.stringify({
                  Line: loc.Line,
                  Column: loc.Column
                })
              })));
            edges += `
              {
                Goto: '${goto}',
                Filename: '${project.prjname}',
                Line: ${loc.Line},
                Column: ${loc.Column}
              },`;
           }
          // Remove last comma.
          edges = edges.substr(0, edges.length - 1);
          edges += ']';
        }
        edges += '},';
       }
    });
    for (let n of stmtNodes)
      if (n)
        nodes += n;
    // Remove last comma.
    nodes = nodes.substr(0, nodes.length - 1);
    edges = edges.substr(0, edges.length - 1);
    let subtitle = '';
    if (info.Target.Attr) {
      if (info.Target.Attr.length == 1) {
        switch (info.Target.Attr[0]) {
          case msg.StatementAttr.InOut: subtitle = log.CallGraph.io; break;
          case msg.StatementAttr.Exit: subtitle = log.CallGraph.exit; break;
          case msg.StatementAttr.UnsafeCFG: subtitle = log.CallGraph.unsafeCFG; break;
        }
      } else if (info.Target.Attr.length > 0) {
        subtitle = log.CallGraph.unsafeCFG
        for (let attr of info.Target.Attr)
          if (attr != msg.StatementAttr.UnsafeCFG && attr != msg.StatementAttr.MayNoReturn &&
              attr != msg.StatementAttr.MayReturnTwice && attr != msg.StatementAttr.MayUnwind) {
              subtitle = '';
              break;
          }
       }
    }
    return `
      <!doctype html>
      <html lang="en">
        ${headHtml(asWebvwieUri, {bootstrap: true, visNetwork: true})}
        <body class="bg-light">
          <div class="container-fluid pt-4" style="height:100%">
            <h3>${this._title().replace('{0}', gotoTarget)}</h3>
            <h5>${subtitle}</h5>
            <div class="row" style="height:100%">
              <div class="col-9" style="height:100%">
                <div id="callGraph" style="height:90%"}></div>
              </div>
              <div id="callInfo" class="col-3"></div>
            </div>
          </div>
          <script type="text/javascript">
            var nodes = new vis.DataSet([${nodes}]);
            var edges = new vis.DataSet([${edges}]);
            var container = document.getElementById('callGraph');
            var data = {
              nodes: nodes,
              edges: edges
            };
            var options = {
              edges:{
                arrows: {
                  to: {
                    enabled: true,
                    type: "arrow"
                  }
                }
              }
            };
            var network = new vis.Network(container, data, options);
            const vscode = acquireVsCodeApi();
            network.on('doubleClick', selected => {
              if (!selected.nodes || selected.nodes.length == 0)
                return;
              let nodeID = selected.nodes[0];
              vscode.postMessage({ command: 'goto', func: nodeID});
            });
            network.on('click', selected => {
              const callInfo = document.getElementById('callInfo');
              if (!selected.edges || selected.edges.length != 1 ||
                  selected.nodes && selected.nodes.lengh > 0) {
                callInfo.innerHTML = '';
                return;
              }
              let e = edges.get(selected.edges[0]);
              if (!e.location) {
                callInfo.innerHTML = '';
                return;
              }
              const from = nodes.get(e.from);
              const to = nodes.get(e.to);
              let html = '<h6>${log.CallGraph.callList} from <var>' +
                from.label + '</var> to <var>' + to.label + '</var></h6>' +
                '<div class="mt-2 ml-2">';
              html += '<ul class="list-unstyled">';
              for (let loc in e.location) {
                html += '<li>';
                html += '<a class="source-link" title="${log.Command.gotoCode}"' +
                  'href="' + e.location[loc].Goto + '">';
                html += e.location[loc].Filename + ':' +
                  e.location[loc].Line + ':' + e.location[loc].Column;
                html += '</a>';
                html += '</li>';
              }
              html += '</ul></div>';
              callInfo.innerHTML = html;
            });
          </script>
        </body>
      </html>`;
  }
}
