import { CSSProperties } from "react";

export const createStyles = (
  theme: "vscode-light" | "vscode-dark"
): Record<string, CSSProperties> => {
  const isDark = theme === "vscode-dark";

  return {
    container: {
      display: "flex",
      flexDirection: "column",
      height: "100vh",
      overflow: "hidden",
      fontFamily: "var(--vscode-font-family)",
      backgroundColor: "var(--vscode-sideBar-background)",
      color: "var(--vscode-sideBar-foreground)",
    },

    // ===== CHAT VIEW =====

    chatBox: {
      flex: 1,
      overflowY: "auto",
      overflowX: "hidden",
      padding: "16px 12px",
      display: "flex",
      flexDirection: "column",
      gap: "12px",
    },

    // ===== EMPTY STATE =====

    emptyState: {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      height: "100%",
      gap: "16px",
      padding: "20px",
    },

    emptyIcon: {
      color: isDark ? "var(--vscode-editor-foreground)" : "black",
    },

    emptyTextTitle: {
      fontSize: "20px",
      color: "var(--vscode-descriptionForeground)",
      textAlign: "center",
      maxWidth: "300px",
    },

    emptyText: {
      fontSize: "13px",
      color: "var(--vscode-descriptionForeground)",
      opacity: 0.7,
      textAlign: "center",
      lineHeight: "1.6",
      maxWidth: "350px",
    },

    // ===== MESSAGES =====

    messageRow: {
      display: "flex",
      width: "100%",
      alignItems: "flex-start",
    },

    messageWrapper: {
      display: "flex",
      flexDirection: "column",
      gap: "4px",
      maxWidth: "100%", // ✅ instead of 85%
    },

    aiMessage: {
      padding: "8px 12px",
      borderRadius: "8px",
      backgroundColor: isDark
        ? "rgba(255, 255, 255, 0.05)"
        : "rgba(0, 0, 0, 0.04)",
      border: `1px solid ${
        isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.08)"
      }`,
      color: "var(--vscode-editor-foreground)",
      whiteSpace: "pre-wrap",
      wordBreak: "break-word",
      fontSize: "13px",
      lineHeight: "1.5",
      overflowWrap: "anywhere", // ✅ catches long AWS ARNs / commands
    },

    userMessage: {
      padding: "8px 12px",
      borderRadius: "8px",
      backgroundColor: "var(--vscode-button-background)",
      color: "var(--vscode-button-foreground)",
      whiteSpace: "pre-wrap",
      wordBreak: "break-word",
      fontSize: "13px",
      lineHeight: "1.5",
      marginLeft: "auto",
      overflowWrap: "anywhere",
    },

    copyButton: {
      alignSelf: "flex-start",
      backgroundColor: "transparent",
      border: "none",
      color: "var(--vscode-descriptionForeground)",
      cursor: "pointer",
      padding: "4px 6px",
      borderRadius: "4px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      transition: "background-color 0.15s ease",
    },

    copyButtonHover: {
      backgroundColor: isDark
        ? "rgba(255, 255, 255, 0.15)"
        : "rgba(0, 0, 0, 0.12)",
    },

    // ===== COMPOSER =====

    composer: {
      display: "flex",
      flexDirection: "column",
      gap: "8px",
      margin: "0 8px 8px 8px",
      padding: "10px",
      borderRadius: "6px",
      backgroundColor: isDark ? "rgba(255, 255, 255, 0.04)" : "white",
      border: `1px solid ${
        isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)"
      }`,
    },

    textarea: {
      width: "100%",
      resize: "none",
      border: "none",
      outline: "none",
      backgroundColor: "transparent",
      color: "var(--vscode-input-foreground)",
      fontSize: "13px",
      lineHeight: "1.5",
      fontFamily: "var(--vscode-font-family)",
      minHeight: "22px",
      maxHeight: "200px",
      overflowY: "auto",
      padding: 0,
      overflowX: "hidden",
    },

    composerFooter: {
      display: "flex",
      flexWrap: "wrap", // ✅ allow wrapping
      alignItems: "center",
      justifyContent: "space-between",
      gap: "8px",
      paddingTop: "4px",
      minWidth: 0,
    },

    selectGroup: {
      display: "flex",
      alignItems: "center",
      gap: "6px",
      minWidth: 0, // ⭐ critical
      flex: 1,
      overflow: "hidden", // ⭐ hide text when narrow
    },

    select: {
      fontSize: "12px",
      padding: "4px 6px",
      borderRadius: "4px",
      backgroundColor: "var(--vscode-dropdown-background)",
      color: "var(--vscode-dropdown-foreground)",
      border: `1px solid var(--vscode-dropdown-border)`,
      outline: "none",
      cursor: "pointer",
      fontFamily: "var(--vscode-font-family)",

      minWidth: 0, // ⭐ allow shrink
      maxWidth: "100%",
      overflow: "hidden", // ⭐ hide label
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    },

    sendButton: {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      width: "28px",
      height: "28px",
      borderRadius: "4px",
      border: "none",

      backgroundColor: "transparent", // 👈 no background
      color: "var(--vscode-icon-foreground)",

      cursor: "pointer",
      flexShrink: 0,
      transition: "background-color 0.12s ease",
    },

    sendButtonHover: {
      backgroundColor:
        "var(--vscode-toolbar-hoverBackground, rgba(128,128,128,0.18))",
    },

    disclaimer: {
      fontSize: "10px",
      padding: "6px 8px",
      textAlign: "center",
      color: "var(--vscode-descriptionForeground)",
      backgroundColor: "var(--vscode-sideBar-background)",
      borderTop: `1px solid ${
        isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)"
      }`,
    },

    // ===== HISTORY VIEW =====

    historyCardContent: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      width: "100%",
      overflow: "hidden",
    },

    closeButton: {
      background: "transparent",
      border: "none",
      cursor: "pointer",
      fontSize: 14,
      opacity: 0,
      padding: "4px 6px",
      borderRadius: 4,
      color: "#999",
    },

    historyMain: {
      flex: 1,
      minWidth: 0,      
      overflow: "hidden",
    },

    historyText: {
      fontSize: "13px",
      fontWeight: 500,
      color: "var(--vscode-foreground)",
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis", 
    },

    closeButtonVisible: {
      opacity: 1,
    },

    historyContainer: {
      display: "flex",
      flexDirection: "column",
      height: "100%",
      overflow: "hidden",
    },

    historyHeader: {
      padding: "12px",
      borderBottom: `1px solid ${
        isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)"
      }`,
    },

    backButton: {
      display: "flex",
      alignItems: "center",
      gap: "6px",
      background: "transparent",
      border: "none",
      color: "var(--vscode-textLink-foreground)",
      cursor: "pointer",
      fontSize: "12px",
      padding: "4px 8px",
      borderRadius: "4px",
      marginBottom: "8px",
      fontFamily: "var(--vscode-font-family)",
      transition: "background-color 0.1s",
    },

    historyTitle: {
      fontSize: "14px",
      fontWeight: 600,
      margin: 0,
      color: "var(--vscode-foreground)",
    },

    historyList: {
      flex: 1,
      overflowY: "auto",
      padding: "12px",
    },

    historyCard: {
      boxSizing: "border-box",
      width: "100%",
      textAlign: "left",
      backgroundColor: isDark
        ? "rgba(255, 255, 255, 0.04)"
        : "rgba(0, 0, 0, 0.02)",
      border: `1px solid ${
        isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.08)"
      }`,
      borderRadius: "1px",
      padding: "10px 15px",
      marginBottom: "8px",
      cursor: "pointer",
      display: "flex",
      flexDirection: "column",
      gap: "4px",
    },

    historyCardHover: {
      backgroundColor: isDark
        ? "rgba(255, 255, 255, 0.08)"
        : "rgba(0, 0, 0, 0.06)",
    },

    historySubText: {
      fontSize: "11px",
      color: "var(--vscode-descriptionForeground)",
    },

   renameInput: {
    fontSize: "13px",
    padding: "4px 6px",
    borderRadius: "4px",
    width: "100%",
    fontFamily: "var(--vscode-font-family)",
    color: "var(--vscode-input-foreground)",
    backgroundColor: "var(--vscode-input-background)",
    border: "1px solid var(--vscode-input-border)",
    outline: "none",
    boxSizing: "border-box",
  },


    historyTitleRow: {
      display: "flex",
      alignItems: "center",
      gap: 6,
    },

    editButton: {
      background: "transparent",
      border: "none",
      padding: 2,
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: isDark ? "#ffffff" : "var(--vscode-foreground)",
      opacity: 0.5,
    },

    editIcon: {
      width: 14,
      height: 14,
      transform: "translateY(-3px)",
    },

    editButtonHover: {
      opacity: 1,
    },

    pagination: {
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      gap: "12px",
      padding: "12px",
      borderTop: `1px solid ${
        isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)"
      }`,
    },

    pageButton: {
      padding: "6px 12px",
      backgroundColor: "var(--vscode-button-secondaryBackground)",
      color: "var(--vscode-button-secondaryForeground)",
      border: "none",
      borderRadius: "4px",
      cursor: "pointer",
      fontSize: "12px",
      fontFamily: "var(--vscode-font-family)",
      transition: "opacity 0.1s",
    },

    pageText: {
      fontSize: "12px",
      color: "var(--vscode-descriptionForeground)",
      fontWeight: 500,
    },
  };
};

export const getMarkdownCss = (theme: "vscode-light" | "vscode-dark") => {
  const isDark = theme === "vscode-dark";

  return `
.markdown-body {
  font-size: 13px;
  line-height: 1.4;
  color: ${isDark ? "#d4d4d4" : "#1f2937"};
}

/* Tables */
.markdown-body table {
  border-collapse: collapse;
  width: 100%;
  margin: 6px 0;
}

/* Table cells */
.markdown-body th,
.markdown-body td {
  padding: 4px 8px;
  line-height: 1.35;
  vertical-align: top;
  border-bottom: 1px solid ${
    isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"
  };
}

/* Remove extra spacing inside cells */
.markdown-body p {
  margin: 0;
}

/* Headings */
.markdown-body h1,
.markdown-body h2,
.markdown-body h3 {
  margin: 8px 0 4px;
  line-height: 1.3;
}

/* Lists */
.markdown-body ul,
.markdown-body ol {
  margin: 4px 0 4px 16px;
  padding: 0;
}

.markdown-body li {
  margin: 2px 0;
}

/* Inline code */
.markdown-body code {
  font-size: 12px;
}
`;
};
