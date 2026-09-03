import type { PayMode, PlanRates, Sex } from "./types";
import { baseRate } from "./lookup";
import { discountPerThousand } from "./discount";

export interface SaFromPremiumInput {
  variant: string;
  sex: Sex;
  age: number;
  mode: PayMode;
  /** modal premium the customer wants to pay, in baht */
  targetPremium: number;
}

/**
 * Excel Cal!G37, G40, H40, F37, F40, C38, I40:
 *   annual   = modal / factor                      (float, like Excel)
 *   SA0      = annual*1000 / rate                  → discount d1 at SA0
 *   SA1      = ROUNDUP(annual*1000 / (rate - d1))  → discount d2 at SA1
 *   d        = MAX(d1, d2)
 *   SA       = ROUNDUP(annual*1000 / (rate - d), 0)
 * Returns undefined when the age has no rate.
 */
export function sumAssuredFromPremium(rates: PlanRates, input: SaFromPremiumInput): number | undefined {
  const rate = baseRate(rates, input.variant, input.sex, input.age);
  if (rate === undefined || rate <= 0) return undefined;
  const annual = input.targetPremium / rates.modeFactors[input.mode];
  const sa0 = (annual * 1000) / rate;
  const d1 = discountPerThousand(rates, input.variant, sa0);
  const sa1 = Math.ceil((annual * 1000) / (rate - d1));
  const d2 = discountPerThousand(rates, input.variant, sa1);
  const d = Math.max(d1, d2);
  return Math.ceil((annual * 1000) / (rate - d));
}
