import * as vscode from 'vscode';
import { ProjectTreeDataProvider } from './projects/ProjectTreeDataProvider';

export function registerTrees(): void {
    const projectTree = new ProjectTreeDataProvider();
    vscode.window.registerTreeDataProvider('tsar.projects', projectTree);
}