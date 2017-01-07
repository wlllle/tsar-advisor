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
export function encodeLocation(scheme: string, prjUri: vscode.Uri,
    uri?: vscode.Uri, pos?: vscode.Position): vscode.Uri {
  let project = JSON.stringify(prjUri.toString());
  let query = [];
  if (uri)
    query.push(uri.toString());
  if (pos)
    query.push(pos.line, pos.character);
  return vscode.Uri.parse(`${scheme}://${project}?${JSON.stringify(query)}`);
}

/**
 * Decodes location for content provider,
 * returns [uri of project, additional uri, and position].
 */
export function decodeLocation(uri: vscode.Uri):
    [vscode.Uri, vscode.Uri, vscode.Position] {
  let project = vscode.Uri.parse(JSON.parse(uri.authority + uri.path));
  let [target, line, ch] = <[string, number, number]>JSON.parse(uri.query);
  return [
    project,
    target === undefined ? undefined : vscode.Uri.parse(target),
    line === undefined || ch === undefined ? undefined : new vscode.Position(line, ch)
  ];
}

/**
 * Returns html representation of a link to a project.
 */
export function projectLink(project: Project): string {
  return `
    <a class="source-link"
       href="${encodeURI('command:tsar.open-project?' + JSON.stringify(project.uri))}"
       title=${project.uri.fsPath}>
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

