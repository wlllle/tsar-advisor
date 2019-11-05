//===--- general.ts ----------- General Provider ------------ TypeScript --===//
//
//                           TSAR Advisor (SAPFOR)
//
// This implements provider for a general information about analyzed project.
//
//===----------------------------------------------------------------------===//

'use strict'

import * as path from 'path';
import {projectLink, commandLink, numberHtml, styleLink,
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
    <!DOCTYPE html>
    <html>
      <head>
        ${styleLink(asWebviewUri)}
      </head>
      <body>
        <div class="summary-post">
          <h1> ${this._title().replace('{0}', projectLink(project))} </h1>
          ${this._listOfFiles(stat.Files)}
          <p>
            Analyzed files comprise
              ${numberHtml(stat.Functions)} ${commandLink(
                  'tsar.function.list', project,
                  log.FunctionList.title.replace(
                    '{0}', path.basename(project.prjname)),
                  stat.Functions !== 1 ? 'functions' : 'function', '')}
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
    let html = '<ul class="summary-item-list">';
    let count = 0;
    for (let file in files) {
      count += files[file];
      html += `<li class="summary-item">${numberHtml(files[file])} ${file} ${files[file] !== 1 ? 'files' : 'file'}</li>`
    }
    html += '</ul>';
    html = `<p>Total number of analyzed files is ${numberHtml(count)} including:</p>${html}`;
    return html;
  }

  /**
   * Return html string represented statistic of explored traits.
   */
  private _listOfTraits(stat: msg.Statistic): string {
    let html = '<ul class="summary-item-list">';
    let count = 0;
    html += `<li>${numberHtml(stat.Traits.Readonly)} readonly variables </li>`;
    count += stat.Traits.Readonly;
    html += `<li>${numberHtml(stat.Traits.Shared)} shared variables </li>`;
    count += stat.Traits.Shared;
    html += `<li>${numberHtml(stat.Traits.Private)} private variables </li>`;
    count += stat.Traits.Private;
    html += `<li>${numberHtml(stat.Traits.FirstPrivate)} first private variables </li>`;
    count += stat.Traits.FirstPrivate;
    html += `<li>${numberHtml(stat.Traits.LastPrivate)} last private variables </li>`;
    count += stat.Traits.LastPrivate;
    html += `<li>${numberHtml(stat.Traits.DynamicPrivate + stat.Traits.SecondToLastPrivate)} dynamic private variables </li>`;
    count += stat.Traits.DynamicPrivate + stat.Traits.SecondToLastPrivate;
    html += `<li>${numberHtml(stat.Traits.Reduction)} reduction variables </li>`;
    count += stat.Traits.Reduction;
    html += `<li>${numberHtml(stat.Traits.Induction)} induction variables </li>`;
    count += stat.Traits.Induction;
    html += `<li>${numberHtml(stat.Traits.Flow)} flow dependencies </li>`;
    count += stat.Traits.Flow;
    html += `<li>${numberHtml(stat.Traits.Anti)} anti dependencies </li>`;
    count += stat.Traits.Anti;
    html += `<li>${numberHtml(stat.Traits.Output)} output dependencies </li>`;
    count += stat.Traits.Output;
    html += `<li>${numberHtml(stat.Traits.AddressAccess)} address accesses </li>`;
    count += stat.Traits.AddressAccess;
    html += `<li>${numberHtml(stat.Traits.HeaderAccess)} header accesses </li>`;
    count += stat.Traits.HeaderAccess;
    html += '</ul>';
    html = `<p>The following loop traits have been explored (total ${numberHtml(count)}):</p>${html}`;
    return html;
  }
}
