import type { ChatMessage } from "./types";

export interface CallArgs {
  apiKey: string;
  model: string;
  messages: ChatMessage[];
  maxTokens: number;
  /** ask the provider for strict JSON where it supports it */
  json?: boolean;
  signal?: AbortSignal;
}
export interface CallResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
}

const TIMEOUT_MS = 25_000;

async function postJson(url: string, headers: Record<string, string>, body: unknown, signal?: AbortSignal) {
  const timeout = AbortSignal.timeout(TIMEOUT_MS);
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
    signal: signal ?? timeout,
  });
  if (!res.ok) throw new Error(`${new URL(url).host} ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

/** Splits the system prompt out; Anthropic takes it as its own field. */
function splitSystem(messages: ChatMessage[]) {
  const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
  const rest = messages.filter((m) => m.role !== "system");
  return { system, rest };
}

export const CALLERS: Record<string, (a: CallArgs) => Promise<CallResult>> = {
  async anthropic({ apiKey, model, messages, maxTokens, signal }) {
    const { system, rest } = splitSystem(messages);
    const data = await postJson("https://api.anthropic.com/v1/messages", {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    }, {
      model, max_tokens: maxTokens,
      ...(system ? { system } : {}),
      messages: rest.map((m) => ({ role: m.role, content: m.content })),
    }, signal);
    const text = (data.content ?? []).filter((c: { type: string }) => c.type === "text")
      .map((c: { text: string }) => c.text).join("");
    return { text, inputTokens: data.usage?.input_tokens ?? 0, outputTokens: data.usage?.output_tokens ?? 0 };
  },

  async openai({ apiKey, model, messages, maxTokens, json, signal }) {
    const data = await postJson("https://api.openai.com/v1/chat/completions", {
      Authorization: `Bearer ${apiKey}`,
    }, {
      model, messages, max_completion_tokens: maxTokens,
      ...(json ? { response_format: { type: "json_object" } } : {}),
    }, signal);
    return {
      text: data.choices?.[0]?.message?.content ?? "",
      inputTokens: data.usage?.prompt_tokens ?? 0,
      outputTokens: data.usage?.completion_tokens ?? 0,
    };
  },

  async google({ apiKey, model, messages, maxTokens, json, signal }) {
    const { system, rest } = splitSystem(messages);
    const data = await postJson(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${apiKey}`,
      {},
      {
        ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
        contents: rest.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
        generationConfig: {
          maxOutputTokens: maxTokens,
          ...(json ? { responseMimeType: "application/json" } : {}),
        },
      }, signal);
    const text = (data.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? "").join("");
    return {
      text,
      inputTokens: data.usageMetadata?.promptTokenCount ?? 0,
      outputTokens: data.usageMetadata?.candidatesTokenCount ?? 0,
    };
  },

  // xAI and Z.ai both speak the OpenAI chat format on their own hosts.
  async xai(args) {
    return openAiCompatible("https://api.x.ai/v1/chat/completions", args);
  },
  async zai(args) {
    return openAiCompatible("https://api.z.ai/api/paas/v4/chat/completions", args);
  },
};

async function openAiCompatible(url: string, { apiKey, model, messages, maxTokens, json, signal }: CallArgs): Promise<CallResult> {
  const data = await postJson(url, { Authorization: `Bearer ${apiKey}` }, {
    model, messages, max_tokens: maxTokens,
    ...(json ? { response_format: { type: "json_object" } } : {}),
  }, signal);
  return {
    text: data.choices?.[0]?.message?.content ?? "",
    inputTokens: data.usage?.prompt_tokens ?? 0,
    outputTokens: data.usage?.completion_tokens ?? 0,
  };
}

/** Embeddings. OpenAI's small model is the only one wired up; 1536 dims matches the table. */
export async function embed(apiKey: string, inputs: string[], signal?: AbortSignal): Promise<{ vectors: number[][]; tokens: number }> {
  const data = await postJson("https://api.openai.com/v1/embeddings", {
    Authorization: `Bearer ${apiKey}`,
  }, { model: "text-embedding-3-small", input: inputs }, signal);
  return {
    vectors: (data.data ?? []).map((d: { embedding: number[] }) => d.embedding),
    tokens: data.usage?.total_tokens ?? 0,
  };
}

export const EMBEDDING_MODEL = "text-embedding-3-small";
export const EMBEDDING_DIMS = 1536;
export const EMBEDDING_USD_PER_MTOK = 0.02;
