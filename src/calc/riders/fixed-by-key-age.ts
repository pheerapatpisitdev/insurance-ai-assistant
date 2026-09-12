import type { PayMode, PlanRates, RiderInput, Sex } from "../types";
import { applyModeFactorToFixed, toHundredths } from "../money";

/**
 * Below this age iHealthy Ultra is quoted from its juvenile table ("J") and above it from the
 * standard one ("S"). The health page composes the same key in the browser, so the switch is
 * named here once rather than copied to each side of the wire.
 */
export const JUVENILE_BELOW_AGE = 11;

export interface FixedByKeyAgeInput {
  age: number;
  sex: Sex;
  mode: PayMode;
  selection: Pick<RiderInput, "option" | "territory" | "coverage">;
}
export interface FixedByKeyAgeResult {
  key: string;
  annual: number; // satang
  modal: number; // satang
}

/**
 * Builds the rate key the workbook composes:
 *   MEX                 → the plan amount itself ("2200")
 *   iHealthy Ultra      → "MHP" + coverage letter + plan number + (juvenile ? "J" : "S") + territory letter
 *   Roke Rai So Shield  → "MCI" + plan number
 */
export function fixedRateKey(rates: PlanRates, code: string, age: number, selection: FixedByKeyAgeInput["selection"]): string | undefined {
  const rider = rates.riders[code];
  if (!rider || rider.kind !== "fixedByKeyAge") return undefined;
  const option = selection.option;
  if (!option) return undefined;
  if (rider.keyBy === "plan") return option;
  const no = rider.planNo?.[option.toUpperCase()];
  if (no === undefined) return undefined;
  if (rider.keyBy === "rokeRaiSoShield") return `MCI${no}`;
  const coverage = rider.coverage?.[selection.coverage ?? "Full Coverage"];
  const territory = rider.territory?.[selection.territory ?? "ประเทศไทย"];
  if (coverage === undefined || territory === undefined) return undefined;
  return `MHP${coverage}${no}${age < JUVENILE_BELOW_AGE ? "J" : "S"}${territory}`;
}

/** Excel Cal!D22/G22 (MEX), G23 (iHealthy Ultra), G24 (Roke Rai So Shield): a fixed annual premium. */
export function fixedByKeyAgePremium(rates: PlanRates, code: string, input: FixedByKeyAgeInput): FixedByKeyAgeResult | undefined {
  const rider = rates.riders[code];
  if (!rider || rider.kind !== "fixedByKeyAge") return undefined;
  const key = fixedRateKey(rates, code, input.age, input.selection);
  if (!key) return undefined;
  const premium = rider.rates[key]?.[input.sex]?.[String(input.age)];
  if (premium === undefined || premium === 0) return undefined;
  const annual = toHundredths(premium);
  const factor100 = toHundredths(rates.modeFactors[input.mode]);
  return { key, annual, modal: applyModeFactorToFixed(annual, factor100) };
}
