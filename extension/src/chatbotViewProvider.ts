import * as vscode from "vscode";
import { readFileSync } from "fs";
import * as path from "path";
import { runDriftDetection } from "./services/stackService";
import { formatAndOpenDriftResultsInWebView } from "./utils/formatting";
import { callChatApiStreaming } from "./services/chatBotService";
import {
  createSession,
  addMessage,
  getRecentSessions,
  getSessionMessages,
  deleteSession,
  renameSession,
  TokenUsage,
  ClassificationData,
} from "./services/dbService";

export class ChatbotViewProvider implements vscode.WebviewViewProvider {
  // GIỮ NGUYÊN cái id này vì package.json của mày đang dùng "chatbotView"
  // "id": "chatbotView", "name": "AI Chat"  -> nên để y chang
  public static readonly viewType = "chatbotView";
  private _view?: vscode.WebviewView;
  private _currentSessionId: string | null = null;

  constructor(private readonly _extensionUri: vscode.Uri) {}

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this._view = webviewView;
    webviewView.title = "AI Chat";
    this._view.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this._extensionUri, "out", "treeView"),
      ],
    };

    const treeViewPath = vscode.Uri.joinPath(
      this._extensionUri,
      "out",
      "treeView"
    );

    // 2. Read the built index.html file. Some builds output nested under `treeView/`.
    const htmlPath = vscode.Uri.joinPath(
      treeViewPath,
      "treeView",
      "index.html"
    );

    let html: string | null = null;
    let lastErr: any = null;
    let usedCandidate: vscode.Uri | null = null;
    try {
      html = readFileSync(htmlPath.fsPath, "utf8");
      usedCandidate = htmlPath;
    } catch (err) {
      console.error(err);
    }

    if (html === null) {
      const msg = `Could not load webview UI: ${
        lastErr?.message ?? String(lastErr)
      }`;
      vscode.window.showErrorMessage(msg);
      webviewView.webview.html = `<html><body><h3>${msg}</h3></body></html>`;
      return;
    }

    // 3. Inject the <base> tag so relative asset paths resolve correctly
    const indexDirFsPath = path.dirname(
      usedCandidate?.fsPath ??
        vscode.Uri.joinPath(treeViewPath, "index.html").fsPath
    );

    const baseFolderUri = this._view.webview.asWebviewUri(
      vscode.Uri.file(indexDirFsPath)
    );
    const baseTag = `<base href="${baseFolderUri.toString()}/">`;

    // 4. Construct a reasonable Content-Security-Policy
    // Allow scripts/styles from the extension webview source and allow connecting to the chat API
    const csp = [
      "default-src 'none'",
      `img-src ${this._view.webview.cspSource} data: blob:`,
      `style-src ${this._view.webview.cspSource} 'unsafe-inline'`,
      `script-src ${this._view.webview.cspSource}`,
    ].join("; ");

    html = html.replace(
      "<head>",
      `<head><meta http-equiv="Content-Security-Policy" content="${csp}">${baseTag}`
    );

    // DEBUG: show which index.html path was used (temporary)
    try {
      vscode.window.showInformationMessage(
        `Chatbot view loaded from: ${indexDirFsPath}`
      );
    } catch {}

    webviewView.webview.html = html;

    // 👇 nhận message từ webview và gọi API
    webviewView.webview.onDidReceiveMessage(async (message) => {
      if (!message) return;

      if (message.type === "deleteSession") {
        try {
          deleteSession(message.sessionId);
        } catch (err) {
          console.error("Failed to delete session", err);
        }
        return;
      }

      if (message.type === "renameSession") {
        try {
          renameSession(message.sessionId, message.title);

          // Send refreshed history back to UI
          const sessions = getRecentSessions(32);
          webviewView.webview.postMessage({
            type: "showHistory",
            sessions,
          });
        } catch (err) {
          console.error("Failed to rename session", err);
        }
        return;
      }

      if (message.type === "drift-check") {
        const driftInfo = message.driftInfo;

        // If drift info comes from the chatbot Classification mode,
        // open the editor view directly with that classification data.
        if (driftInfo) {
          try {
            const stackName = message.stackName ?? "Stack classification";
            formatAndOpenDriftResultsInWebView(this._extensionUri, stackName, {
              classificationInfo: driftInfo,
            });

            webviewView.webview.postMessage({
              type: "drift-complete",
            });
          } catch (err: any) {
            const errorMsg = err?.message ?? String(err ?? "");
            vscode.window.showErrorMessage(`Error: ${errorMsg}`);
            webviewView.webview.postMessage({
              type: "drift-error",
              error: errorMsg,
            });
          }
          return;
        }

        // Fallback: run a full CloudFormation drift detection by stack name.
        const stackName = message.stackName ?? "";

        if (!stackName) {
          vscode.window.showErrorMessage("Stack name is required");
          return;
        }

        try {
          await vscode.window.withProgress(
            {
              location: vscode.ProgressLocation.Notification,
              title: `Running drift check for ${stackName}`,
              cancellable: false,
            },
            async (progress) => {
              progress.report({
                increment: 0,
                message: "Starting drift detection...",
              });

              const result = await runDriftDetection(stackName);

              if (result instanceof Error) {
                vscode.window.showErrorMessage(
                  `Drift detection failed: ${result.message}`
                );
                webviewView.webview.postMessage({
                  type: "drift-error",
                  error: result.message,
                });
                return;
              }

              progress.report({
                increment: 50,
                message: "Opening results in editor...",
              });

              // Open drift results in webview panel (pass extension URI to load built React view)
              formatAndOpenDriftResultsInWebView(
                this._extensionUri,
                stackName,
                result
              );

              progress.report({ increment: 100, message: "Complete!" });

              // Notify webview that drift check is complete
              webviewView.webview.postMessage({
                type: "drift-complete",
              });
            }
          );
        } catch (err: any) {
          const errorMsg = err?.message ?? String(err ?? "");
          vscode.window.showErrorMessage(`Error: ${errorMsg}`);
          webviewView.webview.postMessage({
            type: "drift-error",
            error: errorMsg,
          });
        }
        return;
      }
      if (message.type === "open-session") {
        const sessionId = message.newSessionId;
        console.log(sessionId);
        try {
          const messages = await getSessionMessages(sessionId);
          console.log("messages " + messages);
          webviewView.webview.postMessage({
            type: "session-loaded",
            sessionId,
            messages,
          });
        } catch (err) {
          console.error(err);
        }
      }
      // Handle chat messages
      if (message.type == "chat") {
        if (message.role == "user") {
          let sessionId = message.sessionId;
          if (!sessionId) sessionId = await this.newSession();
          // hàm gửi lại để webview thay "Thinking..."
          const sendBack = (data: string | object) => {
            webviewView.webview.postMessage({
              type: "bot-reply",
              data,
            });
          };

          try {
            // Lưu user message
            await addMessage(sessionId, message.role, message.content);

            // Track token usage và classification
            let tokenUsage: TokenUsage | undefined;
            let classificationData: ClassificationData | undefined;
            let aiContent = "";
            const isClassificationMode = message.mode === "Classification";

            await callChatApiStreaming(
              message.content,
              sessionId,
              message.mode,
              (data) => {
                // Xử lý token usage
                if (
                  typeof data === "object" &&
                  (data as any).__meta === "usage" &&
                  (data as any).usage
                ) {
                  tokenUsage = (data as any).usage;
                  return;
                }

                // Xử lý classification mode - nhận toàn bộ object một lần
                if (isClassificationMode && typeof data === "object") {
                  // Check if it's a valid classification object
                  if (
                    (data as any).severity &&
                    (data as any).explanation !== undefined
                  ) {
                    classificationData = data as ClassificationData;
                    // Use causes or explanation as content for display
                    aiContent =
                      (data as any).causes ||
                      (data as any).explanation ||
                      `Classification: ${(data as any).severity}`;
                  }
                } else if (!isClassificationMode && typeof data === "string") {
                  // Accumulate text chunks for streaming modes
                  aiContent += data;
                }

                sendBack(data);
              }
            );

            // Lưu AI response với token và classification
            // Với classification mode, nếu không có content thì dùng explanation
            const finalContent =
              aiContent ||
              (classificationData
                ? classificationData.explanation || classificationData.causes
                : "No response") ||
              "No response";

            await addMessage(
              sessionId,
              "ai",
              finalContent,
              tokenUsage,
              classificationData
            );
          } catch (err: any) {
            sendBack(
              "⚠️ API error (extension): " + (err?.message ?? String(err ?? ""))
            );
          }
        } else {
          const sessionId = message.sessionId;
          const role = message.role;
          const content = message.content;

          try {
            await addMessage(sessionId, role, content);
          } catch (err) {
            console.error(err);
          }
        }
      }
    });
  }

  async newSession(clearChat: boolean = false) {
    const sessionId = await createSession("New chat");
    this._view?.webview.postMessage({
      type: "newSession",
      sessionId,
      clearChat,
    });
    return sessionId;
  }

  async showHistory() {
    const sessions = await getRecentSessions(32);
    console.log(sessions);
    this._view?.webview.postMessage({ type: "showHistory", sessions });
  }

  clearChat() {
    this._view?.webview.postMessage({ type: "clearChat" });
  }
}
