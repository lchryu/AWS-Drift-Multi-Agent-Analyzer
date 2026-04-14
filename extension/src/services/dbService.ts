import { getDb } from "../db/sqlite";
import { randomUUID } from "crypto";

export interface TokenUsage {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}

export interface ClassificationData {
  severity: "low" | "medium" | "high" | "critical";
  explanation: string;
  causes: string;
  solutions: string;
  problems: string;
}

export function createSession(title: string): string {
  const db = getDb();
  const id = randomUUID();
  const now = Date.now();

  db.prepare(
    `
    INSERT INTO sessions (id, title, updated_at, last_opened_at)
    VALUES (?, ?, ?, ?)
  `
  ).run(id, title, now, now);

  return id;
}

export function addMessage(
  sessionId: string,
  role: "user" | "ai",
  content: string,
  tokenUsage?: TokenUsage,
  classificationData?: ClassificationData
) {
  const db = getDb();
  const now = Date.now();
  const messageID = randomUUID();

  // Convert classification to JSON string if provided
  const classificationJson = classificationData
    ? JSON.stringify(classificationData)
    : null;

  db.prepare(
    `
    INSERT INTO messages (
      id, session_id, role, content, created_at,
      input_tokens, output_tokens, total_tokens, classification_data
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `
  ).run(
    messageID,
    sessionId,
    role,
    content,
    now,
    tokenUsage?.inputTokens ?? null,
    tokenUsage?.outputTokens ?? null,
    tokenUsage?.totalTokens ?? null,
    classificationJson
  );

  db.prepare(
    `
    UPDATE sessions
    SET updated_at = ?, last_opened_at = ?
    WHERE id = ?
  `
  ).run(now, now, sessionId);

  return {
    messageID,
    sessionId,
    role,
    content,
    now,
    tokenUsage,
    classificationData,
  };
}

export function getRecentSessions(limit = 20): {
  id: string;
  title: string;
  updated_at: number;
}[] {
  const db = getDb();

  const rows = db
    .prepare(
      `
    SELECT id, title, updated_at
    FROM sessions
    ORDER BY last_opened_at DESC
    LIMIT ?
  `
    )
    .all(limit) as any[];

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    updated_at: row.updated_at,
  }));
}

export function getSessionMessages(sessionId: string): {
  role: "user" | "ai";
  content: string;
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
  classification_data?: ClassificationData;
}[] {
  const db = getDb();

  const rows = db
    .prepare(
      `
    SELECT role, content, input_tokens, output_tokens, total_tokens, classification_data
    FROM messages
    WHERE session_id = ?
    ORDER BY created_at ASC
  `
    )
    .all(sessionId) as any[];

  return rows.map((row) => {
    const result: any = {
      role: row.role,
      content: row.content,
    };

    if (row.input_tokens !== null && row.input_tokens !== undefined) {
      result.input_tokens = row.input_tokens;
    }
    if (row.output_tokens !== null && row.output_tokens !== undefined) {
      result.output_tokens = row.output_tokens;
    }
    if (row.total_tokens !== null && row.total_tokens !== undefined) {
      result.total_tokens = row.total_tokens;
    }

    if (row.classification_data) {
      try {
        result.classification_data = JSON.parse(row.classification_data);
      } catch (e) {
        console.error("Failed to parse classification_data:", e);
      }
    }

    return result;
  });
}

export function deleteSession(sessionId: string): void {
  const db = getDb();

  db.prepare(
    `
    DELETE FROM sessions
    WHERE id = ?
  `
  ).run(sessionId);
}

export function renameSession(sessionId: string, title: string) {
  const db = getDb();
  const now = Date.now();

  db.prepare(`
    UPDATE sessions
    SET title = ?, updated_at = ?
    WHERE id = ?
  `).run(title, now, sessionId);
}
