import type { PayMode, PlanRates, Sex } from "./types";
import { baseRate } from "./lookup";
import { discountPerThousand } from "./discount";
import { applyModeFactor, premiumPerThousand, toHundredths } from "./money";

export interface BasePremiumInput {
  variant: string;
  sex: Sex;
  age: number;
  sumAssured: number;
  mode: PayMode;
}
export interface BasePremiumResult {
  rate: number;
  discount: number;
  /** satang */
  annual: number;
  modal: number;
}

/** Excel Cal!G13 / Cal!H13. Returns undefined when no rate exists for the age. */
export function basePremium(rates: PlanRates, input: BasePremiumInput): BasePremiumResult | undefined {
  const rate = baseRate(rates, input.variant, input.sex, input.age);
  if (rate === undefined) return undefined;
  const discount = discountPerThousand(rates, input.variant, input.sumAssured);
  const net100 = toHundredths(rate) - toHundredths(discount);
  const factor100 = toHundredths(rates.modeFactors[input.mode]);
  return {
    rate,
    discount,
    annual: premiumPerThousand(net100, input.sumAssured),
    modal: applyModeFactor(net100, input.sumAssured, factor100),
  };
}
