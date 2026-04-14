import React, { useState, useEffect, useRef, use } from "react";
import { createRoot } from "react-dom/client";
import { createStyles, getMarkdownCss } from "./styles.ts";
import { HistoryView } from "./HistoryView.tsx";
import { ChatSession } from "./types/types.ts";
import EmptyIcon from "./icons/emptyIcon.svg?react";
import CopyIcon from "./icons/copyIcon.svg?react";
import CheckIcon from "./icons/checkIcon.svg?react";
import SendIcon from "./icons/sendIcon.svg?react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { dracula } from "react-syntax-highlighter/dist/esm/styles/prism";

const MarkdownRenderer: React.FC<{ content: string }> = ({ content }) => {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        /* ---------- TABLE ---------- */
        table({ children }) {
          return (
            <table
              style={{
                borderCollapse: "collapse",
                width: "100%",
                margin: "12px 0",
              }}
            >
              {children}
            </table>
          );
        },
        th({ children }) {
          return (
            <th
              style={{
                border: "1px solid #444",
                padding: "6px",
                background: "transparent",
                textAlign: "left",
              }}
            >
              {children}
            </th>
          );
        },
        td({ children }) {
          return (
            <td
              style={{
                border: "1px solid #444",
                padding: "6px",
              }}
            >
              {children}
            </td>
          );
        },

        /* ---------- CODE BLOCK ---------- */
        code({ className, children }) {
          const match = /language-(\w+)/.exec(className || "");
          const code = String(children).replace(/\n$/, "");

          if (match) {
            return (
              <div style={{ position: "relative", margin: "12px 0" }}>
                <button
                  onClick={() => navigator.clipboard.writeText(code)}
                  style={{
                    position: "absolute",
                    top: 6,
                    right: 6,
                    fontSize: 11,
                    padding: "4px 6px",
                    borderRadius: 4,
                    border: "none",
                    background: "#333",
                    color: "#fff",
                    cursor: "pointer",
                    opacity: 0.85,
                  }}
                >
                  Copy
                </button>

                <SyntaxHighlighter
                  style={dracula}
                  language={match[1]}
                  showLineNumbers
                  PreTag="div"
                >
                  {code}
                </SyntaxHighlighter>
              </div>
            );
          }

          return (
            <code
              style={{
                padding: "2px 6px",
                borderRadius: 4,
                fontSize: "0.9em",
              }}
            >
              {children}
            </code>
          );
        },
      }}
    >
      {content}
    </ReactMarkdown>
  );
};

// VS Code webview API
declare const acquireVsCodeApi:
  | (() => {
      postMessage: (msg: any) => void;
      getState: () => any;
      setState: (state: any) => void;
    })
  | undefined;

const vscode =
  typeof acquireVsCodeApi !== "undefined"
    ? acquireVsCodeApi()
    : {
        postMessage: (_: any) => {},
        getState: () => ({}),
        setState: (_: any) => {},
      };

interface Message {
  role: "ai" | "user";
  content: string;
  copied?: boolean;
  loading?: boolean;
  sender?: "user" | "ai"; // temporary display field
  usageTokens?: number;
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
}

const TypingDots = () => {
  const [dots, setDots] = useState("");

  useEffect(() => {
    const id = setInterval(() => {
      setDots((d) => (d.length >= 3 ? "" : d + "."));
    }, 400);
    return () => clearInterval(id);
  }, []);

  return <span style={{ opacity: 0.7 }}>Thinking{dots}</span>;
};

const App: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [theme, setTheme] = useState<"vscode-light" | "vscode-dark">(
    "vscode-dark",
  );
  const [hoveredCopy, setHoveredCopy] = useState<number | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [hoveredSend, setHoveredSend] = useState(false);
  const [chatHistories, setChatHistories] = useState<ChatSession[]>([]);
  const [sessionId, setSessionId] = useState<string>();
  const [mode, setMode] = useState("Ask");

  const chatBoxRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const styles = createStyles(theme);

  const isBotThinking = messages.some((m) => m.loading);

  // Auto-resize textarea
  const autoResize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  };

  // Reset chat to initial state
  const resetChat = () => {
    setMessages([]);
    setInput("");
  };

  // Detect VS Code theme changes
  useEffect(() => {
    const updateTheme = () => {
      const kind = document.body.getAttribute("data-vscode-theme-kind");
      setTheme(kind === "vscode-light" ? "vscode-light" : "vscode-dark");
    };

    updateTheme();
    const observer = new MutationObserver(updateTheme);
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["data-vscode-theme-kind"],
    });

    return () => observer.disconnect();
  }, []);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (chatBoxRef.current) {
      chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
    }
  }, [messages]);

  // Handle messages from extension
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const msg = event.data;
      if (!msg) return;

      switch (msg.type) {
        case "newSession":
          setSessionId(msg.sessionId);
          setShowHistory(false);
          if (msg.clearChat) resetChat();
          break;

        case "showHistory":
          setChatHistories(msg.sessions);
          setShowHistory(true);
          break;

        case "clearChat":
          resetChat();
          break;

        case "bot-reply":
          setMessages((prev) => {
            const next = [...prev];
            const last = next[next.length - 1];

            // Usage metadata from Bedrock final envelope – don't render as text.
            if (
              msg.data &&
              typeof msg.data === "object" &&
              (msg.data as any).__meta === "usage"
            ) {
              const usage = (msg.data as any).usage;
              const totalTokens =
                usage?.totalTokens ?? usage?.outputTokens ?? usage?.inputTokens;

              // Attach token usage to the last AI message so we can render under it.
              let lastAiIndex = -1;
              for (let i = next.length - 1; i >= 0; i--) {
                if (next[i].role === "ai") {
                  lastAiIndex = i;
                  next[i] = {
                    ...next[i],
                    usageTokens:
                      typeof totalTokens === "number" ? totalTokens : undefined,
                  };
                  break;
                }
              }

              // Also persist the final AI message content to the extension DB.
              if (lastAiIndex !== -1) {
                const finalContent = next[lastAiIndex].content;
                vscode.postMessage({
                  type: "chat",
                  sessionId,
                  role: "ai",
                  content: finalContent,
                });
              }

              return next;
            }

            if (typeof msg.data === "object" && mode === "Classification") {
              if (last) {
                last.loading = false;
              }
              console.log(msg.data);
              if ((msg.data as any).problems === "") {
                vscode.postMessage({
                  type: "drift-check",
                  driftInfo: msg.data,
                });
                if (last) {
                  last.content =
                    "Potential causes: " + (msg.data as any).causes;
                }
              } else if (last) {
                last.content = "Problems: " + (msg.data as any).problems;
              }

              vscode.postMessage({
                type: "chat",
                sessionId,
                role: "ai",
                content: last?.content,
              });
            } else if (last?.role === "ai") {
              last.loading = false;
              const chunk = String(msg.data ?? "");
              // Remove leading whitespace only once for the very first chunk.
              if (!last.content) {
                last.content = chunk.trimStart();
              } else {
                last.content += chunk;
              }
            }
            return next;
          });
          break;

        case "drift-complete":
          updateLastAIMessage(
            "Running drift detection...",
            "✅ Drift check complete! Results opened in webview.",
          );
          break;

        case "drift-error":
          updateLastAIMessage(
            "Running drift detection...",
            `❌ Error: ${msg.error || "Unknown error"}`,
          );
          break;
        case "session-loaded":
          console.log("Session loaded:", msg);
          setSessionId(msg.sessionId);
          setMessages(
            (msg.messages || []).map((m: Message) => {
              if (typeof m.usageTokens === "number") return m;
              if (typeof m.total_tokens === "number") {
                return { ...m, usageTokens: m.total_tokens };
              }
              if (
                typeof m.input_tokens === "number" &&
                typeof m.output_tokens === "number"
              ) {
                return { ...m, usageTokens: m.input_tokens + m.output_tokens };
              }
              return m;
            }),
          );
          break;

        default:
          break;
      }
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [sessionId, mode]);

  // Helper to update last AI message
  const updateLastAIMessage = (oldText: string, newText: string) => {
    setMessages((prev) => {
      const next = [...prev];
      const index = next.findIndex(
        (m) => m.role === "ai" && m.content === oldText,
      );
      if (index !== -1) {
        next[index].content = newText;
      } else {
        next.push({ role: "ai", content: newText });
      }
      return next;
    });
  };

  // Handle sending messages
  const handleSend = () => {
    if (isBotThinking) return;
    const text = input.trim();
    if (!text) return;

    // Regular chat message
    setMessages((prev) => [
      ...prev,
      {
        role: "user",
        content: text,
      },
      {
        role: "ai",
        content: "",
        loading: true,
      },
    ]);
    setInput("");
    console.log("SESSION ID " + sessionId);
    vscode.postMessage({
      type: "chat",
      content: text,
      sessionId,
      role: "user",
      mode: mode,
    });
  };

  // Handle copy to clipboard
  const handleCopy = async (index: number, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setMessages((prev) =>
        prev.map((msg, i) => (i === index ? { ...msg, copied: true } : msg)),
      );
      setTimeout(() => {
        setMessages((prev) =>
          prev.map((msg, i) => (i === index ? { ...msg, copied: false } : msg)),
        );
      }, 1500);
    } catch (err) {
      console.error("Copy failed", err);
    }
  };

  // handle removing a chat session
  const onRemoveSession = (sessionId: string) => {
    vscode?.postMessage({
      type: "deleteSession",
      sessionId,
    });

    // Remove from UI immediately
    setChatHistories((prev) => prev.filter((s) => s.id !== sessionId));
  };

  // handle renaming a chat session
  const onRenameSession = (sessionId: string, title: string) => {
    vscode?.postMessage({
      type: "renameSession",
      sessionId,
      title,
    });

    setChatHistories((prev = []) =>
      prev.map((s) => (s.id === sessionId ? { ...s, title } : s)),
    );
  };

  return (
    <div style={styles.container}>
      {!showHistory ? (
        <>
          <style>{getMarkdownCss(theme)}</style>

          {/* Chat Messages */}
          <div style={styles.chatBox} ref={chatBoxRef}>
            {messages.length === 0 ? (
              <div style={styles.emptyState}>
                <div style={styles.emptyIcon}>
                  <EmptyIcon />
                </div>
                <div style={styles.emptyTextTitle}>Manage AWS with Agent</div>
                <div style={styles.emptyText}>
                  <div>AI responses may contain inaccuracies.</div>
                  <div>
                    Please verify important information on your AWS account.
                  </div>
                </div>
              </div>
            ) : (
              messages.map((msg, i) => (
                <div
                  key={i}
                  style={{
                    ...styles.messageRow,
                    justifyContent:
                      msg.role === "user" ? "flex-end" : "flex-start",
                  }}
                >
                  <div style={styles.messageWrapper}>
                    <div
                      style={
                        msg.role === "user"
                          ? styles.userMessage
                          : styles.aiMessage
                      }
                    >
                      {msg.loading ? (
                        <TypingDots />
                      ) : msg.role === "user" ? (
                        msg.content.trim()
                      ) : (
                        <>
                          <div className="markdown-body">
                            <MarkdownRenderer content={msg.content.trim()} />
                          </div>

                          <div
                            style={{
                              marginTop: 8,
                              fontSize: 11,
                              opacity: 0.6,
                            }}
                          >
                            Tokens used:{" "}
                            {typeof msg.usageTokens === "number"
                              ? msg.usageTokens
                              : "n/a"}
                          </div>
                        </>
                      )}
                    </div>

                    {msg.role === "ai" && !msg.loading && (
                      <button
                        onClick={() => handleCopy(i, msg.content)}
                        onMouseEnter={() => setHoveredCopy(i)}
                        onMouseLeave={() => setHoveredCopy(null)}
                        style={{
                          ...styles.copyButton,
                          ...(hoveredCopy === i ? styles.copyButtonHover : {}),
                        }}
                        title="Copy to clipboard"
                      >
                        {msg.copied ? <CheckIcon /> : <CopyIcon />}
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Input Composer */}
          <div style={styles.composer}>
            <textarea
              ref={textareaRef}
              style={styles.textarea}
              placeholder="Ask a question or describe what to build..."
              value={input}
              rows={1}
              onChange={(e) => {
                setInput(e.target.value);
                autoResize();
              }}
              onKeyDown={(e) => {
                if (isBotThinking) {
                  e.preventDefault();
                  return;
                }

                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />

            <div style={styles.composerFooter}>
              <div style={styles.selectGroup}>
                <select
                  style={styles.select}
                  value={mode}
                  onChange={(e) => {
                    setMode(e.target.value);
                  }}
                >
                  <option value="Ask">Ask</option>
                  <option value="Classification">Classification</option>
                  <option value="Multiagent">Agent</option>
                </select>

                <select style={styles.select}>
                  <option>GPT-4.1</option>
                  <option>Claude 3.5</option>
                  <option>Claude 3</option>
                  <option>GPT-4o</option>
                </select>
              </div>

              <button
                disabled={isBotThinking || !input.trim()}
                onMouseEnter={() => setHoveredSend(true)}
                onMouseLeave={() => setHoveredSend(false)}
                style={{
                  ...styles.sendButton,
                  cursor: input.trim() ? "pointer" : "not-allowed",
                  opacity: isBotThinking || !input.trim() ? 0.5 : 1,
                }}
                onClick={() => {
                  if (!input.trim()) return;
                  handleSend();
                }}
                title="Send message (Enter)"
              >
                <SendIcon />
              </button>
            </div>
          </div>
        </>
      ) : chatHistories !== undefined ? (
        <HistoryView
          styles={styles}
          history={chatHistories}
          onBack={() => setShowHistory(false)}
          onSelectSession={(newSessionId) => {
            console.log("Load session:", newSessionId);
            setSessionId(newSessionId);
            vscode.postMessage({
              type: "open-session",
              newSessionId,
            });
            setShowHistory(false);
          }}
          onRemoveSession={onRemoveSession}
          onRenameSession={onRenameSession}
        />
      ) : null}
    </div>
  );
};

const root = document.getElementById("root");
if (root) createRoot(root).render(<App />);
