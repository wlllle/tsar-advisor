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
import {ProjectEngine, Project,
  ProjectContentProvider, ProjectContentProviderState} from './project';

/**
 * State of a project content provider.
 */
class ProjectProviderState implements ProjectContentProviderState {
  private _provider: ProjectProvider;
  constructor(provider: ProjectProvider) { this._provider = provider; }
  response: any;
  get provider (): ProjectProvider { return this._provider;}
  dispose(): any {}
}

/**
 * Provides a general information about analyzed project.
 */
export class ProjectProvider implements ProjectContentProvider{
  static scheme = "tsar-main";
  private _onDidChange = new vscode.EventEmitter<vscode.Uri>();
  private _engine: ProjectEngine;
  private _response: any;

  constructor(engine: ProjectEngine) { this._engine = engine; }
  dispose() { this._onDidChange.dispose(); }

  /**
   * Returns new description of a project content provider state.
   */
  state(): ProjectProviderState {
    return new ProjectProviderState(this);
  }

  /**
   * Informs listeners about content changes.
   *
   * If this provider has been registered after call of this method
   * provideTextDocumentContent() will be called to update visible content.
   */
  update(project: Project) {
    this._onDidChange.fire(encodeLocation(ProjectProvider.scheme, project.uri));
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
  public provideTextDocumentContent(uri: vscode.Uri): Thenable<string>|string {
    let prjUri = <vscode.Uri>decodeLocation(uri).shift();
    let project = this._engine.project(prjUri);
    if (project === undefined)
      return this._provideUnavailable(prjUri);
    let state = <ProjectProviderState>project.providerState(ProjectProvider.scheme);
    // If there were some responses and they already evaluated then let us
    // evaluate the last one.
    if (project.response !== undefined)
      state.response = project.pop();
    // Prevents asynchronous changes of this._response value.
    let response = state.response;
    return new Promise((resolve, reject) => {
      if (response === undefined || response instanceof msg.Diagnostic)
        return resolve(this._provideWait(project));
      if (response instanceof msg.Statistic)
        return resolve(this._provideStatistic(project, response));
      return resolve(this._provideWait(project));
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
      html += `<li class="summary-item">${numberHtml(files[file])} ${file} ${files[file] !== 1 ? 'files' : 'file'}</li>`
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
    html += `<li>${numberHtml(stat.Traits.Dependency)} unclassified dependencies </li>`;
    count += stat.Traits.Dependency;
    html += `<li>${numberHtml(stat.Traits.AddressAccess)} address accesses </li>`;
    count += stat.Traits.AddressAccess;
    html += '</ul>';
    html = `<p>The following loop traits have been explored (total ${numberHtml(count)}):</p>${html}`;
    return html;
  }

  /**
   * Provides html for analysis statistic.
   */
  private _provideStatistic(project: Project, stat: msg.Statistic): string {
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
          ${styleLink()}
        </head>
        <body>
          <div class="summary-post">
            <h1> Analysis result summary for ${projectLink(project)} </h1>
            ${this._listOfFiles(stat.Files)}
            <p>
              Analyzed files comprise
                ${numberHtml(stat.Functions)} ${stat.Functions !== 1 ? 'functions' : 'function'}
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
   * Provides html for welcome information.
   */
  private _provideWait(project: Project): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          ${styleLink()}
        </head>
        <body>
          <div class="summary-post">
            <h1> Analysis result summary for ${projectLink(project)} </h1>
            <p> Please wait while analysis will be finished... </p>
          </div>
        </body>
      </html>`;
  }

  /**
   * Provides html in case when analysis results is unavailable.
   */
  private _provideUnavailable(uri: vscode.Uri): string {
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
}