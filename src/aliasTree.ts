
'use strict';

import * as vscode from 'vscode';
import { headHtml, UpdateUriFunc, DisposableLikeList } from './functions';
import { gotoExpansionLocLink } from './fileList';
import * as log from './log';
import * as msg from './messages';
import {Project, ProjectEngine} from './project';
import {ProjectWebviewProviderState,
  ProjectWebviewProvider} from './webviewProvider';

export function registerCommands(engine: ProjectEngine, subscriptions: DisposableLikeList) {
  let showAliasTree = vscode.commands.registerCommand('tsar.loop.alias',
    (uri:vscode.Uri) => {
      let project = engine.project(uri);
      let state = project.providerState(AliasTreeProvider.scheme);
      state.active = true;
      project.focus = state;
      let request = new msg.AliasTree;
      let query = JSON.parse(uri.query);
      request.FuncID = query.FuncID;
      request.LoopID = query.LoopID;
      if (!state.actual(request))
        project.send(request);
    });
  subscriptions.push(showAliasTree);
}

interface Data {
  Functions: Map<number, msg.Function>;
  AliasTree: msg.AliasTree;
}

class AliasTreeProviderState extends ProjectWebviewProviderState<AliasTreeProvider> {
  actual(request: any): boolean {
    if (request instanceof msg.FunctionList)
      return this.data !== undefined &&
             this.data.Functions !== undefined;
    return false;
  }

  onResponse(response: any, project: Project): Thenable<Data|undefined> {
    return new Promise(resolve => {
      if (response === undefined) {
        if (this.data !== undefined &&
            (this.data as Data).AliasTree !== undefined &&
            (this.data as Data).Functions !== undefined)
          return resolve(this.data);
        return resolve(undefined);
      }
      // Remember list of functions for further usage.
      if (response instanceof msg.FunctionList) {
        // We receive a new list of functions, so dropout a constructed alias tree
        // because it may be out of data.
        this.active = false;
        let functions = new Map<number, msg.Function>();
        for (let f of response.Functions)
          functions.set(f.ID, f);
        let data:Data = {
          Functions: functions,
          AliasTree: undefined
        };
        this._data = data;
        return resolve(undefined);
      }
      if (response instanceof msg.AliasTree) {
        // We should build alias tree however there is no information about
        // functions. So, let us send corresponding requests to the server.
        if (this._data === undefined ||
            (this._data as Data).Functions === undefined) {
          vscode.commands.executeCommand('tsar.function.list', project.uri);
          vscode.commands.executeCommand('tsar.loop.tree',
            project.uri.with({query: JSON.stringify({ID: response.FuncID})}));
          // It is also necessary to repeat current request to remember list of callees.
          let request = new msg.AliasTree();
          request.FuncID == response.FuncID;
          request.LoopID = response.LoopID;
          project.send(request);
          return resolve(undefined);
        }
        (this.data as Data).AliasTree = response
        return resolve(this.data);
      }
      if (this.data !== undefined &&
          (this.data as Data).AliasTree !== undefined &&
          (this.data as Data).Functions !== undefined)
        return resolve(this.data);
      return resolve(undefined);
    });
  }
}


export class AliasTreeProvider extends ProjectWebviewProvider {
  static scheme = "tsar-aliastree";

  public scheme(): string { return AliasTreeProvider.scheme; }

  public state(): AliasTreeProviderState {
    return new AliasTreeProviderState(this);
  }

  protected _title(): string { return log.AliasTree.title; }

  protected _needToHandle(response: any): boolean {
    return response instanceof msg.AliasTree ||
      response instanceof msg.FunctionList;
  }

  private _memoryInfo(project: Project, memory: msg.MemoryLocation [], separateTraits: {}) : [string, string[][]] {
    if (!memory)
     return ['', []];
    let label:string = '';
    let objs = new Map<number, string []>();
    for (let m of memory) {
      let info = `${m.Address}, ${m.Size > 0 ? m.Size : '?'}B`;
      label += info + '\\n';
      let id = m.Object && m.Object.ID !== undefined ? m.Object.ID : 0;
      if (m.Locations && m.Locations.length > 0) {
        let ls = [];
        for (let loc of m.Locations)
          ls.push(gotoExpansionLocLink(project, loc));
        info += ' at ' + ls.join(', ');
      }
      let obj = objs.get(id);
      if (obj === undefined) {
        let decl = '';
        if (m.Object) {
          if (m.Object.Name)
            decl += `<var>${m.Object.Name}</var> `;
          if (m.Object.DeclLocation &&
              (m.Object.DeclLocation.Line !== 0 ||
                m.Object.DeclLocation.Column !== 0))
            decl += `at ${gotoExpansionLocLink(project, m.Object.DeclLocation)}`;
        }
        if (decl.length === 0)
          decl = '<var>no name</var>';
        objs.set(id, [decl, info]);
      } else {
        obj.push(info);
      }
      for (let t in m.Traits) {
        let dptr = m.Traits[t];
        let traitInfo = info;
        if (t == 'reduction') {
          traitInfo += ` (${dptr.Kind})`;
        } else if (t == 'induction') {
          traitInfo += ' (' + dptr.Kind;
          if (dptr.Start || dptr.End || dptr.Step) {
            traitInfo += ', ';
            if (dptr.Start)
              traitInfo += dptr.Start;
            traitInfo += ':';
            if (dptr.End)
              traitInfo += dptr.End;
            traitInfo += ':';
            if (dptr.Step)
              traitInfo += dptr.Step;
          }
          traitInfo += ')';
        } else if (t == 'anti' || t == 'flow' || t == 'output') {
          traitInfo += ' (';
          if (dptr.May)
            traitInfo += 'may';
          else
            traitInfo += 'must';
          if (dptr.Causes && dptr.Causes.length > 0)
            traitInfo += ', ' + dptr.Causes.join(', ');
          if (dptr.Min || dptr.Max) {
            traitInfo += ", ";
            if (dptr.Min)
              traitInfo += dptr.Min;
            traitInfo += ':';
            if (dptr.Max)
              traitInfo += dptr.Max;
          }
          traitInfo += ')';
        }
        let v = separateTraits[t];
        if (v === undefined)
          separateTraits[t] = {"separate": true, "union": false, "objects": [traitInfo]};
        else
          v.objects.push(traitInfo);
      }
    }
    let description: string [][] = [];
    for (let ms of objs.values())
      description.push(ms);
    return [label, description];
  }

  protected _provideContent(project: Project, data: Data,
      asWebviewUri: UpdateUriFunc): string {
    let nodes = '';
    let edges = '';
    for (let n of data.AliasTree.Nodes) {
      let traits: any = {};
      let [selfLabel, selfDescription] = this._memoryInfo(project, n.SelfMemory, traits);
      let [coveredLabel, coveredDescription] = this._memoryInfo(project, n.CoveredMemory, traits);
      for (let t of n.Traits) {
        let tInfo = traits[t];
        if (tInfo === undefined) {
          traits[t] = { "separate": false, "union": true };
        } else {
          tInfo.union = true;
        }
      }
      for (let t in traits) {
        let obj = traits[t]['objects'];
        if (obj)
          obj.sort();
      }
      nodes += `{
        id: ${n.ID},
        traits: ${JSON.stringify(traits)},
        self: ${JSON.stringify(selfDescription)},
        covered: ${JSON.stringify(coveredDescription)},
        kind: '${n.Kind}'`;
      if (n.Kind === 'Top')
        nodes += ', shape: "database"';
      else if (n.Kind === 'Unknown')
        nodes += `, shape: 'circle'`
      else
        nodes +=`, label: '${selfLabel + coveredLabel}'`;
      let background = "floralwhite";
      if (n.Kind !== 'Top') {
        for (let t in traits) {
          if (t == 'anti' || t == 'flow' || t == 'output' || t == 'address access') {
            background = 'lightcoral';
            break;
          }
          if (traits[t].union &&
              (t == 'shared' || t == 'read only' || t == 'private')) {
            background = 'lightgreen';
            break;
          }
        }
      }
      if (n.Coverage)
        nodes += `,color: { border: "darkorange", background: "${background}"}`;
      else
        nodes += `,color: { background: "${background}"}`;
      nodes += '},'
    }
    for (let e of data.AliasTree.Edges) {
      edges += `{from: ${e.From}, to: ${e.To}`;
      if (e.Kind === 'Unknown')
        edges += ', dashes: true';
      edges += '},';
    }
    // Remove last comma.
    nodes = nodes.substr(0, nodes.length - 1);
    edges = edges.substr(0, edges.length - 1);
    let targetFunc = data.Functions.get(data.AliasTree.FuncID);
    let targetObj:msg.Function|msg.Loop = targetFunc;
    let gotoTarget = '';
    if (data.AliasTree.LoopID) {
      targetObj = targetFunc.Loops.find(l=> { return l.ID == data.AliasTree.LoopID});
      gotoTarget = `loop at ${gotoExpansionLocLink(project, targetObj.StartLocation)} in `;
    }
    gotoTarget += `<var>${targetFunc.Name}</var> declared at ` +
      gotoExpansionLocLink(project, targetFunc.StartLocation);
    return `
      <!doctype html>
      <html lang="en">
        ${headHtml(asWebviewUri, {bootstrap: true, visNetwork: true})}
        <body class="bg-light">
          <div class="container-fluid pt-4" style="height:100%">
            <h3>${this._title().replace('{0}', gotoTarget)}</h3>
            <div class="row" style="height:100%">
              <div class="col-9" style="height:100%">
                <div id="aliasTree" style="height:90%"}></div>
              </div>
              <div class="col-3" style="height:90%">
                <div id="memoryInfo" style="max-height:60%; overflow:scroll"></div>
                <div id="traitInfo" class = "pt-2" style="max-height:40%; overflow:scroll"></div>
              </div>
            </div>
          </div>
          <script type="text/javascript">
            var nodes = new vis.DataSet([${nodes}]);
            var edges = new vis.DataSet([${edges}]);
            var container = document.getElementById('aliasTree');
            var data = {
              nodes: nodes,
              edges: edges
            };
            var options = {
              layout: {
                hierarchical: {
                  direction: 'UD',
                  sortMethod: 'directed',
                  shakeTowards: 'roots'
                }
              },
              physics: {
                hierarchicalRepulsion: {
                  avoidOverlap: 1
                }
              },
              nodes: {
                shape: "box",
                color: {
                  border: "grey"
                }
              },
              edges: {
                arrows: {
                  to: {
                    enabled: true,
                    type: "arrow"
                  }
                }
              }
            };
            var network = new vis.Network(container, data, options);
            network.on('click', selected => {
              const memoryInfo = document.getElementById('memoryInfo');
              const traitInfo = document.getElementById('traitInfo');
              memoryInfo.innerHTML = '';
              //memoryInfo.classList.remove('border-bottom', 'border-secondary');
              traitInfo.innerHTML = '';
              if (!selected.nodes || selected.nodes.length != 1)
                return;
              let n = nodes.get(selected.nodes[0]);
              //memoryInfo.classList.add('border-bottom', 'border-secondary');
              if (n.self && n.self.length > 0) {
                let html =
                  '<h6>${log.AliasTree.nodeSelf}</h6>' +
                  '<div class="mt-2 ml-2">';
                html += '<ul class="list-unstyled">';
                for (let idx in n.self) {
                  html += '<li>';
                  html += '<a data-toggle="collapse" href="#selflist-' + idx + '"' +
                    'role="button" aria-expanded="false" aria-controls="selflist-' + idx + '">' +
                    '&#10065;</a>&nbsp;' + n.self[idx][0];
                  html += '<div class="collapse" id="selflist-' + idx + '">';
                  html += '<ul class="list-unstyled pl-3">';
                  for (let i = 1; i < n.self[idx].length; ++i)
                    html += '<li>' + n.self[idx][i] + '</li>';
                  html += '</ul>';
                  html += '</div>'
                  html += '</li>';
                }
                html += '</ul></div>';
                memoryInfo.innerHTML = html;
              }
              if (n.covered && n.covered.length > 0) {
                let html = '';
                if (n.kind === 'Top')
                  html += '<h6>${log.AliasTree.nodeCovered}</h6>';
                else
                  html += '<h6>${log.AliasTree.nodeOverlap}</h6>';
                html += '<div class="mt-2 ml-2">';
                html += '<ul class="list-unstyled">';
                for (let idx in n.covered) {
                  html += '<li>';
                  html += '<a data-toggle="collapse" href="#coveredlist-' + idx + '"' +
                    'role="button" aria-expanded="false" aria-controls="coveredlist-' + idx + '">' +
                    '&#10065;</a>&nbsp;' + n.covered[idx][0];
                  html += '<div class="collapse" id="coveredlist-' + idx + '">';
                  html += '<ul class="list-unstyled pl-2">';
                  for (let i = 1; i < n.covered[idx].length; ++i)
                    html += '<li>' + n.covered[idx][i] + '</li>';
                  html += '</ul>';
                  html += '</div>'
                  html += '</li>';
                }
                html += '</ul></div>';
                memoryInfo.innerHTML += html;
              }
              if (n.kind !== 'Top' && n.traits) {
                let html = '';
                html += '<h6>${log.AliasTree.traisList}</h6>';
                html += '<div class="mt-2 ml-2" style="overflow: scroll">';
                html += '<ul class="list-unstyled">';
                let empty = true;
                for (let t in n.traits) {
                  empty = false;
                  html += '<li>';
                  if (n.traits[t].union)
                    html += '<span style="cursor:pointer" title="${log.AliasTree.hasCombined}">&#9741;</span>';
                  else
                    html += '<span style="visibility: hidden">&#9741;</span>';
                  if (n.traits[t].separate) {
                    html += '<a title="${log.AliasTree.hasSeparate}" data-toggle="collapse"' +
                      'href="#separateTraitList-' + t.replace(/\\s/g, '-') + '"' +
                      'role="button" aria-expanded="false"' +
                      'aria-controls="separateTraitList-' + t.replace(/\\s/g, '-') + '">' +
                    '&#9737;</a>';
                  } else {
                    html += '<span style="visibility: hidden">&#9737;</span>';
                  }
                  html += '&nbsp;' + t;
                  if (n.traits[t].separate) {
                    html += '<div class="ml-4 collapse" id="separateTraitList-' + t.replace(/\\s/g, '-') + '">';
                    html += '<ul class="list-unstyled">';
                    for (let m of n.traits[t].objects) {
                      html += '<li>' + m + '</li>';
                    }
                    html += '</ul>';
                    html += '</div>';
                  }
                  html += '</li>';
                }
                html += '</ul></div>';
                if (!empty)
                  traitInfo.innerHTML += html;
              }
            });
          </script>
        </body>
      </html>`;
  }
}