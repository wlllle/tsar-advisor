//===--- extension.ts ----- TSAR Advisor Extension ---------- TypeScript --===//
//
//                           TSAR Advisor (SAPFOR)
//
// This is a start point of the extension.
//
//===----------------------------------------------------------------------===//

'use strict';

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as log from './log';
import * as lt from './loopTree';
import * as at from './aliasTree';
import * as msg from './messages';
import {onReject} from './functions';
import {ProjectEngine, Project } from './project';
import {ProjectProvider} from './general';
import {CalleeFuncProvider, CalleeFuncProviderState} from './calleeFunc';
import * as t from './transformProvider';
import server from './tools';
import { FileListProvider } from './fileList';
import { LoopTreeViewProvider } from './loopExplorer';
import { registerTrees } from './tree/registerTrees';

/**
 * Open log file (log.Extension.log), returns true on success.
 */
function openLog(): boolean {
  try {
    let newDir = false;
    let dir = path.dirname(log.Extension.log);
    if (fs.existsSync(dir)) {
      let stat = fs.statSync(dir);
      if (!stat.isDirectory())
        throw new Error(log.Error.notDirectory.replace('{0}', dir));
    }
    else {
      fs.mkdirSync(dir);
      newDir = true;
    }
    let userConfig = vscode.workspace.getConfiguration(log.Extension.id);
    let logOn = userConfig.has('advanced.log.enabled') &&
                userConfig.get('advanced.log.enabled') === true
    log.Log.logs.push(new log.Log(log.Extension.log, logOn));
    if (newDir)
      log.Log.logs[0].write(log.Message.createLog);
  }
  catch(err) {
    vscode.window.showErrorMessage(
      `${log.Extension.displayName}: ${log.Error.internal}: ${log.Error.openLog}`);
    return false;
  }
  return true;
}

export function activate(context: vscode.ExtensionContext) {
  if (!openLog())
    return;
  registerTrees();
  context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(e => {
    if (e.affectsConfiguration(`${log.Extension.id}.advanced.log.enabled`)) {
      let userConfig = vscode.workspace.getConfiguration(log.Extension.id);
      log.Log.logs[0].enabled = userConfig.has('advanced.log.enabled') &&
                                userConfig.get('advanced.log.enabled') === true;
    }
  }));
  log.Log.logs[0].write(log.Message.extension);
  let engine = new ProjectEngine(context);
  engine.register(
    [FileListProvider.scheme, new FileListProvider],
    [ProjectProvider.scheme, new ProjectProvider],
    [CalleeFuncProvider.scheme, new CalleeFuncProvider],
    [lt.LoopTreeProvider.scheme, new lt.LoopTreeProvider],
    [LoopTreeViewProvider.scheme, new LoopTreeViewProvider],
    [t.TransformationProvider.scheme, new t.TransformationProvider],
    [at.AliasTreeProvider.scheme, new at.AliasTreeProvider]
  );
  let start = vscode.commands.registerCommand(
    'tsar.start', (uri:vscode.Uri) => {
      vscode.workspace.openTextDocument(uri)
        .then((success) => {
          return engine.start(success,
            server.tools.find(t=>{return t.name === 'tsar'}));
         })
        .then(
          async project => {
            await engine.runTool(project);
            project.providerState(FileListProvider.scheme).active = true;
            project.send(new msg.FileList);
            vscode.commands.executeCommand('tsar.function.list', project.uri);
          },
          reason => { onReject(reason, uri) })
    });
  t.registerCommands([
    {
      command: 'tsar.transform.propagate',
      title: 'Expression Propagation',
      run: '-clang-propagate'
    },
    {
      command: 'tsar.transform.inline',
      title: 'TSAR Function Inlining',
      run: '-clang-inline'
    },
    {
      command: 'tsar.transform.replace',
      title: 'TSAR Structure Replacement',
      run: '-clang-struct-replacement'
    },
    {
      command: 'tsar.transform.rename',
      title: 'TSAR Local Renaming',
      run: '-clang-rename'
    },
    {
      command: 'tsar.transform.dedecls',
      title: 'TSAR Dead Declarations Elimination',
      run: '-clang-de-decls'
    },
    {
      command: 'tsar.parallel.openmp',
      title: 'TSAR Parallelization with OpenMP',
      run: '-clang-openmp-parallel'
    },
/*    {
      command: 'tsar.parallel.dvmh',
      title: 'TSAR Parallelization with DVMH',
      run: '-clang-experimental-apc-dvmh'
    },
*/
    {
      command: 'tsar.parallel.dvmhsm',
      title: 'TSAR Shared Memory Parallelization with DVMH',
      run: '-clang-dvmh-sm-parallel'
    },
    {
      command: 'tsar.analysis.check',
      title: 'TSAR Check User-defined Properties',
      run: '-check'
    }
  ],engine, context.subscriptions);
  let stop = vscode.commands.registerCommand(
    'tsar.stop', (uri:vscode.Uri) => engine.stop(uri));
  let statistic = vscode.commands.registerCommand(
    'tsar.statistic', (data: vscode.Uri|Project) => {
      let project = (data as Project).prjname !== undefined
        ? data as Project
        : engine.project(data as vscode.Uri);
      let state = project.providerState(ProjectProvider.scheme);
      let request = new msg.Statistic;
      state.active = true;
      project.focus = state;
      project.send(request);
    }
  );
  let openProject = vscode.commands.registerCommand('tsar.open-project',
    (uri: vscode.Uri) => {
      let [docUri, query] = [uri, undefined];
      if (uri.query != '') {
        query = JSON.parse(uri.query);
        docUri = vscode.Uri.file(query['Path']);
      } else {
        docUri = vscode.Uri.file(uri.path);
      }
      vscode.workspace.openTextDocument(docUri).then(
        (success) => {
          vscode.window.showTextDocument(success).then(
            (doc) => {
              if (query && 'Line' in query) {
                let line = query.Line;
                let col = query.Column;
                doc.selection =
                  new vscode.Selection(line - 1, col - 1, line - 1, col - 1);
                doc.revealRange(
                  new vscode.Range(line - 1, col - 1, line - 1, col - 1));
              }
            }
          )
        },
        () => {
          vscode.window.showErrorMessage(
            `${log.Extension.displayName}: ${log.Error.openFile.replace('{0}', uri.fsPath)}`);
        })
    });
  lt.registerCommands(engine, context.subscriptions);
  at.registerCommands(engine, context.subscriptions);
  let showCalleeFunc = vscode.commands.registerCommand('tsar.callee.func',
    (uri:vscode.Uri) => {
      let project = engine.project(uri);
      let state = project.providerState(
        CalleeFuncProvider.scheme) as CalleeFuncProviderState;
      let request = new msg.CalleeFuncList;
      let query = JSON.parse(uri.query);
      request.FuncID = query.FuncID;
      request.Attr = query.Attr;
      request.LoopID = 'LoopID' in query ? query.LoopID : 0;
      // Dispose current webview if required request is new.
      state.active = false;
      state.active = true;
      project.focus = state;
      project.send(request);
    });
  context.subscriptions.push(start, stop, statistic, openProject, showCalleeFunc);
}
