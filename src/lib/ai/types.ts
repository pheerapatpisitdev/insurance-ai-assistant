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
  /** text models are priced per token; image models (kind "image") per picture */
  price: { inputPerMTokUsd: number; outputPerMTokUsd: number; perImageUsd?: number };
  /** provider settings for image models: size, quality, aspect ratio */
  params?: Record<string, unknown> | null;
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
