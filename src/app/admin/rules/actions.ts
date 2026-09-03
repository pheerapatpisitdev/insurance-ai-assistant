"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin, supabaseServer } from "@/lib/supabase/server";
import { getPlan, listPlans } from "@/calc/plans/registry";
import { applyRuleOverride, type RuleOverride } from "@/calc/plans/overrides";
import type { PlanRules } from "@/calc/types";

export interface RulesPageData {
  plans: { code: string; name: string }[];
  planCode: string;
  baseline: PlanRules;
  effective: PlanRules;
  hasOverride: boolean;
  history: { created_at: string; changed_by: string | null }[];
}

export async function loadRules(planCode: string): Promise<RulesPageData | null> {
  const plan = getPlan(planCode);
  if (!plan) return null;
  const supabase = await supabaseServer();
  const [override, audit] = await Promise.all([
    supabase.schema("ins").from("plan_rule_overrides").select("rules").eq("plan_code", planCode).maybeSingle(),
    supabase.schema("ins").from("rule_audit").select("created_at, changed_by").eq("plan_code", planCode)
      .order("created_at", { ascending: false }).limit(10),
  ]);
  const patch = (override.data?.rules ?? null) as RuleOverride | null;
  return {
    plans: listPlans(),
    planCode,
    baseline: plan.rules,
    effective: applyRuleOverride(planCode, patch)!,
    hasOverride: Boolean(patch),
    history: audit.data ?? [],
  };
}

export async function saveOverride(planCode: string, patch: RuleOverride) {
  const admin = await requireAdmin();
  if (!admin) throw new Error("ไม่มีสิทธิ์");
  if (!getPlan(planCode)) throw new Error("ไม่พบแบบประกัน");
  const supabase = await supabaseServer();
  const { data: before } = await supabase.schema("ins").from("plan_rule_overrides")
    .select("rules").eq("plan_code", planCode).maybeSingle();
  const { error } = await supabase.schema("ins").from("plan_rule_overrides").upsert({
    plan_code: planCode, rules: patch, updated_at: new Date().toISOString(), updated_by: admin.email,
  }, { onConflict: "plan_code" });
  if (error) throw new Error(error.message);
  await supabase.schema("ins").from("rule_audit").insert({
    plan_code: planCode, before: before?.rules ?? null, after: patch, changed_by: admin.email,
  });
  revalidatePath("/admin/rules");
  revalidatePath("/");
}

export async function clearOverride(planCode: string) {
  const admin = await requireAdmin();
  if (!admin) throw new Error("ไม่มีสิทธิ์");
  const supabase = await supabaseServer();
  const { data: before } = await supabase.schema("ins").from("plan_rule_overrides")
    .select("rules").eq("plan_code", planCode).maybeSingle();
  const { error } = await supabase.schema("ins").from("plan_rule_overrides").delete().eq("plan_code", planCode);
  if (error) throw new Error(error.message);
  await supabase.schema("ins").from("rule_audit").insert({
    plan_code: planCode, before: before?.rules ?? null, after: null, changed_by: admin.email,
  });
  revalidatePath("/admin/rules");
  revalidatePath("/");
}
