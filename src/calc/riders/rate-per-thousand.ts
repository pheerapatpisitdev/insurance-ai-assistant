import type { PayMode, PlanRates } from "../types";
import { riderRateByAgeClass } from "../lookup";
import { applyModeFactor, premiumPerThousand, toHundredths } from "../money";

export interface RatePerThousandInput {
  age: number;
  sumAssured: number;
  mode: PayMode;
}
export interface RatePerThousandResult {
  rate: number;
  annual: number; // satang
  modal: number; // satang
}

const OCCUPATION_CLASS = 1 as const; // fixed for this app (no UI for class)

/** Excel Cal!G17/H17 (AP) and G18/H18 (ECARE). */
export function ratePerThousandRiderPremium(
  rates: PlanRates,
  code: string,
  input: RatePerThousandInput,
): RatePerThousandResult | undefined {
  const rate = riderRateByAgeClass(rates, code, input.age, OCCUPATION_CLASS);
  if (rate === undefined) return undefined;
  const rate100 = toHundredths(rate);
  const factor100 = toHundredths(rates.modeFactors[input.mode]);
  return {
    rate,
    annual: premiumPerThousand(rate100, input.sumAssured),
    modal: applyModeFactor(rate100, input.sumAssured, factor100),
  };
}
