import * as log from '../../log';
import * as fs from 'fs';
import { ProviderResult, TreeDataProvider, TreeItem, workspace } from 'vscode'
import { ProjectTreeItem } from './ProjectTreeItem';
import path = require('path');

export class ProjectTreeDataProvider implements TreeDataProvider<ProjectTreeItem>{
  // Should be the same as "activationEvents": ["workspaceContains:..."]
  static projectFilePath = './.tsar/projects.json'

  getTreeItem(element: ProjectTreeItem): TreeItem {
    return element;
  }

  getChildren(element?: ProjectTreeItem): ProviderResult<ProjectTreeItem[]> {
    if (element) {
      return null;
    }

    let projects: Array<ProjectJsonObject>;
    try {
      let currentWorkspaceDirectory = workspace.workspaceFolders[0].uri.fsPath;
      let projectJsonPath = path.resolve(currentWorkspaceDirectory, ProjectTreeDataProvider.projectFilePath);
      let json = fs.readFileSync(projectJsonPath)
      projects = JSON.parse(json.toString());
    } catch (error) {
      throw new Error(
        `${log.Extension.displayName}: ${log.Error.internal}: ${log.Error.invalidProjectsJson} '${ProjectTreeDataProvider.projectFilePath}'`);
    }

    return projects.map(project => new ProjectTreeItem(project));
  }
}