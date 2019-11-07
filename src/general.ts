//===--- general.ts ----------- General Provider ------------ TypeScript --===//
//
//                           TSAR Advisor (SAPFOR)
//
// This implements provider for a general information about analyzed project.
//
//===----------------------------------------------------------------------===//

'use strict'

import * as path from 'path';
import {numberHtml, projectLink, commandLink, headHtml,
  UpdateUriFunc} from './functions';
import * as log from './log';
import * as msg from './messages';
import {Project} from './project';
import {ProjectWebviewProvider} from './webviewProvider';

/**
 * Provides a general information about analyzed project.
 */
export class ProjectProvider extends ProjectWebviewProvider {
  static scheme = "tsar-main";

  public scheme(): string { return ProjectProvider.scheme; }

  protected _title(): string { return log.Summary.title; }

  protected _needToHandle(response: any): boolean {
    return response instanceof msg.Statistic;
  }

  /**
   * Provides html for analysis statistic.
   */
  protected _provideContent(project: Project, stat: msg.Statistic,
      asWebviewUri: UpdateUriFunc): string {
    let loopNotAnalyzed = stat.Loops[msg.Analysis.No];
    let loopCount = stat.Loops[msg.Analysis.Yes] + loopNotAnalyzed;
    let htmlLpNotAnalyzed = loopNotAnalyzed == 0 ? '' :
      ' (' +  numberHtml(loopNotAnalyzed) + (loopNotAnalyzed !==1 ?
        ' loops have' : ' loop has') + ' not been analyzed)';
    let varNotAnalyzed = stat.Variables[msg.Analysis.No];
    let varCount = stat.Variables[msg.Analysis.Yes] + varNotAnalyzed;
    let htmlVarNotAnalyzed = varNotAnalyzed == 0 ? '' :
      ' (' +  numberHtml(varNotAnalyzed) + (varNotAnalyzed !==1 ?
        ' variables have' : ' variable has') + ' not been analyzed)';
    return `
    <!doctype html>
    <html lang="en">
      ${headHtml(asWebviewUri)}
      <body class="d-flex flex-column bg-light">
        <div class="container-fluid pt-4">
          <h3> ${this._title().replace('{0}', projectLink(project))} </h3>
          ${this._listOfFiles(stat.Files)}
          <p>
            Analyzed files comprise ${numberHtml(stat.Functions)}
            ${commandLink(
              {
                command: 'tsar.function.list',
                project,
                title: log.FunctionList.title.replace('{0}',path.basename(project.prjname)),
                body: stat.Functions !== 1 ? 'functions' : 'function',
                query: ''
              }
            )}
            with
            ${numberHtml(varCount)} ${varCount !== 1 ? 'variables' : 'variable'}${htmlVarNotAnalyzed}
            and
              ${numberHtml(loopCount)} ${loopCount !== 1 ? 'loops' : 'loop'}${htmlLpNotAnalyzed}.
          </p>
          ${this._listOfTraits(stat)}
        </div>
      </body>
    </html>`;
  }

  /**
   * Return html string represented statistic of analyzed files.
   */
  private _listOfFiles(files: {string:number}): string {
    let html = '<dl class="row">';
    let count = 0;
    for (let file in files) {
      count += files[file];
      html += `<dt class="col-sm-1">${numberHtml(files[file])}</dt>
               <dd class="col-sm-11">${file} ${files[file] !== 1 ? 'files' : 'file'}</dd>`
    }
    html += '</dl>';
    html = `<p>Total number of analyzed files is ${numberHtml(count)} including:</p>${html}`;
    return html;
  }

  /**
   * Return html string represented statistic of explored traits.
   */
  private _listOfTraits(stat: msg.Statistic): string {
    let html = '<dl class="row">';
    let count = 0;
    html += `<dt class="col-sm-1">${numberHtml(stat.Traits.Readonly)}</dt><dd class="col-sm-11">readonly variables</dd>`;
    count += stat.Traits.Readonly;
    html += `<dt class="col-sm-1">${numberHtml(stat.Traits.Shared)}</dt><dd class="col-sm-11">shared variables</dd>`;
    count += stat.Traits.Shared;
    html += `<dt class="col-sm-1">${numberHtml(stat.Traits.Private)}</dt><dd class="col-sm-11">private variables</dd>`;
    count += stat.Traits.Private;
    html += `<dt class="col-sm-1">${numberHtml(stat.Traits.FirstPrivate)}</dt><dd class="col-sm-11">first private variables</dd>`;
    count += stat.Traits.FirstPrivate;
    html += `<dt class="col-sm-1">${numberHtml(stat.Traits.LastPrivate)}</dt><dd class="col-sm-11">last private variables</dd>`;
    count += stat.Traits.LastPrivate;
    html += `<dt class="col-sm-1">${numberHtml(stat.Traits.DynamicPrivate + stat.Traits.SecondToLastPrivate)}</dt><dd class="col-sm-11">dynamic private variables</dd>`;
    count += stat.Traits.DynamicPrivate + stat.Traits.SecondToLastPrivate;
    html += `<dt class="col-sm-1">${numberHtml(stat.Traits.Reduction)}</dt><dd class="col-sm-11">reduction variables</dd>`;
    count += stat.Traits.Reduction;
    html += `<dt class="col-sm-1">${numberHtml(stat.Traits.Induction)}</dt><dd class="col-sm-11">induction variables</dd>`;
    count += stat.Traits.Induction;
    html += `<dt class="col-sm-1">${numberHtml(stat.Traits.Flow)}</dt><dd class="col-sm-11">flow dependencies</dd>`;
    count += stat.Traits.Flow;
    html += `<dt class="col-sm-1">${numberHtml(stat.Traits.Anti)}</dt><dd class="col-sm-11">anti dependencies</dd>`;
    count += stat.Traits.Anti;
    html += `<dt class="col-sm-1">${numberHtml(stat.Traits.Output)}</dt><dd class="col-sm-11">output dependencies</dd>`;
    count += stat.Traits.Output;
    html += `<dt class="col-sm-1">${numberHtml(stat.Traits.AddressAccess)}</dt><dd class="col-sm-11">address accesses</dd>`;
    count += stat.Traits.AddressAccess;
    html += `<dt class="col-sm-1">${numberHtml(stat.Traits.HeaderAccess)}</dt><dd class="col-sm-11">header accesses</dd>`;
    count += stat.Traits.HeaderAccess;
    html += '</dl>';
    html = `<p>The following loop traits have been explored (total ${numberHtml(count)}):</p>${html}`;
    return html;
  }
}
