import * as log from '../../log';
import * as fs from 'fs';
import { TreeDataProvider, workspace } from 'vscode';
import { ProjectTreeItem } from './ProjectTreeItem';
import path = require('path');
import { ProjectFileTreeItem } from './ProjectFileTreeItem';

type ProjectArtifactTreeItem = ProjectTreeItem | ProjectFileTreeItem;

export class ProjectTreeDataProvider
implements TreeDataProvider<ProjectArtifactTreeItem> {
  // Should be the same as "activationEvents": ["workspaceContains:..."]
  static projectFilePath = './.tsar/projects.json'

  getTreeItem(element: ProjectArtifactTreeItem): ProjectArtifactTreeItem {
    return element;
  }

  getChildren(element?: ProjectArtifactTreeItem): ProjectArtifactTreeItem[] {
    if (element === undefined) {
      return this.getProjects();
    }

    if (element instanceof ProjectFileTreeItem){
      return null;
    }

    return this.getProjectItems(element);
  }

  private getProjects(): ProjectTreeItem[] {
    let projects: Array<ProjectJsonObject>;
    try {
      let currentWorkspaceDirectory = workspace.workspaceFolders[0].uri.fsPath;
      let projectJsonPath = path.resolve(currentWorkspaceDirectory, ProjectTreeDataProvider.projectFilePath);
      let json = fs.readFileSync(projectJsonPath);
      projects = JSON.parse(json.toString());
    } catch (error) {
      throw new Error(
        `${log.Extension.displayName}: ${log.Error.internal}: ${log.Error.invalidProjectsJson} '${ProjectTreeDataProvider.projectFilePath}'`);
    }

    return projects.map(project => new ProjectTreeItem(project));
  }

  private getProjectItems(project: ProjectTreeItem): ProjectFileTreeItem[] {
    return project.getProjectItems();
  }
}