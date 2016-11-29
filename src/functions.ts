//===--- functions.ts -----  - Helpful functions ------------ TypeScript --===//
//
//                           TSAR Adviser (SAPFOR)
//
//===----------------------------------------------------------------------===//
//
// This contains a helpful function.
//
//===----------------------------------------------------------------------===//

'use strict';

import * as path from 'path';
import * as vscode from 'vscode';
import {Project} from './project';
import * as log from './log';

/**
 * Encodes location for content provider.
 */
export function encodeLocation(
    scheme: string, uri: vscode.Uri, pos?: vscode.Position): vscode.Uri {
  const query = pos ?
    JSON.stringify([uri.toString(), pos.line, pos.character]) :
    JSON.stringify([uri.toString()]);
  return vscode.Uri.parse(`${scheme}://results?${query}`);
}

/**
 * Decodes location for content provider.
 */
export function decodeLocation(uri: vscode.Uri): [vscode.Uri, vscode.Position] {
  let [target, line, ch] = <[string, number, number]>JSON.parse(uri.query);
  return [vscode.Uri.parse(target), new vscode.Position(line, ch)];
}

/**
 * Returns html representation of a link to a project.
 */
export function projectLink(project: Project): string {
  return `
    <a class="source-link" href="file://${project.uri.fsPath}" title=${project.uri.fsPath}>
      ${path.basename(project.prjname)}
    </a>`;
  }

/**
 * Returns html representation of a number.
 */
export function numberHtml(n: number): string {
  return `<span class="number">${n}</span>`;
}

/**
 * Returns html representation of a link to a style-file.
 */
export function styleLink(): string {
  return `<link href= ${vscode.Uri.file(log.Extension.style)} rel="stylesheet" type="text/css"/>`;
}

