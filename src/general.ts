//===--- general.ts ----------- General Provider ------------ TypeScript --===//
//
//                           TSAR Advisor (SAPFOR)
//
//===----------------------------------------------------------------------===//
//
// This implements provider for a general information about analyzed project.
//
//===----------------------------------------------------------------------===//

'use strict'

import * as path from 'path';
import * as vscode from 'vscode';
import {decodeLocation, encodeLocation,
  projectLink, numberHtml, styleLink} from './functions';
import * as log from './log';
import * as msg from './messages';
import {Project, ProjectContentProvider} from './project';

/**
 * Provides a general information about analyzed project.
 */
export class ProjectProvider implements ProjectContentProvider{
  static scheme = "tsar-main";
  private _onDidChange = new vscode.EventEmitter<vscode.Uri>();
  private _project;

  constructor(project: Project) { this._project = project; }
  dispose() { this._onDidChange.dispose(); }

  /**
   * Informs listeners about content changes.
   *
   * If this provider has been registered after call of this method
   * provideTextDocumentContent() will be called to update visible content.
   */
  public update() {
    this._onDidChange.fire(
      encodeLocation(
        this._project.providerScheme(ProjectProvider.scheme),
        this._project.uri));
  }

  /**
   * Returns event to subscribe for content changes.
   */
  get onDidChange(): vscode.Event<vscode.Uri> {
    return this._onDidChange.event;
  }

  /**
   * Provides html with general information about analyzed project.
   */
  public provideTextDocumentContent(uri: vscode.Uri): Thenable<string> {
    let response = this._project.pop();
    // If there were some responses and they already evaluated then let us
    // evaluate the last one.
    if (response === undefined)
      response = this._project.response;
    return new Promise((resolve, reject) => {
      if (response === undefined || response instanceof msg.Diagnostic)
        return resolve(this._provideWait());
      if (response instanceof msg.Statistic)
        return resolve(this._provideStatistic(response));
      return resolve(this._provideWait());
    });
  }

  /**
   * Returns html string represented statistic of analyzed files.
   */
  private _listOfFiles(files: {string:number}): string {
    let html = '<ul class="summary-item-list">';
    let count = 0;
    for (let file in files) {
      count += files[file];
      html += `<li class="summary-item">${numberHtml(files[file])} ${file}</li>`
    }
    html += '</ul>';
    html = `<p>Total number of analyzed files is ${numberHtml(count)} including:</p>${html}`;
    return html;
  }

  /**
   * Returns html string represented statistic of explored traits.
   */
  private _listOfTraits(stat: msg.Statistic): string {
    let html = '<ul class="summary-item-list">';
    let count = 0;
    html += `<li>${numberHtml(stat.Privates)} private variables </li>`;
    count += stat.Privates;
    html += `<li>${numberHtml(stat.FirstPrivates)} first private variables </li>`;
    count += stat.FirstPrivates;
    html += `<li>${numberHtml(stat.LastPrivates)} last private variables </li>`;
    count += stat.LastPrivates;
    html += `<li>${numberHtml(stat.DynamicPrivates)} dynamic private variables </li>`;
    count += stat.DynamicPrivates;
    html += `<li>${numberHtml(stat.Reductions)} reduction variables </li>`;
    count += stat.Reductions;
    html += `<li>${numberHtml(stat.Dependencies)} number of unclassified dependencies </li>`;
    count += stat.Dependencies;
    html += '</ul>';
    html = `<p>The following loop traits have been explored (total ${numberHtml(count)}):</p>${html}`;
    return html;
  }

  /**
   * Provides html for analysis statistic.
   */
  private _provideStatistic(stat: msg.Statistic): string {
    let loopNotAnalyzed = stat.Loops[msg.Analysis.No];
    let loopCount = stat.Loops[msg.Analysis.Yes] + loopNotAnalyzed;
    let htmlLpNotAnalyzed = loopNotAnalyzed == 0 ? '' :
      ' (' +  numberHtml(loopNotAnalyzed) + (loopNotAnalyzed !==1 ?
        ' loops have' : ' loop has') + ' not been analyzed)';
    return `
      <!DOCTYPE html>
      <html>
        <head>
          ${styleLink()}
        </head>
        <body>
          <div class="summary-post">
            <h1> Analysis result summary for ${projectLink(this._project)} </h1>
            ${this._listOfFiles(stat.Files)}
            <p>
              Analyzed files comprise
                ${numberHtml(stat.Functions)} ${stat.Functions !== 1 ? 'functions' : 'function'}
              with
                ${numberHtml(loopCount)} ${loopCount !== 1 ? 'loops' : 'loop'}${htmlLpNotAnalyzed}.
            </p>
            ${this._listOfTraits(stat)}
          </div>
        </body>
      </html>`;
  }

  /**
   * Provides html for welcome information.
   */
  private _provideWait(): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          ${styleLink()}
        </head>
        <body>
          <div class="summary-post">
            <h1> Analysis result summary for ${projectLink(this._project)} </h1>
            <p> Please wait while analysis will be finished... </p>
          </div>
        </body>
      </html>`;
  }
}