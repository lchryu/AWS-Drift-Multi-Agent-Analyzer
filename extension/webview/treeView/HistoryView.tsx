import React, { useState } from "react";
import EditIcon from "./icons/editIcon.svg?react";
import { ChatSession } from "./types/types";

interface HistoryViewProps {
  styles: any;
  history: ChatSession[];
  onBack: () => void;
  onSelectSession: (sessionId: string) => void;
  onRemoveSession: (sessionId: string) => void;
  onRenameSession: (sessionId: string, title: string) => void;
}

const ITEMS_PER_PAGE = 8;

export const HistoryView: React.FC<HistoryViewProps> = ({
  styles,
  history,
  onBack,
  onSelectSession,
  onRemoveSession,
  onRenameSession,
}) => {
  const [hoveredSession, setHoveredSession] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.ceil(history.length / ITEMS_PER_PAGE);
  const paginatedHistory = history.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");

  return (
    <div style={styles.historyContainer}>
      <div style={styles.historyHeader}>
        <button style={styles.backButton} onClick={onBack}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <path
              d="M10 3L5 8l5 5"
              stroke="currentColor"
              strokeWidth="2"
              fill="none"
            />
          </svg>
          Back to Chat
        </button>
        <h3 style={styles.historyTitle}>Chat History</h3>
      </div>

      <div style={styles.historyList}>
        {paginatedHistory.map((item) => (
          <div
            key={item.id}
            role="button"
            tabIndex={0}
            style={{
              ...styles.historyCard,
              ...(hoveredSession === item.id ? styles.historyCardHover : {}),
            }}
            onMouseEnter={() => setHoveredSession(item.id)}
            onMouseLeave={() => setHoveredSession(null)}
            onClick={() => onSelectSession(item.id)}
          >
            <div style={styles.historyCardContent}>
              <div style={styles.historyMain}>
                {editingId === item.id ? (
                  <input
                    autoFocus
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    onBlur={() => {
                      onRenameSession(item.id, editTitle);
                      setEditingId(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        onRenameSession(item.id, editTitle);
                        setEditingId(null);
                      }
                      if (e.key === "Escape") {
                        setEditingId(null);
                      }
                    }}
                    style={styles.renameInput}
                  />
                ) : (
                  <div style={styles.historyTitleRow}>
                    <span style={styles.historyText}>{item.title}</span>

                    <button
                      style={{
                        ...styles.editButton,
                        ...(hoveredSession === item.id
                          ? styles.editButtonHover
                          : {}),
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingId(item.id);
                        setEditTitle(item.title);
                      }}
                    >
                      <div style={styles.editIcon}>✎</div>
                    </button>
                  </div>
                )}

                <div style={styles.historySubText}>
                  {new Date(item.updated_at).toLocaleString()}
                </div>
              </div>

              <button
                style={{
                  ...styles.closeButton,
                  ...(hoveredSession === item.id
                    ? styles.closeButtonVisible
                    : {}),
                }}
                onClick={(e) => {
                  e.stopPropagation(); // prevent selecting session
                  onRemoveSession(item.id);
                }}
                title="Remove chat"
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>

      {totalPages > 1 && (
        <div style={styles.pagination}>
          <button
            style={{
              ...styles.pageButton,
              opacity: currentPage === 1 ? 0.5 : 1,
            }}
            disabled={currentPage === 1}
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
          >
            Previous
          </button>

          <span style={styles.pageText}>
            {currentPage} / {totalPages}
          </span>

          <button
            style={{
              ...styles.pageButton,
              opacity: currentPage === totalPages ? 0.5 : 1,
            }}
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};
