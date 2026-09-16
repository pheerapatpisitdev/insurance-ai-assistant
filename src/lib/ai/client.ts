import { supabaseAdmin } from "@/lib/supabase/admin";
import { CALLERS, EMBEDDERS } from "./providers";
import type { ChatMessage, ChatResult, ModelRow, Tier } from "./types";

const USD_TO_THB = 36;

/**
 * Preference order per tier. The first enabled model whose provider has a key wins; if a
 * call fails the next one is tried, so one provider being down does not take the bot down.
 */
const TIER_PREFERENCE: Record<Tier, string[]> = {
  small: ["gemini-3.1-flash-lite", "gpt-5-mini", "glm-5.3-flash", "claude-haiku-4-5-20251001", "grok-4.3"],
  large: ["claude-sonnet-5", "gpt-5", "gemini-3.7-flash", "grok-4.6", "glm-5.3"],
};

export class BudgetExceeded extends Error {
  constructor() {
    super("ถึงงบค่า AI ของเดือนนี้แล้ว");
    this.name = "BudgetExceeded";
  }
}

interface Config {
  keys: Record<string, string>;
  models: ModelRow[];
  budgetThb: number | null;
  smallModel: string | null;
  largeModel: string | null;
}

function passphrase(): string {
  const s = process.env.ADMIN_SESSION_SECRET;
  if (!s) throw new Error("ADMIN_SESSION_SECRET is not set");
  return s;
}

let cached: { at: number; config: Config } | null = null;
const CACHE_MS = 60_000;

async function loadConfig(): Promise<Config> {
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.config;
  const supabase = supabaseAdmin();
  // Model names and prices come from the shared reference table (read only); which of them
  // this app may use, and the keys themselves, live in this app's own tables.
  const [keys, models, prefs, settings] = await Promise.all([
    supabase.rpc("ins_get_api_keys", { p_passphrase: passphrase() }),
    supabase.from("model_configs").select("id, provider, kind, model_name, enabled, price"),
    supabase.from("ins_model_prefs").select("model_id, enabled"),
    supabase.from("ins_ai_settings").select("small_model, large_model, monthly_budget_thb").maybeSingle(),
  ]);
  const disabled = new Set((prefs.data ?? []).filter((p) => !p.enabled).map((p) => p.model_id));
  const config: Config = {
    keys: Object.fromEntries(((keys.data ?? []) as { provider: string; api_key: string }[])
      .filter((k) => k.api_key).map((k) => [k.provider, k.api_key])),
    models: ((models.data ?? []) as ModelRow[]).map((m) => ({ ...m, enabled: m.enabled && !disabled.has(m.id) })),
    budgetThb: settings.data?.monthly_budget_thb ?? null,
    smallModel: settings.data?.small_model ?? null,
    largeModel: settings.data?.large_model ?? null,
  };
  /**
   * A read that came back with no keys is a failure, not a configuration: every model needs
   * one, so caching it would silence the bot for the minute the cache lives. It cost a
   * customer from the advertisement one evening — the first request on a fresh deployment
   * could not read the key table, and the lead was told to ask again later.
   */
  if (Object.keys(config.keys).length === 0) {
    if (keys.error) console.error("ai keys unreadable:", keys.error.message);
    return config;
  }
  cached = { at: Date.now(), config };
  return config;
}

/** Forces the next call to re-read keys and settings; used after the admin page saves. */
export function clearAiConfigCache() {
  cached = null;
}

/** Spend so far this calendar month, in baht. */
async function spentThisMonth(): Promise<number> {
  const start = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  const { data } = await supabaseAdmin()
    .from("ins_usage_ledger").select("cost_thb").gte("created_at", start);
  return (data ?? []).reduce((s, r) => s + Number(r.cost_thb ?? 0), 0);
}

async function assertWithinBudget(config: Config) {
  if (config.budgetThb === null) return;
  if ((await spentThisMonth()) >= Number(config.budgetThb)) throw new BudgetExceeded();
}

/** Records what a call cost. Never records the customer's words, only counts and money. */
async function record(model: string, task: string, inTok: number, outTok: number, costThb: number) {
  await supabaseAdmin().from("ins_usage_ledger").insert({
    model, task, input_tokens: inTok, output_tokens: outTok, cost_thb: Number(costThb.toFixed(6)),
  });
}

function candidates(config: Config, tier: Tier): ModelRow[] {
  const enabled = config.models.filter((m) => m.kind === "text" && m.enabled && config.keys[m.provider]);
  const chosen = tier === "small" ? config.smallModel : config.largeModel;
  const order = chosen ? [chosen, ...TIER_PREFERENCE[tier]] : TIER_PREFERENCE[tier];
  const preferred = order
    .map((name) => enabled.find((m) => m.model_name === name))
    .filter((m): m is ModelRow => Boolean(m));
  const rest = enabled.filter((m) => !preferred.includes(m));
  return [...preferred, ...rest];
}

export interface ChatOptions {
  tier: Tier;
  task: string;
  messages: ChatMessage[];
  maxTokens?: number;
  json?: boolean;
}

/** Sends one prompt, trying providers in order until one answers. */
export async function chat({ tier, task, messages, maxTokens = 700, json }: ChatOptions): Promise<ChatResult> {
  const config = await loadConfig();
  await assertWithinBudget(config);
  const tried: string[] = [];
  for (const model of candidates(config, tier)) {
    const call = CALLERS[model.provider];
    if (!call) continue;
    try {
      const r = await call({ apiKey: config.keys[model.provider], model: model.model_name, messages, maxTokens, json });
      const costThb = (r.inputTokens / 1e6 * model.price.inputPerMTokUsd
        + r.outputTokens / 1e6 * model.price.outputPerMTokUsd) * USD_TO_THB;
      await record(model.model_name, task, r.inputTokens, r.outputTokens, costThb);
      return { text: r.text, model: model.model_name, provider: model.provider, inputTokens: r.inputTokens, outputTokens: r.outputTokens, costThb };
    } catch (e) {
      tried.push(`${model.model_name}: ${e instanceof Error ? e.message : e}`);
    }
  }
  if (tried.length === 0) throw new Error("ไม่มีคีย์ผู้ให้บริการ AI ที่ใช้ได้ในตอนนี้");
  throw new Error(`ไม่มีผู้ให้บริการ AI ที่ตอบได้\n${tried.join("\n")}`);
}

/** Turns text into vectors for the knowledge base, trying each embedding provider in turn. */
export async function embedTexts(texts: string[], task = "embed"): Promise<number[][]> {
  const config = await loadConfig();
  await assertWithinBudget(config);
  const tried: string[] = [];
  for (const e of EMBEDDERS) {
    const key = config.keys[e.provider];
    if (!key) continue;
    try {
      const out: number[][] = [];
      for (let i = 0; i < texts.length; i += 32) {
        const { vectors, tokens } = await e.embed(key, texts.slice(i, i + 32));
        out.push(...vectors);
        await record(e.model, task, tokens, 0, tokens / 1e6 * e.usdPerMTok * USD_TO_THB);
      }
      return out;
    } catch (err) {
      tried.push(`${e.model}: ${err instanceof Error ? err.message : err}`);
    }
  }
  throw new Error(`แปลงข้อความเป็นเวกเตอร์ไม่สำเร็จ\n${tried.join("\n")}`);
}

/** Reads the first JSON object out of a model's reply, tolerating code fences. */
export function parseJsonReply<T>(text: string): T | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = (fenced ? fenced[1] : text).trim();
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(body.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}

/** Why a provider is or is not answering right now. */
export type ProviderState = "ok" | "failed" | "no-key" | "no-model";

export interface ProviderCheck {
  provider: string;
  state: ProviderState;
  /** how long the provider took to answer or to refuse, in milliseconds */
  ms: number;
  /** the model the question was put to */
  model?: string;
  /** what the provider said when it refused, trimmed and with anything key-shaped removed */
  error?: string;
}

/** Long enough for a cold provider, short enough that five of them do not hang the page. */
const CHECK_TIMEOUT_MS = 15_000;

/**
 * Output tokens the check allows itself.
 *
 * One was the obvious answer and it was wrong: a reasoning model spends its output budget
 * thinking before it writes anything, so GPT-5 hit the ceiling before its first character
 * and returned 400 — "max_tokens or model output limit was reached". The check then reported
 * a perfectly good key as a dead provider, which is the one mistake a health check must not
 * make. Sixteen is enough for every provider here to finish, and still costs nothing.
 */
const CHECK_MAX_TOKENS = 16;

/**
 * Anything in an error that looks like a credential, taken out before it reaches a screen.
 *
 * Providers do not normally quote the key back, but this text is written by five different
 * companies and read in a browser, and the cost of being wrong once is a key in a screenshot.
 */
function scrub(message: string): string {
  return message
    .replace(/\b(sk|xai|gsk)-[A-Za-z0-9_-]{8,}/g, "[คีย์]")
    .replace(/\b[A-Za-z0-9_-]{32,}\b/g, "[คีย์]")
    .slice(0, 200);
}

/**
 * Ask every provider one question, and report which of them answered.
 *
 * There is no way to read this off the usage history. The chat call tries providers in
 * order and stops at the first that answers, so a provider with no usage may be perfectly
 * healthy and simply never reached — and a key that expired this morning looks identical to
 * one that has been fine all year until something actually asks it.
 *
 * So this asks. A few tokens of output each, which is thousandths of a satang, and only when
 * somebody presses the button. The result is not written to the usage ledger: it is a
 * diagnostic about the keys, not work done for a customer.
 */
export async function testProviders(providers: string[]): Promise<ProviderCheck[]> {
  const config = await loadConfig();
  return Promise.all(providers.map(async (provider): Promise<ProviderCheck> => {
    const apiKey = config.keys[provider];
    if (!apiKey) return { provider, state: "no-key", ms: 0 };

    // an enabled model first, because that is what the bot would actually reach for; a
    // disabled one still proves the key, which is the question being asked
    const models = config.models.filter((m) => m.provider === provider && m.kind === "text");
    const model = models.find((m) => m.enabled) ?? models[0];
    const call = CALLERS[provider];
    if (!model || !call) return { provider, state: "no-model", ms: 0 };

    const began = Date.now();
    try {
      await call({
        apiKey, model: model.model_name,
        messages: [{ role: "user", content: "ping" }],
        maxTokens: CHECK_MAX_TOKENS,
        signal: AbortSignal.timeout(CHECK_TIMEOUT_MS),
      });
      return { provider, state: "ok", ms: Date.now() - began, model: model.model_name };
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e);
      return {
        provider, state: "failed", ms: Date.now() - began, model: model.model_name,
        error: scrub(raw.includes("timeout") || raw.includes("abort") ? `ไม่ตอบภายใน ${CHECK_TIMEOUT_MS / 1000} วินาที` : raw),
      };
    }
  }));
}
