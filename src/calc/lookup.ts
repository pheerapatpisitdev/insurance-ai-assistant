import type { PlanRates, Sex } from "./types";

/** Base plan rate per 1,000 for (variant, sex, age); undefined if not in table. */
export function baseRate(rates: PlanRates, variant: string, sex: Sex, age: number): number | undefined {
  return rates.base.rates[variant]?.[sex]?.[String(age)];
}

/** Rider rate per 1,000 for (age, occupation class 1..4); undefined if not offered. */
export function riderRateByAgeClass(rates: PlanRates, code: string, age: number, occClass: 1 | 2 | 3 | 4): number | undefined {
  const rider = rates.riders[code];
  if (!rider || rider.kind !== "ratePerThousandByAgeClass") return undefined;
  return rider.rates[String(age)]?.[occClass - 1];
}

/** Fixed annual premium for (age, plan); undefined if age or plan not in table. */
export function fixedPremiumByAgePlan(rates: PlanRates, code: string, age: number, plan: number): number | undefined {
  const rider = rates.riders[code];
  if (!rider || rider.kind !== "fixedByAgePlan") return undefined;
  const idx = rider.plans.indexOf(plan);
  if (idx < 0) return undefined;
  return rider.premiums[String(age)]?.[idx];
}
