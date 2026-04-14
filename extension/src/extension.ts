// src/extension.ts
import * as vscode from "vscode";
import { DriftTreeDataProvider, StackItem } from "./treeDataProvider";
import { ChatbotViewProvider } from "./chatbotViewProvider";
import { linkBuilders } from "./types/constants";
import { runDriftDetection } from "./services/stackService";
import {
  formatAndDisplayDriftResults,
  formatDriftStatus,
} from "./utils/formatting";
import { initDatabase } from "./db/sqlite";

export async function activate(context: vscode.ExtensionContext) {
  const driftProvider = new DriftTreeDataProvider();
  const chatBotView = new ChatbotViewProvider(context.extensionUri);

  await initDatabase(context);

  console.log("SQLite initialized");

  vscode.window.registerTreeDataProvider("driftAnalyzer", driftProvider);
  // ✅ only this registration is needed
  vscode.window.registerWebviewViewProvider(
    ChatbotViewProvider.viewType,
    chatBotView
  );

  vscode.commands.registerCommand("driftAnalyzer.refreshStack", () =>
    driftProvider.refresh()
  );
  vscode.commands.registerCommand(
    "resource.openResourceOnAws",
    (resourceType, physicalId) => {
      const builder = linkBuilders[resourceType as keyof typeof linkBuilders];
      console.log(builder ? builder(physicalId) : physicalId);

      if (!builder)
        vscode.window.showInformationMessage(`Error building link for...`);

      const uri = vscode.Uri.parse(
        builder ? builder(physicalId) : "https://console.aws.amazon.com/"
      );
      vscode.env.openExternal(uri);
    }
  );

  const runDriftCheck = vscode.commands.registerCommand(
    "driftAnalyzer.runDriftCheck",
    async (item: StackItem) => {
      const { StackName } = item.stack;

      if (!StackName) {
        vscode.window.showErrorMessage(
          "Stack name is required for drift detection"
        );
        return;
      }

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: `Running drift check for ${StackName}`,
          cancellable: false,
        },
        async (progress) => {
          progress.report({
            increment: 0,
            message: "Starting drift detection...",
          });

          try {
            const result = await runDriftDetection(StackName);

            if (result instanceof Error) {
              vscode.window.showErrorMessage(
                `Drift detection failed for ${StackName}: ${result.message}`
              );
              return;
            }

            progress.report({
              increment: 50,
              message: "Analyzing drift results...",
            });

            const {
              stackDriftStatus,
              driftedStackResourceCount,
              detectionStatus,
            } = result;

            // ✅ Use helper function for status message formatting
            const { statusIcon, statusMessage } = formatDriftStatus(
              StackName,
              stackDriftStatus,
              driftedStackResourceCount,
              detectionStatus
            );

            progress.report({ increment: 100, message: "Complete!" });

            vscode.window.showInformationMessage(
              `${statusIcon} ${statusMessage}`
            );

            // ✅ Use helper function for output formatting
            formatAndDisplayDriftResults(StackName, result);
          } catch (error) {
            vscode.window.showErrorMessage(
              `Unexpected error during drift detection for ${StackName}: ${error}`
            );
          }
        }
      );
    }
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("driftAnalyzer.newChatSession", () =>
      chatBotView.newSession(true)
    ),

    vscode.commands.registerCommand("driftAnalyzer.chatHistory", () =>
      chatBotView.showHistory()
    ),

    vscode.commands.registerCommand("driftAnalyzer.clearChat", () =>
      chatBotView.clearChat()
    )
  );

  context.subscriptions.push(runDriftCheck);
}

export function deactivate() {}
