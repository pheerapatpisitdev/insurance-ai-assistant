import type { PayMode, Payer, PlanRates } from "../types";
import { payorRate } from "../lookup";
import { applyModeFactorToFixed, floorDiv, toHundredths } from "../money";

export interface PayorBenefitInput {
  /** option code from rates.riders[code].options, e.g. "FIT" */
  option: string;
  insuredAge: number;
  payer: Payer;
  /** base plan premium-paying term in years */
  payTerm: number;
  /** base plan annual premium in satang (Excel Cal!C14) */
  baseAnnual: number;
  mode: PayMode;
}
export interface PayorBenefitResult {
  plancode: string;
  period: number;
  rate: number;
  annual: number; // satang
  modal: number; // satang
}

const PARENT_MAX_INSURED_AGE = 15;

/**
 * Excel Cal!F10, D14, G14, H14:
 *   plancode = insured ≤15 ? parent : spouse
 *   period   = insured ≤15 ? MIN(payTerm, 25 - insuredAge) : payTerm
 *   annual   = TRUNC(rate * TRUNC(baseAnnual / 100, 3), 2)
 *   modal    = TRUNC(annual * factor, 2)          (from the rounded annual)
 */
export function payorBenefitPremium(rates: PlanRates, code: string, input: PayorBenefitInput): PayorBenefitResult | undefined {
  const rider = rates.riders[code];
  if (!rider || rider.kind !== "payorBenefit") return undefined;
  const opt = rider.options[input.option];
  if (!opt) return undefined;
  const isParent = input.insuredAge <= PARENT_MAX_INSURED_AGE;
  const plancode = isParent ? opt.parent : opt.spouse;
  const period = isParent ? Math.min(input.payTerm, 25 - input.insuredAge) : input.payTerm;
  const rate = payorRate(rates, code, plancode, input.payer.sex, input.payer.age, period);
  if (rate === undefined) return undefined;
  // TRUNC(baseAnnual/100, 3) expressed in thousandths of a baht = floor(satang / 10)
  const baseHundredsK = floorDiv(input.baseAnnual, 10);
  const annual = floorDiv(toHundredths(rate) * baseHundredsK, 1000);
  const factor100 = toHundredths(rates.modeFactors[input.mode]);
  return { plancode, period, rate, annual, modal: applyModeFactorToFixed(annual, factor100) };
}
