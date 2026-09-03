import type { PlanRules } from "../types";
import { getPlan } from "./registry";

/** A rule edit made in the back office, stored as a partial override of the file in the repo. */
export interface RuleOverride {
  base?: Partial<PlanRules["base"]>;
  riders?: Record<string, Partial<PlanRules["riders"][string]>>;
  minMonthlyTotal?: number;
}

/**
 * Merges a back-office override onto the rules shipped in the repo. The repo file stays the
 * baseline, so clearing an override restores the original behaviour exactly.
 */
export function applyRuleOverride(planCode: string, override: RuleOverride | null | undefined): PlanRules | undefined {
  const plan = getPlan(planCode);
  if (!plan) return undefined;
  const base = plan.rules;
  if (!override) return base;
  const riders: PlanRules["riders"] = { ...base.riders };
  for (const [code, patch] of Object.entries(override.riders ?? {})) {
    if (riders[code]) riders[code] = { ...riders[code], ...patch };
  }
  return {
    ...base,
    base: { ...base.base, ...override.base },
    minMonthlyTotal: override.minMonthlyTotal ?? base.minMonthlyTotal,
    riders,
  };
}

/** The fields the back office is allowed to edit, with the labels shown on screen. */
export const EDITABLE_BASE_FIELDS = [
  { key: "ageMin", label: "อายุรับประกันต่ำสุด" },
  { key: "ageMax", label: "อายุรับประกันสูงสุด" },
  { key: "saMin", label: "ทุนประกันขั้นต่ำ" },
  { key: "saMax", label: "ทุนประกันสูงสุด" },
] as const;

export const EDITABLE_RIDER_FIELDS = [
  { key: "ageMin", label: "อายุต่ำสุด" },
  { key: "ageMax", label: "อายุสูงสุด" },
  { key: "saMin", label: "ทุนขั้นต่ำ" },
  { key: "saMaxMultipleOfBase", label: "ทุนสูงสุด (เท่าของสัญญาหลัก)" },
  { key: "saMaxCap", label: "เพดานทุนสูงสุด" },
] as const;
