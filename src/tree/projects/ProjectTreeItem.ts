import { TreeItem } from "vscode";

export class ProjectTreeItem extends TreeItem {
  private project: ProjectJsonObject;

  constructor(project: ProjectJsonObject) {
    super(project.projectName);
    this.project = project;
  }
}