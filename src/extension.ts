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
import * as msg from './messages';
import {onReject} from './functions';
import {ProjectEngine } from './project';
import {ProjectProvider} from './general';
import {CalleeFuncProvider, CalleeFuncProviderState} from './calleeFunc';
import * as t from './transformProvider';
import server from './tools';

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
    log.Log.logs.push(new log.Log(log.Extension.log));
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
  log.Log.logs[0].write(log.Message.extension);
  let engine = new ProjectEngine(context);
  engine.register(
    [ProjectProvider.scheme, new ProjectProvider],
    [CalleeFuncProvider.scheme, new CalleeFuncProvider],
    [lt.LoopTreeProvider.scheme, new lt.LoopTreeProvider],
    [t.TransformationProvider.scheme, new t.TransformationProvider]
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
            let state = project.providerState(ProjectProvider.scheme);
            state.onDidDisposeContent(() => {engine.stop(project)},
              null, context.subscriptions);
            await engine.runTool(project);
            state.active = true;
            project.send(new msg.Statistic);
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
      title: 'Parallelization with OpenMP',
      run: '-clang-openmp-parallel'
    },
    {
      command: 'tsar.parallel.dvmh',
      title: 'TSAR Parallelization with DVMH',
      run: '-clang-experimental-apc-dvmh'
    },
    {
      command: 'tsar.analysis.check',
      title: 'TSAR Check User-defined Properties',
      run: '-check'
    }
  ],engine, context.subscriptions);
  let stop = vscode.commands.registerCommand(
    'tsar.stop', (uri:vscode.Uri) => engine.stop(uri));
  let openProject = vscode.commands.registerCommand('tsar.open-project',
    (uri:vscode.Uri) => {
      vscode.workspace.openTextDocument(uri).then(
        (success) => {
          vscode.window.showTextDocument(success).then(
            (doc) => {
              if (uri.query != '') {
                let query = JSON.parse(uri.query);
                if ('Line' in query) {
                  let line = query.Line;
                  let col = query.Column;
                  doc.selection = new vscode.Selection(line - 1, col - 1, line - 1, col - 1);
                  doc.revealRange(new vscode.Range(line - 1, col - 1, line - 1, col - 1));
                }
              }
            }
          );
        },
        (reason) => {
          vscode.window.showErrorMessage(
            `${log.Extension.displayName}: ${log.Error.openFile.replace('{0}', uri.fsPath)}`);
        });
    })
  lt.registerCommands(engine, context.subscriptions);
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
      project.send(request);
    });
  context.subscriptions.push(start, stop, openProject, showCalleeFunc);
}
