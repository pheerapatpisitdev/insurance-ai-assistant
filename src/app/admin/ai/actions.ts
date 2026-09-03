"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/guard";
import { supabaseAdmin } from "@/lib/supabase/admin";

const PROVIDERS = ["anthropic", "openai", "google", "xai", "zai"] as const;
export type Provider = (typeof PROVIDERS)[number];

export interface KeyRow { provider: string; tail: string }
export interface ModelRow { id: string; provider: string; kind: string; model_name: string; enabled: boolean }
export interface Settings { default_text_model: string; monthly_budget_thb: number | null }

/** Never returns a whole key: the page only ever sees the last four characters. */
/**
 * The AI keys belong to the app, not to a visitor, so everything is scoped to the single
 * owner row that already holds them in this Supabase project.
 */
async function ownerId(supabase: ReturnType<typeof supabaseAdmin>): Promise<string> {
  const { data } = await supabase.from("api_keys").select("owner_id").limit(1).maybeSingle();
  if (data?.owner_id) return data.owner_id;
  const { data: settings } = await supabase.from("app_settings").select("owner_id").limit(1).maybeSingle();
  if (settings?.owner_id) return settings.owner_id;
  throw new Error("ไม่พบบัญชีเจ้าของกุญแจ AI ในฐานข้อมูล");
}

export async function loadAiPage(): Promise<{ keys: KeyRow[]; models: ModelRow[]; settings: Settings | null; providers: string[] }> {
  const supabase = supabaseAdmin();
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
  await requireAdmin();
  if (!PROVIDERS.includes(provider as Provider)) throw new Error("ค่ายไม่ถูกต้อง");
  if (key.trim().length < 8) throw new Error("กุญแจสั้นเกินไป");
  const supabase = supabaseAdmin();
  const { error } = await supabase
    .from("api_keys")
    .upsert({ owner_id: await ownerId(supabase), provider, key_encrypted: key.trim() }, { onConflict: "owner_id,provider" });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/ai");
}

export async function setModelEnabled(id: string, enabled: boolean) {
  await requireAdmin();
  const supabase = supabaseAdmin();
  const { error } = await supabase.from("model_configs").update({ enabled }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/ai");
}

export async function saveSettings(defaultTextModel: string, monthlyBudget: number | null) {
  await requireAdmin();
  const supabase = supabaseAdmin();
  const { error } = await supabase.from("app_settings").upsert({
    owner_id: await ownerId(supabase),
    default_text_model: defaultTextModel,
    monthly_budget_thb: monthlyBudget,
    updated_at: new Date().toISOString(),
  }, { onConflict: "owner_id" });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/ai");
}
