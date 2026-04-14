import * as path from "path";
import * as fs from "fs";
import * as vscode from "vscode";
import { DatabaseSync } from "node:sqlite";

let db: DatabaseSync | null = null;

export async function initDatabase(
  context: vscode.ExtensionContext
): Promise<void> {
  const storagePath = context.globalStorageUri.fsPath;

  if (!fs.existsSync(storagePath)) {
    fs.mkdirSync(storagePath, { recursive: true });
  }

  const dbPath = path.join(storagePath, "chat.db");

  db = new DatabaseSync(dbPath);

  exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
  `);

  createTables();
}

function exec(sql: string): void {
  if (!db) throw new Error("Database not initialized");
  db.exec(sql);
}

function createTables(): void {
  exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      title TEXT,
      updated_at INTEGER,
      last_opened_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      input_tokens INTEGER,
      output_tokens INTEGER,
      total_tokens INTEGER,
      classification_data TEXT,

      FOREIGN KEY (session_id)
        REFERENCES sessions(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_messages_session
      ON messages(session_id, created_at);
    
    CREATE INDEX IF NOT EXISTS idx_messages_tokens
      ON messages(session_id, total_tokens);
  `);

  // Migrate existing database if needed
  migrateDatabase();
}

function migrateDatabase(): void {
  if (!db) return;

  try {
    // Check if columns exist
    const tableInfo = db.prepare("PRAGMA table_info(messages)").all() as any[];
    const hasTokens = tableInfo.some((col) => col.name === "input_tokens");
    const hasClassification = tableInfo.some(
      (col) => col.name === "classification_data"
    );

    if (!hasTokens || !hasClassification) {
      // Add new columns if they don't exist
      if (!hasTokens) {
        exec("ALTER TABLE messages ADD COLUMN input_tokens INTEGER;");
        exec("ALTER TABLE messages ADD COLUMN output_tokens INTEGER;");
        exec("ALTER TABLE messages ADD COLUMN total_tokens INTEGER;");
      }

      if (!hasClassification) {
        exec(`
          ALTER TABLE messages ADD COLUMN classification_data TEXT;
        `);
      }

      // Create index if it doesn't exist
      exec(`
        CREATE INDEX IF NOT EXISTS idx_messages_tokens
          ON messages(session_id, total_tokens);
      `);
    }
  } catch (err) {
    console.error("Migration error:", err);
    // Migration errors are not critical, continue
  }
}

export function getDb(): DatabaseSync {
  if (!db) throw new Error("Database not initialized");
  return db;
}
