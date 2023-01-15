import * as log from '../../log';
import * as fs from 'fs';
import { TreeItem, TreeItemCollapsibleState } from 'vscode'
import { ProjectFileTreeItem } from './ProjectFileTreeItem';

export class ProjectTreeItem extends TreeItem {
  private project: ProjectJsonObject;

  constructor(project: ProjectJsonObject) {
    super(project.projectName, TreeItemCollapsibleState.Collapsed);
    this.project = project;
    this.contextValue = 'project';
  }

  getProjectItems() {
    let compilationObjects: Array<ProjectFileJsonObject>;
    try {
      let json = fs.readFileSync(this.project.compilationDatabase);
      // TODO: Cache after first get
      compilationObjects = JSON.parse(json.toString());
      return compilationObjects.map(compilationObject => new ProjectFileTreeItem(compilationObject));
    } catch (error) {
      throw new Error(
        `${log.Extension.displayName}: ${log.Error.internal}: ${log.Error.invalidProjectCompilationDatabase} '${this.project.compilationDatabase}'`);
    }
  }
}