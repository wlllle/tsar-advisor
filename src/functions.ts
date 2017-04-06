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

import * as child_process from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
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
 * This returns environment key-value pairs which is necessary to compile
 * sources on Win32 platform. On error this returners 'undefined'.
 *
 * This tries to find MS Visual Studio C\C++ compiler with the highest version.
 */
export function establishVSEnvironment(onerror: (err: any) => any): any {
  if (!process.platform.match(/^win/i)) {
    onerror(new Error(log.Error.osIncompatible.replace('{0}', 'win32')));
    return undefined;
  }
  let versions = [];
  for (let variable in process.env) {
    let match = variable.match(/^VS\d+COMNTOOLS$/i);
    if (!match)
      continue;
    versions.push(match[0]);
  }
  versions.sort();
  while(versions.length) {
    let vsvars = path.resolve(`${process.env[versions.pop()]}`, 'vsvars32.bat');
    try {
      if (!fs.existsSync(vsvars))
        continue;
      let stat = fs.statSync(vsvars);
      if (stat.isDirectory())
        continue;
      let stdout = child_process.execSync(`"${vsvars}" && set`, {encoding: 'utf8'});
      let env = stdout.split(/\r?\n/).reduce((prev, curr) => {
        let pair = curr.split(/=/);
        if (pair.length == 2)
          prev[pair[0]] = pair[1];
        return prev;
      }, {});
      return env;
    }
    catch(err) {
      onerror(err);
    }
  }
  return undefined;
}

/**
 * Returns html representation of a link which invokes a specified command.
 *
 * TODO (kaniandr@gmail.com): add arguments to specify parameters of a command.
 */
export function commandLink(
    command: string, project: Project, title: string, body: string): string {
  return `
    <a class="source-link"
       href="${encodeURI(
         'command:' + command + '?' + JSON.stringify(project.uri))}"
       title="${title}">
      ${body}
    </a>`;
}

/**
 * Returns html representation of a link to a project.
 *
 * This link invokes a command 'tsar.open-project'.
 */
export function projectLink(project: Project): string {
  return commandLink('tsar.open-project', project,
   project.uri.fsPath, path.basename(project.prjname));
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

/**
 * Provides html in case when analysis results is unavailable.
 */
export function unavailableHtml(uri: vscode.Uri): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        ${styleLink()}
      </head>
      <body>
        <div class="summary-post">
          <h1> Sorry, ${log.Error.unavailable} </h1>
          <p>
            <a class="source-link"
                href="${encodeURI('command:tsar.start?' + JSON.stringify(uri))}">
              Try to restart...
            </a>
          </p>
        </div>
      </body>
    </html>`;
}

/**
 * Provides html for welcome information.
 */
export function waitHtml(title: string, project: Project): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        ${styleLink()}
      </head>
      <body>
        <div class="summary-post">
          <h1> ${title.replace('{0}', projectLink(project))} </h1>
          <p> Please wait while analysis will be finished... </p>
        </div>
      </body>
    </html>`;
}
