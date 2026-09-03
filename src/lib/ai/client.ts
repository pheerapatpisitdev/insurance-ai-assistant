import { supabaseAdmin } from "@/lib/supabase/admin";
import { CALLERS, embed, EMBEDDING_MODEL, EMBEDDING_USD_PER_MTOK } from "./providers";
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
  throw new Error(`ไม่มีผู้ให้บริการ AI ที่ตอบได้\n${tried.join("\n")}`);
}

/** Turns text into vectors for the knowledge base. Needs the OpenAI key. */
export async function embedTexts(texts: string[], task = "embed"): Promise<number[][]> {
  const config = await loadConfig();
  await assertWithinBudget(config);
  const key = config.keys.openai;
  if (!key) throw new Error("ต้องมีกุญแจ OpenAI สำหรับแปลงข้อความเป็นเวกเตอร์");
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += 64) {
    const batch = texts.slice(i, i + 64);
    const { vectors, tokens } = await embed(key, batch);
    out.push(...vectors);
    await record(EMBEDDING_MODEL, task, tokens, 0, tokens / 1e6 * EMBEDDING_USD_PER_MTOK * USD_TO_THB);
  }
  return out;
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
