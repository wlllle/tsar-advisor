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
import ProjectEngine from './project';

export function activate(context: vscode.ExtensionContext) {
  let engine = new ProjectEngine(context);
  let start = vscode.commands.registerTextEditorCommand(
    'analysis.start', editor => {
      engine.start(editor.document).then(
        (success) => {},
        (reason) => {
          let diag = reason as msg.Diagnostic;
          for (let err in diag.Error)
            vscode.window.showErrorMessage(
              `${log.Extension.displayName}: ${diag.Error[err]}`);
        });
    });
  let stop = vscode.commands.registerTextEditorCommand(
    'analysis.stop', editor => {engine.stop(editor.document)});
  context.subscriptions.push(start, stop);
}