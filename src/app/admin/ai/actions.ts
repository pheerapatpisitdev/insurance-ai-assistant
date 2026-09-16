"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/guard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { clearAiConfigCache, testProviders, type ProviderCheck } from "@/lib/ai/client";

export type { ProviderCheck } from "@/lib/ai/client";

const PROVIDERS = ["anthropic", "openai", "google", "xai", "zai"] as const;
export type Provider = (typeof PROVIDERS)[number];

export interface KeyRow { provider: string; tail: string }
export interface ModelRow { id: string; provider: string; kind: string; model_name: string; enabled: boolean }
export interface Settings { small_model: string | null; large_model: string | null; monthly_budget_thb: number | null }

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
  keys: KeyRow[]; models: ModelRow[]; settings: Settings | null; providers: string[]; spentThisMonth: number;
}> {
  await requireAdmin();
  const supabase = supabaseAdmin();
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  const [keys, models, prefs, settings, spend] = await Promise.all([
    supabase.from("ins_api_keys").select("provider, tail"),
    supabase.from("model_configs").select("id, provider, kind, model_name, enabled").order("provider").order("model_name"),
    supabase.from("ins_model_prefs").select("model_id, enabled"),
    supabase.from("ins_ai_settings").select("small_model, large_model, monthly_budget_thb").maybeSingle(),
    supabase.from("ins_usage_ledger").select("cost_thb").gte("created_at", monthStart),
  ]);
  const disabled = new Set((prefs.data ?? []).filter((p) => !p.enabled).map((p) => p.model_id));
  return {
    keys: keys.data ?? [],
    models: (models.data ?? []).map((m) => ({ ...m, enabled: m.enabled && !disabled.has(m.id) })),
    settings: settings.data ?? null,
    providers: [...PROVIDERS],
    spentThisMonth: (spend.data ?? []).reduce((s, r) => s + Number(r.cost_thb ?? 0), 0),
  };
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
