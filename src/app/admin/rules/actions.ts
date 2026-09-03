"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/guard";
import { supabaseAdmin } from "@/lib/supabase/admin";
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
  const supabase = supabaseAdmin();
  const [override, audit] = await Promise.all([
    supabase.from("ins_plan_rule_overrides").select("rules").eq("plan_code", planCode).maybeSingle(),
    supabase.from("ins_rule_audit").select("created_at, changed_by").eq("plan_code", planCode)
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
  await requireAdmin();
  if (!getPlan(planCode)) throw new Error("ไม่พบแบบประกัน");
  const supabase = supabaseAdmin();
  const { data: before } = await supabase.from("ins_plan_rule_overrides")
    .select("rules").eq("plan_code", planCode).maybeSingle();
  const { error } = await supabase.from("ins_plan_rule_overrides").upsert({
    plan_code: planCode, rules: patch, updated_at: new Date().toISOString(), updated_by: "admin",
  }, { onConflict: "plan_code" });
  if (error) throw new Error(error.message);
  await supabase.from("ins_rule_audit").insert({
    plan_code: planCode, before: before?.rules ?? null, after: patch, changed_by: "admin",
  });
  revalidatePath("/admin/rules");
  revalidatePath("/");
}

export async function clearOverride(planCode: string) {
  await requireAdmin();
  const supabase = supabaseAdmin();
  const { data: before } = await supabase.from("ins_plan_rule_overrides")
    .select("rules").eq("plan_code", planCode).maybeSingle();
  const { error } = await supabase.from("ins_plan_rule_overrides").delete().eq("plan_code", planCode);
  if (error) throw new Error(error.message);
  await supabase.from("ins_rule_audit").insert({
    plan_code: planCode, before: before?.rules ?? null, after: null, changed_by: "admin",
  });
  revalidatePath("/admin/rules");
  revalidatePath("/");
}
