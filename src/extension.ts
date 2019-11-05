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
import {LoopTreeProvider} from './loopTree';
import * as msg from './messages';
import {ProjectEngine, Project} from './project';
import {ProjectWebviewProviderState} from './webviewProvider';
import {ProjectProvider} from './general';
import {CalleeFuncProvider, CalleeFuncProviderState} from './calleeFunc';

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

  function isUri(pet: vscode.TextDocument | Project | vscode.Uri): pet is vscode.Uri {
    return (pet as vscode.Uri) !== undefined;
  }

export function activate(context: vscode.ExtensionContext) {
  if (!openLog())
    return;
  log.Log.logs[0].write(log.Message.extension);
  let engine = new ProjectEngine(context);
  engine.register(
    [ProjectProvider.scheme, new ProjectProvider],
    [CalleeFuncProvider.scheme, new CalleeFuncProvider],
    [LoopTreeProvider.scheme, new LoopTreeProvider]
  );
  let start = vscode.commands.registerCommand(
    'tsar.start', (uri:vscode.Uri) => {
      vscode.workspace.openTextDocument(uri)
        .then((success) => {return engine.start(success)})
        .then(null, (reason) => {
          log.Log.logs[0].write(log.Error.active);
          if (reason instanceof msg.Diagnostic) {
            for (let err in reason.Error) {
              let error = `${log.Extension.displayName}: ${reason.Error[err]}`;
              vscode.window.showErrorMessage(error);
              log.Log.logs[0].write(error);
            }
          } else {
            let error = `${log.Extension.displayName}: ${log.Error.openFile.replace('{0}', uri.fsPath)}`;
            log.Log.logs[0].write(error);
            vscode.window.showErrorMessage(error);
          }
        });
    });
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
                let line = query.Line;
                let col = query.Column;
                doc.selection = new vscode.Selection(line - 1, col - 1, line - 1, col - 1);
                doc.revealRange(new vscode.Range(line - 1, col - 1, line - 1, col - 1));
              }
            }
          );
        },
        (reason) => {
          vscode.window.showErrorMessage(
            `${log.Extension.displayName}: ${log.Error.openFile.replace('{0}', uri.fsPath)}`);
        });
    })
  let showFuncList = vscode.commands.registerCommand('tsar.function.list',
    (uri:vscode.Uri) => {
      let project = engine.project(uri);
      let state = project.providerState(LoopTreeProvider.scheme);
      state.active = true;
      if (!state.actual)
        project.send(new msg.FunctionList);
    });
  let showLoopTree = vscode.commands.registerCommand('tsar.loop.tree',
    (uri:vscode.Uri) => {
      let project = engine.project(uri);
      let state = project.providerState(LoopTreeProvider.scheme);
      state.active = true;
      let looptree = new msg.LoopTree;
      let query = JSON.parse(uri.query);
      looptree.FunctionID = query.ID;
      project.send(looptree);
    });
  let ExpColLoopTree = vscode.commands.registerCommand('tsar.expcol.looptree',
    (uri:vscode.Uri) => {
      let project = engine.project(uri);
      let state = project.providerState(
        LoopTreeProvider.scheme) as ProjectWebviewProviderState<LoopTreeProvider>;
      let response = state.data;
      let query = JSON.parse(uri.query);
      let i = 0;
      while (i < response.Functions.length && query.FuncID != response.Functions[i].ID)
        i++;;
      if (!query.LoopID) {
        for (let j = 0; j < response.Functions[i].Loops.length; j++)
          if (response.Functions[i].Loops[j].Level == 1)
          response.Functions[i].Loops[j].Hide = query.Hide;
      } else {
        let j = 0;
        while (j < response.Functions[i].Loops.length && query.LoopID != response.Functions[i].Loops[j].ID)
          j++;
        let idx = j + 1;
        while (idx < response.Functions[i].Loops.length &&
            response.Functions[i].Loops[idx].Level > response.Functions[i].Loops[j].Level) {
          if (response.Functions[i].Loops[idx].Level - 1 == response.Functions[i].Loops[j].Level) {
            response.Functions[i].Loops[idx].Hide = query.Hide;
          }
          idx++;
        }
      }
      project.update(response);
    });
  let showCalleeFunc = vscode.commands.registerCommand('tsar.callee.func',
    (uri:vscode.Uri) => {
      let project = engine.project(uri);
      let state = project.providerState(
        CalleeFuncProvider.scheme) as CalleeFuncProviderState;
      state.active = true;
      let funclist = new msg.CalleeFuncList;
      let query = JSON.parse(uri.query);
      funclist.ID = query.ID;
      funclist.FuncID = query.FuncID;
      funclist.Attr = query.Attr;
      if ('LoopID' in query) {
        funclist.LoopID = query.LoopID;
      } else {
        funclist.LoopID = 0;
      }
      if (funclist.ID == '') {
        state.data = funclist;
      } else {
        state.data.ID = funclist.ID;
      }
      project.send(funclist);
    });
  context.subscriptions.push(start, stop, openProject, showFuncList,
      showLoopTree, ExpColLoopTree, showCalleeFunc);
}
