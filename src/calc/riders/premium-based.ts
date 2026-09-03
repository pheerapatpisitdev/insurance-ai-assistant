import type { PayMode, Payer, PlanRates, Sex } from "../types";
import { applyModeFactorToFixed, floorDiv, toHundredths } from "../money";

export interface PremiumBasedInput {
  /** option code from rates.riders[code].options, e.g. "FIT" */
  option: string;
  insuredAge: number;
  insuredSex: Sex;
  /** required when the rider is keyed on the payer */
  payer?: Payer;
  /** base plan premium-paying term in years */
  payTerm: number;
  /** base plan annual premium in satang (Excel Cal!I13) */
  baseAnnual: number;
  mode: PayMode;
}
export interface PremiumBasedResult {
  plancode: string;
  period: number;
  rate: number;
  annual: number; // satang
  modal: number; // satang
}

const PARENT_MAX_INSURED_AGE = 15;

/**
 * Excel Cal!F10/F11, D14/D15, G14/G15, H14/H15:
 *   plancode = insured ≤15 ? parent : spouse
 *   period   = payer-keyed and insured ≤15 ? MIN(payTerm, 25 − insuredAge) : payTerm
 *   annual   = TRUNC(rate × TRUNC(baseAnnual/100, 3), 2)
 *   modal    = TRUNC(annual × factor, 2)          (from the rounded annual)
 */
export function premiumBasedRiderPremium(rates: PlanRates, code: string, input: PremiumBasedInput): PremiumBasedResult | undefined {
  const rider = rates.riders[code];
  if (!rider || (rider.kind !== "premiumBased" && rider.kind !== "payorBenefit")) return undefined;
  const opt = rider.options[input.option];
  if (!opt) return undefined;
  const byPayer = rider.kind === "payorBenefit" || rider.by === "payer";
  const isParent = input.insuredAge <= PARENT_MAX_INSURED_AGE;
  const plancode = isParent ? opt.parent : opt.spouse;
  const period = byPayer && isParent ? Math.min(input.payTerm, 25 - input.insuredAge) : input.payTerm;
  const who = byPayer ? input.payer : { age: input.insuredAge, sex: input.insuredSex };
  if (!who) return undefined;
  const rate = rider.rates[plancode]?.[who.sex]?.[String(who.age)]?.[String(period)];
  if (rate === undefined) return undefined;
  // TRUNC(baseAnnual/100, 3) expressed in thousandths of a baht = floor(satang / 10)
  const annual = floorDiv(toHundredths(rate) * floorDiv(input.baseAnnual, 10), 1000);
  const factor100 = toHundredths(rates.modeFactors[input.mode]);
  return { plancode, period, rate, annual, modal: applyModeFactorToFixed(annual, factor100) };
}
