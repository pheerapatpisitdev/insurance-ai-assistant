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

  // Z.ai speaks the OpenAI chat format on its own host.
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

/**
 * Embeddings. Both options are asked for 1536 dimensions so they share one column and one
 * index; documents embedded by one provider stay searchable if the other takes over later.
 */
export const EMBEDDING_DIMS = 1536;

export interface EmbeddingProvider {
  provider: string;
  model: string;
  usdPerMTok: number;
  embed: (apiKey: string, inputs: string[], signal?: AbortSignal) => Promise<{ vectors: number[][]; tokens: number }>;
}

export const EMBEDDERS: EmbeddingProvider[] = [
  {
    provider: "google",
    model: "gemini-embedding-001",
    usdPerMTok: 0.15,
    async embed(apiKey, inputs, signal) {
      const data = await postJson(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:batchEmbedContents?key=${apiKey}`,
        {},
        {
          requests: inputs.map((text) => ({
            model: "models/gemini-embedding-001",
            content: { parts: [{ text }] },
            outputDimensionality: EMBEDDING_DIMS,
          })),
        }, signal);
      const vectors = (data.embeddings ?? []).map((e: { values: number[] }) => normalise(e.values));
      // Google does not report embedding tokens; approximate for the cost ledger.
      const tokens = Math.ceil(inputs.join(" ").length / 4);
      return { vectors, tokens };
    },
  },
  {
    provider: "openai",
    model: "text-embedding-3-small",
    usdPerMTok: 0.02,
    async embed(apiKey, inputs, signal) {
      const data = await postJson("https://api.openai.com/v1/embeddings", {
        Authorization: `Bearer ${apiKey}`,
      }, { model: "text-embedding-3-small", input: inputs, dimensions: EMBEDDING_DIMS }, signal);
      return {
        vectors: (data.data ?? []).map((d: { embedding: number[] }) => d.embedding),
        tokens: data.usage?.total_tokens ?? 0,
      };
    },
  },
];

/** Gemini returns unnormalised vectors below its native size; cosine search expects unit length. */
function normalise(v: number[]): number[] {
  const len = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  return len > 0 ? v.map((x) => x / len) : v;
}
