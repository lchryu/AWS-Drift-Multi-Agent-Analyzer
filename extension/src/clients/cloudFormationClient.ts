import * as vscode from "vscode";
import { CloudFormationClient } from "@aws-sdk/client-cloudformation";

// Keep a single shared client instance
let cloudformationClient: CloudFormationClient;
let region: string;

// Create a helper to (re)create the client
function initCloudFormationClient() {
  const config = vscode.workspace.getConfiguration("myExtension");
  const region = config.get<string>("awsRegion") || "us-east-1";
  return new CloudFormationClient({ region });
}

// Initialize the client at startup
cloudformationClient = initCloudFormationClient();
region =
  vscode.workspace.getConfiguration("myExtension").get<string>("awsRegion") ||
  "us-east-1";

// 🔑 Listen for changes to the setting
vscode.workspace.onDidChangeConfiguration((event) => {
  if (event.affectsConfiguration("myExtension.awsRegion")) {
    cloudformationClient = initCloudFormationClient();
    region =
      vscode.workspace
        .getConfiguration("myExtension")
        .get<string>("awsRegion") || "us-east-1";
    vscode.window.showInformationMessage(`AWS region changed to: ${region}`);
  }
});

export { cloudformationClient, region };
