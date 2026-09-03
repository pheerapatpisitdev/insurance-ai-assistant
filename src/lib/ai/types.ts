export type Role = "system" | "user" | "assistant";
export interface ChatMessage {
  role: Role;
  content: string;
}

export interface ModelRow {
  id: string;
  provider: string;
  kind: string;
  model_name: string;
  enabled: boolean;
  price: { inputPerMTokUsd: number; outputPerMTokUsd: number };
}

export interface ChatResult {
  text: string;
  model: string;
  provider: string;
  inputTokens: number;
  outputTokens: number;
  costThb: number;
}

/** "small" for parsing and short answers, "large" for reading documents. */
export type Tier = "small" | "large";
