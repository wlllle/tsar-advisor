//===--- extension.ts ----- TSAR Advisor Extension ---------- TypeScript --===//
//
//                           TSAR Advisor (SAPFOR)
//
//===----------------------------------------------------------------------===//
//
// This is a start point of the extension.
//
//===----------------------------------------------------------------------===//

'use strict';

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as net from 'net';
import {encodeLocation} from './functions';
import {ProjectProvider} from './general';
import * as log from './log';
import {LoopTreeProvider} from './loopTree';
import * as msg from './messages';
import {ProjectEngine} from './project';



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
    [ProjectProvider.scheme, new ProjectProvider(engine)],
    [LoopTreeProvider.scheme, new LoopTreeProvider(engine)]
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
  let stop = vscode.commands.registerTextEditorCommand(
    'tsar.stop', editor => {engine.stop(editor.document)});
  let openProject = vscode.commands.registerCommand('tsar.open-project',
    (uri:vscode.Uri) => {
      vscode.workspace.openTextDocument(uri).then(
        (success) => {
          vscode.window.showTextDocument(success);
        },
        (reason) => {
          vscode.window.showErrorMessage(
            `${log.Extension.displayName}: ${log.Error.openFile.replace('{0}', uri.fsPath)}`);
        });
    })
  let showFuncList = vscode.commands.registerCommand('tsar.function.list',
    (uri:vscode.Uri) => {
      let project = engine.project(uri);
      /// TODO (kaniandr@gmail.com) : check that project is available:
      ///   if (project === undefined) ...
      /// TODO (kaniandr@gmail.com) : send request if data is inconsistent only.
      vscode.commands.executeCommand('vscode.previewHtml',
          encodeLocation(LoopTreeProvider.scheme, project.uri),
          vscode.ViewColumn.Two,
          `${log.Extension.displayName} | ${project.prjname}`)
        .then((success) => {
          project.send(new msg.FunctionList);
        }, null);
    });
  let showLoopTree = vscode.commands.registerCommand('tsar.loop.tree',
    (uri:vscode.Uri) => {
      let project = engine.project(uri);



      vscode.commands.executeCommand('vscode.previewHtml',
          encodeLocation(LoopTreeProvider.scheme, project.uri),
          vscode.ViewColumn.Two,
          `${log.Extension.displayName} | ${project.prjname}`)
        .then((success) => {
          let looptree = new msg.LoopTree;
          looptree.ID = Number(uri.query);
          project.send(looptree);
        })
    })
  context.subscriptions.push(start, stop, openProject, showFuncList, showLoopTree);
}
