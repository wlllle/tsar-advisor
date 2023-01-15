import * as path from 'path';
import { TreeItem, TreeItemCollapsibleState, Uri } from 'vscode'

export class ProjectFileTreeItem extends TreeItem {
  private _projectFile: ProjectFileJsonObject;
  private _fileName: string;
  private _fullPath: string;

  constructor(projectFile: ProjectFileJsonObject) {
    let fileName = path.parse(projectFile.file).base;
    let fullPath = path.join(projectFile.directory, projectFile.file);
    super(fileName, TreeItemCollapsibleState.None);
    this._projectFile = projectFile;
    this._fileName = fileName;
    this._fullPath = fullPath;
    this.command = {
      command: "vscode.open", title: "", arguments: [Uri.file(fullPath)]
    };
  }
}