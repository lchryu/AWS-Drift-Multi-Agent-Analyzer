import * as vscode from "vscode";
import { readFileSync } from "fs";
import * as path from "path";

/**
 * Formats the drift status message and icon
 */
export function formatDriftStatus(
  stackName: string,
  stackDriftStatus: string,
  driftedCount?: number,
  detectionStatus?: string
) {
  let statusMessage = `Drift check complete for ${stackName}`;
  let statusIcon = "✅";

  if (stackDriftStatus === "DRIFTED") {
    statusIcon = "⚠️";
    statusMessage += ` - Stack has drifted!`;
    if (driftedCount && driftedCount > 0) {
      statusMessage += ` ${driftedCount} resource(s) have drifted.`;
    }
  } else if (stackDriftStatus === "IN_SYNC") {
    statusMessage += ` - Stack is in sync (no drift detected).`;
  } else {
    statusMessage += ` - Status: ${stackDriftStatus}`;
    statusMessage += ` (Detection: ${detectionStatus})`;
  }

  return { statusIcon, statusMessage };
}

/**
 * Writes drift details to the output channel
 */
export function formatAndDisplayDriftResults(stackName: string, result: any) {
  if (!result || !result.resourceDrifts || result.resourceDrifts.length === 0)
    return;

  const { stackDriftStatus, driftedStackResourceCount, resourceDrifts } =
    result;

  const outputChannel = vscode.window.createOutputChannel("Drift Analyzer");
  outputChannel.clear();

  outputChannel.appendLine(`Drift Detection Results for ${stackName}`);
  outputChannel.appendLine(`Status: ${stackDriftStatus}`);
  outputChannel.appendLine(
    `Drifted Resources: ${driftedStackResourceCount || 0}`
  );
  outputChannel.appendLine("");

  resourceDrifts.forEach((drift: any, index: number) => {
    outputChannel.appendLine(
      `${index + 1}. Resource: ${drift.LogicalResourceId}`
    );
    outputChannel.appendLine(`   Type: ${drift.ResourceType}`);
    outputChannel.appendLine(`   Physical ID: ${drift.PhysicalResourceId}`);
    outputChannel.appendLine(
      `   Drift Status: ${drift.StackResourceDriftStatus}`
    );
    if (drift.ExpectedProperties) {
      outputChannel.appendLine(
        `   Expected Properties: ${JSON.stringify(drift.ExpectedProperties)}`
      );
    }
    if (drift.ActualProperties) {
      outputChannel.appendLine(
        `   Actual Properties: ${JSON.stringify(drift.ActualProperties)}`
      );
    }
    outputChannel.appendLine("");
  });

  outputChannel.show();
}

function mapDriftToSeverity(
  driftStatus: string,
  propertyDifferences?: any[]
): { drift: string; severity: string } {
  if (!driftStatus || driftStatus === "NOT_CHECKED")
    return { drift: "", severity: "Compliance" };
  if (driftStatus === "IN_SYNC")
    return { drift: "In Sync", severity: "Compliance" };
  if (driftStatus === "DELETED")
    return { drift: "Critical", severity: "Availability" };

  if (driftStatus === "MODIFIED") {
    if (!propertyDifferences || propertyDifferences.length === 0)
      return { drift: "Medium", severity: "Compliance" };

    const securityProps = [
      "PolicyDocument",
      "BucketPolicy",
      "AccessControl",
      "PublicAccessBlockConfiguration",
      "Policy",
      "Permissions",
    ];
    const hasSecurityProps = propertyDifferences.some((diff: any) =>
      securityProps.some((p) => diff.PropertyPath?.includes(p))
    );
    if (hasSecurityProps) return { drift: "Critical", severity: "Security" };

    const availabilityProps = [
      "InstanceId",
      "SubnetId",
      "AvailabilityZone",
      "VolumeId",
      "SubnetIds",
      "VpcId",
    ];
    const hasAvailabilityProps = propertyDifferences.some((diff: any) =>
      availabilityProps.some((p) => diff.PropertyPath?.includes(p))
    );
    if (hasAvailabilityProps)
      return { drift: "High", severity: "Availability" };

    if (propertyDifferences.length > 5)
      return { drift: "High", severity: "Compliance" };
    return { drift: "Medium", severity: "Compliance" };
  }

  return { drift: "Low", severity: "Compliance" };
}

function getDriftBadgeClass(drift: string): string {
  const d = (drift || "").toLowerCase();
  if (d === "critical") return "badge-critical";
  if (d === "high") return "badge-high";
  if (d === "medium") return "badge-medium";
  if (d === "low") return "badge-low";
  if (d === "in sync") return "badge-in-sync";
  return "badge-default";
}

function escapeHtml(text: string): string {
  const map: { [k: string]: string } = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return (text || "").toString().replace(/[&<>"']/g, (m) => map[m]);
}

/**
 * Loads built React webview HTML from `out/editorView`, injects CSP/base and
 * pre-hydrates `window.__DRIFT_DATA__`. Falls back to a JSON page when build is missing.
 */
export function formatAndOpenDriftResultsInWebView(
  extensionUri: vscode.Uri,
  stackName: string,
  result: any
) {
  const panel = vscode.window.createWebviewPanel(
    "driftResults",
    `Drift Detection - ${stackName}`,
    vscode.ViewColumn.One,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [
        vscode.Uri.joinPath(extensionUri, "out", "editorView"),
      ],
    }
  );

  const editorOut = vscode.Uri.joinPath(extensionUri, "out", "editorView");
  const candidates = [
    vscode.Uri.joinPath(editorOut, "index.html"),
    vscode.Uri.joinPath(editorOut, "editorView", "index.html"),
  ];

  let html: string | null = null;
  let usedCandidate: vscode.Uri | null = null;

  for (const c of candidates) {
    try {
      html = readFileSync(c.fsPath, "utf8");
      usedCandidate = c;
      break;
    } catch (err) {
      // ignore missing files
    }
  }

  if (html && usedCandidate) {
    const indexDirFsPath = path.dirname(usedCandidate.fsPath);
    const baseFolderUri = panel.webview.asWebviewUri(
      vscode.Uri.file(indexDirFsPath)
    );
    const baseTag = `<base href="${baseFolderUri.toString()}/">`;

    const csp = [
      "default-src 'none'",
      `img-src ${panel.webview.cspSource} data: blob:`,
      `style-src ${panel.webview.cspSource} 'unsafe-inline'`,
      `script-src ${panel.webview.cspSource}`,
    ].join("; ");

    html = html.replace(
      "<head>",
      `<head><meta http-equiv="Content-Security-Policy" content="${csp}">${baseTag}`
    );

    // Inject data as a non-executing JSON script so CSP won't block it.
    const dataScript = `<script id="drift-data" type="application/json">${JSON.stringify(
      { stackName, result }
    )}</script>`;
    html = html.replace("</body>", `${dataScript}</body>`);

    panel.webview.html = html;
    return;
  }

  panel.webview.html = `<!doctype html><html><body><h3>Drift Results (build not found)</h3><pre>${escapeHtml(
    JSON.stringify({ stackName, result }, null, 2)
  )}</pre></body></html>`;
}

export { mapDriftToSeverity, getDriftBadgeClass };
