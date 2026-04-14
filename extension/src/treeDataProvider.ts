// src/treeDataProvider.ts
import {
  StackResourceSummary,
  StackSummary,
} from "@aws-sdk/client-cloudformation";

import * as vscode from "vscode";
import { listAllStacks, listStackResources } from "./services/stackService";
import { statusFilter } from "./types/constants";

export class StackItem extends vscode.TreeItem {
  constructor(public readonly stack: StackSummary) {
    super(
      stack.StackName ?? "Unknown Stack",
      vscode.TreeItemCollapsibleState.Collapsed
    );
    this.tooltip = `Stack: ${stack.StackName}\nStatus: ${stack.StackStatus}`;

    this.description = stack.CreationTime
      ? `${stack.CreationTime.getDate()}/${
          stack.CreationTime.getMonth() + 1
        }/${stack.CreationTime.getFullYear()}`
      : "UNDEFINED_UPDATED_TIME";

    if (
      !stack.DriftInformation ||
      stack.DriftInformation.StackDriftStatus === "NOT_CHECKED"
    ) {
      this.iconPath = new vscode.ThemeIcon("circle-outline");
    } else if (stack.DriftInformation.StackDriftStatus === "DRIFTED") {
      this.iconPath = new vscode.ThemeIcon("warning");
    } else if (stack.DriftInformation.StackDriftStatus === "IN_SYNC") {
      this.iconPath = new vscode.ThemeIcon("check");
    } else if (stack.DriftInformation.StackDriftStatus === "UNKNOWN") {
      this.iconPath = new vscode.ThemeIcon("question");
    }

    this.command = {
      command: "driftAnalyzer.runDriftCheck",
      title: "Run Drift Check",
    };
    this.contextValue = "stackItem";
  }
}
class StatusGroupItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly children: StackItem[]
  ) {
    super(label, vscode.TreeItemCollapsibleState.Collapsed);
    this.iconPath = new vscode.ThemeIcon("folder");
    this.description = `${children.length} stack(s)`;
  }
}

class ResourceItem extends vscode.TreeItem {
  constructor(public readonly stackResource: StackResourceSummary) {
    super(
      stackResource.ResourceType ? stackResource.ResourceType : "UNDEFINED",
      vscode.TreeItemCollapsibleState.None
    );
    this.command = {
      command: "resource.openResourceOnAws",
      title: "Open resource on AWS",
      arguments: [stackResource.ResourceType, stackResource.PhysicalResourceId],
    };
  }
}

export class DriftTreeDataProvider
  implements vscode.TreeDataProvider<vscode.TreeItem>
{
  private _onDidChangeTreeData: vscode.EventEmitter<
    vscode.TreeItem | undefined | void
  > = new vscode.EventEmitter<vscode.TreeItem | undefined | void>();
  readonly onDidChangeTreeData: vscode.Event<
    vscode.TreeItem | undefined | void
  > = this._onDidChangeTreeData.event;

  private stacks: StackSummary[] = [];

  constructor() {
    this.refresh();
  }

  private async loadStacks() {
    const data = await listAllStacks();

    if (data instanceof Error) {
      console.error("Failed to list stacks:", data);
      return;
    }

    this.stacks = data;
  }

  async refresh() {
    await this.loadStacks();
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: StackItem | StatusGroupItem) {
    return element; // both already extend TreeItem
  }

  async getChildren(element?: vscode.TreeItem) {
    if (!element) {
      // Root: return one node per status category
      if (!statusFilter) {
        console.error("Status filter is undefined");
        return;
      }

      const groups: Record<string, StackItem[]> = Object.fromEntries(
        statusFilter.map((status) => [status, []])
      );

      for (const stack of this.stacks) {
        const status = stack.StackStatus ?? "UNKNOWN";
        if (!groups[status]) groups[status] = [];
        groups[status].push(new StackItem(stack));
      }

      return Object.entries(groups).map(
        ([status, items]) => new StatusGroupItem(status, items)
      );
    } else if (element instanceof StatusGroupItem) {
      // Expanded group: return its stacks
      return element.children;
    } else if (element instanceof StackItem) {
      if (!element.stack.StackId) return [];
      const resources = await listStackResources(element.stack.StackId);

      if (resources instanceof Error) {
        console.error("Failed to list stacks:", resources);
        return;
      }

      if (!resources.StackResourceSummaries) return [];

      return resources.StackResourceSummaries.map(
        (resource) => new ResourceItem(resource)
      );
    }
  }

  updateStackStatus(name: string, status: StackSummary["StackStatus"]) {
    const stack = this.stacks.find((s) => s.StackName === name);
    if (stack) {
      stack.StackStatus = status;
      // StackSummary does not have lastChecked, so we skip it
    }
    this.refresh();
  }
}
function ListStackResources() {
  throw new Error("Function not implemented.");
}
