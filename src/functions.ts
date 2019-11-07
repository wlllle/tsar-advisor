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

export type DisposableLikeList = { dispose(): any }[];

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
 * Return html representation of a link which invokes a specified command.
 * @param query String or JSON representation of command arguments.
 */
export function commandLink({ command, project, title, body, query }:
    {
      command: string;
      project: Project;
      title: string;
      body: string;
      query: any;
    }): string {
  let uri = project.uri.with({
    query: typeof query === 'string' ? query : JSON.stringify(query)
  });
  return `
    <a class="source-link"
       href="${encodeURI(
         'command:' + command + '?' + JSON.stringify(uri))}"
       title="${title}">
      ${body}</a>`;
}

/**
 * Return html representation of a link to a project.
 *
 * This link invokes a command 'tsar.open-project'.
 */
export function projectLink(project: Project): string {
  return commandLink({
    command: 'tsar.open-project', project,
    title: project.uri.fsPath,
    body: path.basename(project.prjname),
    query: ''
  });
}

/**
 * Return html representation of a link to a location in a source code.
 */
export function gotoSpellingLocLink({ project, body, line, column }:
    {
      project: Project;
      body: string;
      line: number;
      column: number;
    }):string {
  return commandLink({
    command: 'tsar.open-project', project,
    title: 'Go to Source Code', body,
    query: JSON.stringify({Line: line, Column: column})
  });
}

/**
 * Return html representation of a link to expansion locations.
 * 
 * @returns Link `line:column` if location is not in macro or
 *          `line:column(macro-line:macro-column)`.
 */
export function gotoExpansionLocLink(project: Project, Loc: msg.Location, ): string {
  if ((Loc.Line == Loc.MacroLine) &&
      (Loc.Column == Loc.MacroColumn)) {
    let loc = `${Loc.Line}:${Loc.Column}`;
    return `${gotoSpellingLocLink({ project, body: loc, line: Loc.Line, column: Loc.Column })}`;
  }
  let macroloc = `${Loc.MacroLine}:${Loc.MacroColumn}`;
  let loc = `${Loc.Line}:${Loc.Column}`;
  return `
    ${gotoSpellingLocLink({ project, body: loc,line: Loc.Line, column: Loc.Column })}
    (${gotoSpellingLocLink({ project, body: macroloc, line: Loc.MacroLine, column: Loc.MacroColumn })})`;
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
 * Return html representation of a link to a style-file.
 * @param updateUri A function to update uri before it is inserted into html.
 */
export function styleLink(
    updateUri: UpdateUriFunc = (uri => { return uri })): string {
  return `<link href = ${updateUri(vscode.Uri.file(log.Extension.style))} rel="stylesheet" type="text/css"/>`;
}

/**
 * Return html link to Bootstrap CSS file.
 * @param updateUri A function to update uri before it is inserted into html.
 */
export function bootstrapCSSLink(
    updateUri: UpdateUriFunc = (uri => { return uri })): string {
  return `<link href = ${updateUri(vscode.Uri.file(
      path.resolve(log.Extension.bootstrap, 'css', 'bootstrap.min.css')))}
    rel="stylesheet" type="text/css">`;
}

/**
 * Return html to use Bootstrap JS scripts.
 * @param updateUri A function to update uri before it is inserted into html.
 */
export function bootstrapJSLink(
    updateUri: UpdateUriFunc = (uri => { return uri })): string {
  return `<script src = ${updateUri(vscode.Uri.file(
      path.resolve(log.Extension.bootstrap, 'js', 'bootstrap.bundle.min.js')))}></script>`
}

/**
 * Return html to use JQuery JS scripts.
 * @param updateUri A function to update uri before it is inserted into html.
 */
export function jqueryJSLink(
    updateUri: UpdateUriFunc = (uri => { return uri })): string {
  return `<script src = ${updateUri(vscode.Uri.file(
      path.resolve(log.Extension.jquery, 'jquery.min.js')))}></script>`
}

/**
 * Return default html head.
 * @param updateUri A function to update uri before it is inserted into html.
 */
export function headHtml(
    updateUri: UpdateUriFunc = (uri => { return uri })): string {
  return `
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no">
      ${bootstrapCSSLink(updateUri)}
      ${styleLink(updateUri)}
      ${jqueryJSLink(updateUri)}
      ${bootstrapJSLink(updateUri)}
    </head>
  `;
}

/**
 * Provide html for loading...
 * @param updateUri A function to update uri before it is inserted into html.
 */
export function waitHtml(title: string, project: Project,
    updateUri: UpdateUriFunc = (uri => {return uri})): string {
  return `
    <!DOCTYPE html>
    <html>
      ${headHtml(updateUri)}
      <body class="d-flex flex-column bg-light text-secondary">
        <div class="container-fluid pt-4">
          <h3> ${title.replace('{0}', projectLink(project))} </h3>
          <div class="text-center">
            <div class="spinner-border spiner-border-sm" role="status">
              <span class="sr-only">Loading...</span>
            </div>
          </div>
        </div>
      </body>
    </html>`;
}
