//===- loopExplorer.ts ------------ Loop Tree Explorer ------ TypeScript --===//
//
//                           TSAR Advisor (SAPFOR)
//
// This file implements project explorer which relies on loop tree navigating
// the project.
//
//===----------------------------------------------------------------------===//

'use strict';

import * as path from 'path';
import * as vscode from 'vscode'
import * as log from './log'
import * as msg from './messages'
import {isFunction} from './functions'
import {Project, ProjectContentProvider,
  ProjectContentProviderState} from './project';
import { LoopTreeProvider, LoopTreeProviderState } from './loopTree';
import { resolveLocation } from './fileList';

class LoopTreeViewProviderState implements ProjectContentProviderState {
  #provider: LoopTreeViewProvider;
  #onDidDisposeContent = new vscode.EventEmitter<void>();
  #onDidChangeActiveState = new vscode.EventEmitter<boolean>();

  readonly onDidDisposeContent = this.#onDidDisposeContent.event;
  readonly onDidChangeActiveState = this.#onDidChangeActiveState.event;
  readonly disposables: vscode.Disposable[] = [];
  readonly active = true;

  constructor(provider: LoopTreeViewProvider) { this.#provider = provider; }

  get provider(): LoopTreeViewProvider { return this.#provider; }

  actual(): boolean { return true; }

  dispose() {
    this.disposables.forEach(d => d.dispose());
    this.disposables.length = 0;
  }
}

/**
* Provide project explorere view that lists loop trees for active projects.
*/
export class LoopTreeViewProvider
  implements vscode.TreeDataProvider<SourceRegion | Project>,
             ProjectContentProvider {
  #disposables: vscode.Disposable[] = [];
  #projects = new Set<Project>();
  #onDidChangeTreeData: vscode.EventEmitter<Project | void> =
    new vscode.EventEmitter<Project | void>();
  #onDidAriseInternalError = new vscode.EventEmitter<Error>();

  private _isSourceRegion(obj: SourceRegion|Project): obj is SourceRegion {
    return (obj as SourceRegion).project !== undefined;
  }

  static scheme = "tsar-looptree-view";

  readonly onDidChangeTreeData: vscode.Event<Project | void> =
    this.#onDidChangeTreeData.event;
  readonly onDidAriseInternalError = this.#onDidAriseInternalError.event;

  constructor() {
    this.#disposables.push(
      vscode.window.registerTreeDataProvider('tsar.loopTree', this));
    vscode.commands.registerCommand(
      'tsar.loopTree.goto', (region: SourceRegion) => this.goto(region));
    vscode.commands.registerCommand(
      'tsar.func.analyze', (region: SourceRegion) => this.build(region));
    vscode.commands.registerCommand(
      'tsar.alias.tree', (region: SourceRegion) => this.buildAliasTree(region));
    vscode.commands.registerCommand(
      'tsar.call.graph', (region: SourceRegion) => this.buildCallGraph(region));
    vscode.commands.registerCommand(
      'tsar.call.graph.io',
      (region: SourceRegion) => this.buildCallGraph(region,
        msg.StatementAttr.InOut));
    vscode.commands.registerCommand(
      'tsar.call.graph.exit',
      (region: SourceRegion) => this.buildCallGraph(region,
        msg.StatementAttr.Exit));
    vscode.commands.registerCommand(
      'tsar.call.graph.unsafe',
      (region: SourceRegion) => this.buildCallGraph(region,
        msg.StatementAttr.UnsafeCFG));
  }

  state(): LoopTreeViewProviderState {
    return new LoopTreeViewProviderState(this);
  }

  scheme(): string { return LoopTreeViewProvider.scheme; }

  dispose() {
    this.#disposables.forEach(d => d.dispose());
    this.#disposables.length = 0;
  }

  clear(project: Project) {
    if (this.#projects.delete(project))
      this.#onDidChangeTreeData.fire();
  }

  update(project: Project) {
    if (!this.#projects.has(project)) {
      this.#projects.add(project);
      this.#onDidChangeTreeData.fire();
    } else {
      if (project.response !== undefined &&
          project.response instanceof msg.FunctionList ||
          project.response instanceof msg.LoopTree)
        this.#onDidChangeTreeData.fire();
    }
  }


  getTreeItem(element: SourceRegion|Project): vscode.TreeItem {
    if (this._isSourceRegion(element))
      return element;
    let loopTreeState = element.providerState(
      LoopTreeProvider.scheme) as LoopTreeProviderState;
    let item = new vscode.TreeItem(element.prjname,
      loopTreeState.functions() === undefined
        ? vscode.TreeItemCollapsibleState.Collapsed
        : vscode.TreeItemCollapsibleState.Expanded);
    item.contextValue = 'project';
    item.tooltip = log.Project.tooltip;
    return item;
  }

  getChildren(element?: SourceRegion|Project): SourceRegion[]|Project [] {
    if (!element) {
      let regions = [];
      this.#projects.forEach((key)=>regions.push(key));
      return regions;
    }
    if (!this._isSourceRegion(element)) {
      let loopTreeState = element.providerState(
        LoopTreeProvider.scheme) as LoopTreeProviderState;
      let regions : SourceRegion [] = [];
      if (loopTreeState.functions() !== undefined)
        for (let func of loopTreeState.functions()) {
          if (!func.User)
            continue;
          let item = new SourceRegion(func, func, element,
            func.Traits.Loops === "Yes"
              ? vscode.TreeItemCollapsibleState.Collapsed
              : vscode.TreeItemCollapsibleState.None);
          item.command = {
            command: "tsar.loopTree.goto",
            title: "",
            arguments: [item]
          };
          item.contextValue = 'function';
          if (func.Traits.Parallel === 'Yes')
            item.iconPath = path.join(log.Extension.icons, 'parallel-func.svg');
          regions.push(item);
        }
      return regions;
    }
    if (isFunction(element.object))
      if (element.object.Loops.length == 0) {
        if (element.object.Traits.Loops === 'Yes')
          vscode.commands.executeCommand('tsar.loop.tree',
            element.project.uri.with({
              query: JSON.stringify({ ID: element.object.ID })
            }));
        return undefined;
      }
    let regions : SourceRegion [] = [];
    let parentIdx = -1, parentLevel = 0;
    if (!isFunction(element.object)) {
      parentLevel = element.object.Level;
      for (let idx = 0; idx < element.root.Loops.length; ++idx)
        if (element.root.Loops[idx].ID == element.object.ID) {
          parentIdx = idx;
          break;
        }
    }
    for (let idx = parentIdx + 1; idx < element.root.Loops.length; ++idx) {
      let loop = element.root.Loops[idx];
      if (loop.Level == parentLevel)
        break;
      if (loop.Level != parentLevel + 1)
        continue;
      let item = new SourceRegion(loop, element.root, element.project,
          idx + 1 < element.root.Loops.length &&
          element.root.Loops[idx+1].Level == loop.Level + 1
          ? vscode.TreeItemCollapsibleState.Collapsed
          : vscode.TreeItemCollapsibleState.None);
      item.command = {
        command: "tsar.loopTree.goto", title: "", arguments: [item]
      };
      item.contextValue = 'loop';
      if (loop.Traits.Parallel === 'Yes')
        item.iconPath = path.join(log.Extension.icons, 'parallel.svg');
      regions.push(item);
    }
    return regions;
  }

  goto(region: SourceRegion): void  {
    let uri = region.project.uri.with({
      query: JSON.stringify(
        resolveLocation(region.project, region.object.StartLocation))
    });
    vscode.commands.executeCommand('tsar.open-project', uri);
  }

  build(region: SourceRegion): void {
    let uri = region.project.uri.with({
      query: JSON.stringify({ ID: region.object.ID })
    });
    vscode.commands.executeCommand('tsar.loop.tree', uri);
  }

  buildAliasTree(region: SourceRegion) : void {
    let uri = region.project.uri.with({
      query: JSON.stringify({
        FuncID: region.root.ID,
        LoopID: region.object.ID
      })
    });
    vscode.commands.executeCommand('tsar.loop.alias', uri);
  }

  buildCallGraph(region: SourceRegion, attr?: msg.StatementAttr) : void {
    let query = {FuncID: region.root.ID};
    if (!isFunction(region.object))
      query['LoopID'] = region.object.ID;
    if (attr)
      query['Attr'] = [attr];
    let uri = region.project.uri.with({ query : JSON.stringify(query)});
    vscode.commands.executeCommand('tsar.callee.func', uri);
  }
}

class SourceRegion extends vscode.TreeItem {
  constructor(
      public readonly object: msg.Function|msg.Loop,
      public readonly root: msg.Function,
      public readonly project: Project,
      public readonly collapsibleState: vscode.TreeItemCollapsibleState) {
    super(isFunction(object) ? object.Name
                             : object.Type.toLowerCase(), collapsibleState);
    this.tooltip =
      `${isFunction(object) ? 'Function' : 'Loop'} in a source code`;
    let sl = this.object.StartLocation;
    let loc = '';
    loc += `${sl.Line}:${sl.Column}`;
    if (sl.Line != sl.MacroLine || sl.Column != sl.MacroColumn)
      loc += `(${sl.MacroLine}:${sl.MacroColumn})`;
    let el = this.object.EndLocation;
    loc += '-';
    loc += `${el.Line}:${el.Column}`;
    if (el.Line != el.MacroLine || el.Column != el.MacroColumn)
      loc += `(${el.MacroLine}:${el.MacroColumn})`;
    this.description =
      `${isFunction(this.object) ? "function" : 'loop'} at ${loc}`;
  }
}
