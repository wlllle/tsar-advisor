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
import * as path from 'path';
import * as net from 'net';
import * as msg from './messages';
import * as log from './log';
import {ProjectEngine} from './project';
import {ProjectProvider} from './general';

export function activate(context: vscode.ExtensionContext) {
  let engine = new ProjectEngine(context);
  engine.register(
    [ProjectProvider.scheme, new ProjectProvider(engine)]
  );
  let start = vscode.commands.registerCommand(
    'tsar.start', (uri:vscode.Uri) => {
      vscode.workspace.openTextDocument(uri)
        .then((success) => {return engine.start(success)})
        .then(null, (reason) => {
          if (reason instanceof msg.Diagnostic) {
            for (let err in reason.Error)
              vscode.window.showErrorMessage(
                `${log.Extension.displayName}: ${reason.Error[err]}`);
          } else {
          vscode.window.showErrorMessage(
            `${log.Extension.displayName}: ${log.Error.openFile.replace('{0}', uri.fsPath)}`);
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
  context.subscriptions.push(start, stop, openProject);
}