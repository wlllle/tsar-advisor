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
import * as msg from './messages';

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
    command: string, project: Project, title: string, body: string, query: string): string {
  let uri = project.uri.with({query: query});
  return `
    <a class="source-link"
       href="${encodeURI(
         'command:' + command + '?' + JSON.stringify(uri))}"
       title="${title}">
      ${body}</a>`;
}

/**
 * Returns html representation of a link to a project.
 *
 * This link invokes a command 'tsar.open-project'.
 */
export function projectLink(project: Project): string {
  return commandLink('tsar.open-project', project,
      project.uri.fsPath, path.basename(project.prjname), '');
}

export function moveToCode(project: Project, body: string, query: string) {
  return commandLink('tsar.open-project', project,
      'Move to code', body, query);
}

/**
 * Returns html representation of a number.
 */
export function numberHtml(n: number): string {
  return `<span class="number">${n}</span>`;
}

 /**
  * A function to update uri before it is inserted into html.
  */
export type UpdateUriFunc = (uri: vscode.Uri) => vscode.Uri;

/**
 * Returns html representation of a link to a style-file.
 * @param updateUri A function to update uri before it is inserted into html.
 */
export function styleLink(
    updateUri: UpdateUriFunc = (uri => { return uri })): string {
  return `<link href= ${updateUri(vscode.Uri.file(log.Extension.style))} rel="stylesheet" type="text/css"/>`;
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
 * @param updateUri A function to update uri before it is inserted into html.
 */
export function waitHtml(title: string, project: Project,
    updateUri: UpdateUriFunc = (uri => {return uri})): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        ${styleLink(updateUri)}
      </head>
      <body>
        <div class="summary-post">
          <h1> ${title.replace('{0}', projectLink(project))} </h1>
          <p> Please wait while analysis will be finished... </p>
        </div>
      </body>
    </html>`;
}

export function checkTrait(trait: string, link = undefined): string {
  if (trait == "Yes") {
    if (link != undefined)
      return `<td>` + commandLink(link.command, link.project, link.title, `&#10003;`, link.query) + `</td>`;
    return `<td>&#10003;</td>`;
  } else {
    return `<td>&minus;</td>`;
  }
}

export function getStrLocation(project: Project, Loc: msg.Location, ): string {
  if ((Loc.Line == Loc.MacroLine) &&
      (Loc.Column == Loc.MacroColumn)) {
    let loc = `${Loc.Line}:${Loc.Column}`;
    let locquery = {Line: Loc.Line, Column: Loc.Column};
    return `${moveToCode(project, loc, JSON.stringify(locquery))}`;
  } else {
    let macroloc = `${Loc.MacroLine}:${Loc.MacroColumn}`;
    let loc = `${Loc.Line}:${Loc.Column}`;
    let macrolocquery = {Line: Loc.MacroLine, Column: Loc.MacroColumn};
    let locquery = {Line: Loc.Line, Column: Loc.Column};
    return `${moveToCode(project, loc, JSON.stringify(locquery))}
        (${moveToCode(project, macroloc, JSON.stringify(macrolocquery))})`;
  }
}
