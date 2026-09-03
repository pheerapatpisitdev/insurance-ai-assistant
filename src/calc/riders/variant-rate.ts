import type { PayMode, PlanRates, Sex } from "../types";
import { variantRate } from "../lookup";
import { applyModeFactor, premiumPerThousand, toHundredths } from "../money";

export interface VariantRiderInput {
  variant: string;
  sex: Sex;
  age: number;
  sumAssured: number;
  mode: PayMode;
}
export interface VariantRiderResult {
  rate: number;
  discount: number;
  annual: number; // satang
  modal: number; // satang
}

/** Excel Cal!D21/F21/G21/H21 (PLS): rate by variant+age+sex, minus the rider's own SA discount. */
export function variantRiderPremium(rates: PlanRates, code: string, input: VariantRiderInput): VariantRiderResult | undefined {
  const rider = rates.riders[code];
  if (!rider || rider.kind !== "ratePerThousandByVariantAgeSex") return undefined;
  const rate = variantRate(rates, code, input.variant, input.sex, input.age);
  if (rate === undefined) return undefined;
  let discount = 0;
  rider.discountThresholds.forEach((t, i) => {
    if (input.sumAssured >= t) discount = rider.discountValues[i];
  });
  const net100 = toHundredths(rate) - toHundredths(discount);
  const factor100 = toHundredths(rates.modeFactors[input.mode]);
  return {
    rate,
    discount,
    annual: premiumPerThousand(net100, input.sumAssured),
    modal: applyModeFactor(net100, input.sumAssured, factor100),
  };
}
