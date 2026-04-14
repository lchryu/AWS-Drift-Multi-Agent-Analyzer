export interface ChatSession {
  id: string;
  title: string;
  updated_at: number;
  last_opened_at: number;
}

export interface Message {
  id: string;
  session_id: string;
  role: "ai" | "user";
  content: string;
  created_at: number;
}

export type ClassificationInfo = {
  severity: "low" | "medium" | "high" | "critical";
  explanation: string;
  causes: string;
  solutions: string;
  problems: string;
};
