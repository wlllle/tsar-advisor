import * as path from 'path';
import { TreeItem, TreeItemCollapsibleState } from 'vscode'

export class ProjectFileTreeItem extends TreeItem {
  private projectFile: ProjectFileJsonObject;

  constructor(projectFile: ProjectFileJsonObject) {
    let fileName = path.parse(projectFile.file).base
    super(fileName, TreeItemCollapsibleState.None);
    this.projectFile = projectFile;
  }
}