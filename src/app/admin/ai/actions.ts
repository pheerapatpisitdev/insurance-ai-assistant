"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/guard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { clearAiConfigCache, testProviders, type ProviderCheck } from "@/lib/ai/client";

export type { ProviderCheck } from "@/lib/ai/client";

/**
 * The companies this system can call. xAI was here until 2026-09-17: the account was blocked
 * for want of credit, so every Grok call failed, and the owner asked for it to go rather than
 * sit in the chain costing a failed attempt whenever the fallback reached it.
 */
const PROVIDERS = ["anthropic", "openai", "google", "zai"] as const;
export type Provider = (typeof PROVIDERS)[number];

export interface KeyRow { provider: string; tail: string }
export interface ModelRow { id: string; provider: string; kind: string; model_name: string; enabled: boolean }
export interface Settings { small_model: string | null; large_model: string | null; monthly_budget_thb: number | null }

/** What one provider has cost since the first of the month, and what it was asked to do. */
export interface ProviderSpend {
  provider: string;
  calls: number;
  baht: number;
  /** the tasks it was used for, busiest first — "copilot", "route", "plan_info"… */
  tasks: string[];
}

function passphrase(): string {
  const s = process.env.ADMIN_SESSION_SECRET;
  if (!s) throw new Error("ADMIN_SESSION_SECRET ยังไม่ได้ตั้ง");
  return s;
}

/**
 * Never returns a whole key: the page only ever sees the last four characters.
 *
 * Guarded here and not only by the layout. A server action is a network entry point of its
 * own — the layout protects the page's HTML, not the function — and this one reads key tails,
 * model settings and the month's spend. It was the P1 filed against this file.
 */
export async function loadAiPage(): Promise<{
  keys: KeyRow[]; models: ModelRow[]; settings: Settings | null; providers: string[];
  spentThisMonth: number; spend: ProviderSpend[];
}> {
  await requireAdmin();
  const supabase = supabaseAdmin();
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  const [keys, models, prefs, settings, spend] = await Promise.all([
    supabase.from("ins_api_keys").select("provider, tail"),
    supabase.from("model_configs").select("id, provider, kind, model_name, enabled").order("provider").order("model_name"),
    supabase.from("ins_model_prefs").select("model_id, enabled"),
    supabase.from("ins_ai_settings").select("small_model, large_model, monthly_budget_thb").maybeSingle(),
    // the model rather than the provider is what the ledger records, so the rows are joined
    // back to the model table below; the ledger has no column saying which company was paid
    supabase.from("ins_usage_ledger").select("model, task, cost_thb").gte("created_at", monthStart),
  ]);
  const disabled = new Set((prefs.data ?? []).filter((p) => !p.enabled).map((p) => p.model_id));
  const rows = (spend.data ?? []) as { model: string | null; task: string | null; cost_thb: number | null }[];
  return {
    keys: keys.data ?? [],
    /**
     * Only the companies above. `model_configs` is shared with another product, so it lists
     * models this system has no key for and no code to call — Grok is in it still, and would
     * otherwise go on being offered here as something to switch on.
     */
    models: (models.data ?? [])
      .filter((m) => (PROVIDERS as readonly string[]).includes(m.provider))
      .map((m) => ({ ...m, enabled: m.enabled && !disabled.has(m.id) })),
    settings: settings.data ?? null,
    providers: [...PROVIDERS],
    spentThisMonth: rows.reduce((sum, r) => sum + Number(r.cost_thb ?? 0), 0),
    spend: byProvider(rows, (models.data ?? []) as { provider: string; model_name: string }[]),
  };
}

/**
 * The month's spending, one line per company.
 *
 * A single total says the month is costing money; it does not say which of five keys is
 * doing it, and that is the question somebody looking at this card is actually asking.
 */
function byProvider(
  rows: { model: string | null; task: string | null; cost_thb: number | null }[],
  models: { provider: string; model_name: string }[],
): ProviderSpend[] {
  const providerOf = new Map(models.map((m) => [m.model_name, m.provider]));
  const acc = new Map<string, { calls: number; baht: number; tasks: Map<string, number> }>();
  for (const r of rows) {
    // a model the reference table no longer lists still cost money, and saying so under its
    // own name beats dropping the row and quietly under-reporting the month
    const provider = providerOf.get(r.model ?? "") ?? (r.model ? `${r.model} (ไม่รู้จักค่าย)` : "ไม่ทราบ");
    const at = acc.get(provider) ?? { calls: 0, baht: 0, tasks: new Map<string, number>() };
    at.calls += 1;
    at.baht += Number(r.cost_thb ?? 0);
    const task = r.task ?? "ไม่ระบุ";
    at.tasks.set(task, (at.tasks.get(task) ?? 0) + 1);
    acc.set(provider, at);
  }
  return [...acc.entries()]
    .map(([provider, v]) => ({
      provider, calls: v.calls, baht: v.baht,
      tasks: [...v.tasks.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t),
    }))
    .sort((a, b) => b.baht - a.baht);
}

export async function saveApiKey(provider: string, key: string) {
  await requireAdmin();
  if (!PROVIDERS.includes(provider as Provider)) throw new Error("ค่ายไม่ถูกต้อง");
  /**
   * Everything a key is not.
   *
   * An API key is printable ASCII by construction, and `trim()` only cleans the ends. One
   * arrived here with U+2028 — a line separator, invisible, picked up from a copied web page
   * — ninety characters in, and every xAI call then died building its own HTTP header:
   * "character at index 91 has a value of 8232". On the page that reads as the provider
   * being down, which it was not, and no amount of re-reading the provider's status would
   * ever have said so.
   */
  const value = key.replace(/[^\x21-\x7e]/g, "");
  if (value.length < 8) throw new Error("กุญแจสั้นเกินไป");
  const { error } = await supabaseAdmin().rpc("ins_set_api_key", {
    p_provider: provider, p_key: value, p_passphrase: passphrase(),
  });
  if (error) throw new Error(error.message);
  clearAiConfigCache();
  revalidatePath("/admin/ai");
}

export async function setModelEnabled(id: string, enabled: boolean) {
  await requireAdmin();
  const { error } = await supabaseAdmin().from("ins_model_prefs")
    .upsert({ model_id: id, enabled, updated_at: new Date().toISOString() }, { onConflict: "model_id" });
  if (error) throw new Error(error.message);
  clearAiConfigCache();
  revalidatePath("/admin/ai");
}

export async function saveSettings(smallModel: string, largeModel: string, monthlyBudget: number | null) {
  await requireAdmin();
  const { error } = await supabaseAdmin().from("ins_ai_settings").upsert({
    id: true, small_model: smallModel || null, large_model: largeModel || null,
    monthly_budget_thb: monthlyBudget, updated_at: new Date().toISOString(),
  }, { onConflict: "id" });
  if (error) throw new Error(error.message);
  clearAiConfigCache();
  revalidatePath("/admin/ai");
}

/**
 * Which providers are answering right now.
 *
 * On demand rather than on load: it costs a token per provider, which is nothing, but a
 * page that spends money every time it is opened is a page nobody should have written.
 */
export async function checkKeys(): Promise<ProviderCheck[]> {
  await requireAdmin();
  return testProviders([...PROVIDERS]);
}
