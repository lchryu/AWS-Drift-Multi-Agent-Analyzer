import * as vscode from "vscode";
import { region } from "../clients/cloudFormationClient";

// Create a helper to (re)create the client
function initStatusFilter() {
  const config = vscode.workspace.getConfiguration("myExtension");
  const selectedFilters = config.get<string[]>("statusFilter"); // for multi-select
  return selectedFilters;
}

let statusFilter = initStatusFilter();

// 🔑 Listen for changes to the setting
vscode.workspace.onDidChangeConfiguration((event) => {
  if (event.affectsConfiguration("myExtension.statusFilter")) {
    statusFilter = initStatusFilter();
    vscode.window.showInformationMessage(
      `Status filter changed to: ${vscode.workspace
        .getConfiguration("myExtension")
        .get<string[]>("statusFilter")}`
    );
  }
});

const linkBuilders = {
  "AWS::S3::Bucket": (id: string) =>
    `https://${id}.s3.${region}.amazonaws.com/`,
  "AWS::ApiGateway::RestApi": (id: string) =>
    `https://${id}.execute-api.${region}.amazonaws.com/prod`,
  "AWS::Lambda::Function": (id: string) =>
    `https://${region}.console.aws.amazon.com/lambda/home#/functions/${id}`,
  "AWS::EC2::Instance": (id: string) =>
    `https://${region}.console.aws.amazon.com/ec2/v2/home#InstanceDetails:instanceId=${id}`,
};

export { statusFilter, linkBuilders };
