import type { PayMode, PlanRates } from "../types";
import { fixedPremiumByAgePlan } from "../lookup";
import { applyModeFactorToFixed, toHundredths } from "../money";

export interface FixedPlanInput {
  age: number;
  plan: number;
  mode: PayMode;
}
export interface FixedPlanResult {
  annual: number; // satang
  modal: number; // satang
}

/** Excel Cal!G21/H21 (MEB). A table value of 0 means "not offered" → undefined. */
export function fixedPlanRiderPremium(rates: PlanRates, code: string, input: FixedPlanInput): FixedPlanResult | undefined {
  const premium = fixedPremiumByAgePlan(rates, code, input.age, input.plan);
  if (premium === undefined || premium === 0) return undefined;
  const annual = toHundredths(premium);
  const factor100 = toHundredths(rates.modeFactors[input.mode]);
  return { annual, modal: applyModeFactorToFixed(annual, factor100) };
}
