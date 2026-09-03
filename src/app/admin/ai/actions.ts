"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin, supabaseServer } from "@/lib/supabase/server";

const PROVIDERS = ["anthropic", "openai", "google", "xai", "zai"] as const;
export type Provider = (typeof PROVIDERS)[number];

export interface KeyRow { provider: string; tail: string }
export interface ModelRow { id: string; provider: string; kind: string; model_name: string; enabled: boolean }
export interface Settings { default_text_model: string; monthly_budget_thb: number | null }

/** Never returns a whole key: the page only ever sees the last four characters. */
export async function loadAiPage(): Promise<{ keys: KeyRow[]; models: ModelRow[]; settings: Settings | null; providers: string[] }> {
  const supabase = await supabaseServer();
  const [keys, models, settings] = await Promise.all([
    supabase.from("api_keys").select("provider, key_encrypted"),
    supabase.from("model_configs").select("id, provider, kind, model_name, enabled").order("provider").order("model_name"),
    supabase.from("app_settings").select("default_text_model, monthly_budget_thb").maybeSingle(),
  ]);
  return {
    keys: (keys.data ?? []).map((k) => ({ provider: k.provider, tail: String(k.key_encrypted).slice(-4) })),
    models: models.data ?? [],
    settings: settings.data ?? null,
    providers: [...PROVIDERS],
  };
}

export async function saveApiKey(provider: string, key: string) {
  const admin = await requireAdmin();
  if (!admin) throw new Error("ไม่มีสิทธิ์");
  if (!PROVIDERS.includes(provider as Provider)) throw new Error("ค่ายไม่ถูกต้อง");
  if (key.trim().length < 8) throw new Error("กุญแจสั้นเกินไป");
  const supabase = await supabaseServer();
  const { error } = await supabase
    .from("api_keys")
    .upsert({ owner_id: admin.userId, provider, key_encrypted: key.trim() }, { onConflict: "owner_id,provider" });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/ai");
}

export async function setModelEnabled(id: string, enabled: boolean) {
  if (!(await requireAdmin())) throw new Error("ไม่มีสิทธิ์");
  const supabase = await supabaseServer();
  const { error } = await supabase.from("model_configs").update({ enabled }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/ai");
}

export async function saveSettings(defaultTextModel: string, monthlyBudget: number | null) {
  const admin = await requireAdmin();
  if (!admin) throw new Error("ไม่มีสิทธิ์");
  const supabase = await supabaseServer();
  const { error } = await supabase.from("app_settings").upsert({
    owner_id: admin.userId,
    default_text_model: defaultTextModel,
    monthly_budget_thb: monthlyBudget,
    updated_at: new Date().toISOString(),
  }, { onConflict: "owner_id" });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/ai");
}
