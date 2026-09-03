import type { PlanRates, Sex } from "./types";

/** Base plan rate per 1,000 for (variant, sex, age); undefined if not in table. */
export function baseRate(rates: PlanRates, variant: string, sex: Sex, age: number): number | undefined {
  return rates.base.rates[variant]?.[sex]?.[String(age)];
}

/** Rider rate per 1,000 for (age, occupation class 1..4); undefined if not offered. Flat-rate riders ignore age. */
export function riderRateByAgeClass(rates: PlanRates, code: string, age: number, occClass: 1 | 2 | 3 | 4): number | undefined {
  const rider = rates.riders[code];
  if (!rider) return undefined;
  if (rider.kind === "flatRateByClass") return rider.rates[occClass - 1];
  if (rider.kind !== "ratePerThousandByAgeClass") return undefined;
  return rider.rates[String(age)]?.[occClass - 1];
}

/** Rate per 1,000 for a variant-based rider (e.g. PLS10) by sex and age. */
export function variantRate(rates: PlanRates, code: string, variant: string, sex: Sex, age: number): number | undefined {
  const rider = rates.riders[code];
  if (!rider || rider.kind !== "ratePerThousandByVariantAgeSex") return undefined;
  return rider.rates[variant]?.[sex]?.[String(age)];
}

/** Payor-benefit rate per 100 baht of base premium for (plancode, payer sex, payer age, waive period). */
export function payorRate(rates: PlanRates, code: string, plancode: string, sex: Sex, payerAge: number, period: number): number | undefined {
  const rider = rates.riders[code];
  if (!rider || rider.kind !== "payorBenefit") return undefined;
  return rider.rates[plancode]?.[sex]?.[String(payerAge)]?.[String(period)];
}

/** Fixed annual premium for (age, plan); undefined if age or plan not in table. */
export function fixedPremiumByAgePlan(rates: PlanRates, code: string, age: number, plan: number): number | undefined {
  const rider = rates.riders[code];
  if (!rider || rider.kind !== "fixedByAgePlan") return undefined;
  const idx = rider.plans.indexOf(plan);
  if (idx < 0) return undefined;
  return rider.premiums[String(age)]?.[idx];
}
