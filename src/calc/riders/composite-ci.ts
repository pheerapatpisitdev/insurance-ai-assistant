import type { PayMode, PlanRates, Sex } from "../types";
import { applyModeFactorToFixed, floorDiv, toHundredths } from "../money";

export interface CompositeCIInput {
  age: number;
  sex: Sex;
  sumAssured: number;
  mode: PayMode;
}
export interface CompositeCIComponent {
  key: string;
  sumAssured: number;
  rate: number;
  annual: number; // satang
  modal: number; // satang
}
export interface CompositeCIResult {
  components: CompositeCIComponent[];
  annual: number; // satang, all components
  modal: number;
  /** true when the total is below the rider's minimum and the whole block is void */
  belowMinimum: boolean;
}

/**
 * Excel กรอกข้อมูล!AI27:AO34 — six benefit components, each a share of the CI 123 sum assured:
 *   componentSA = share × SA, capped where the workbook caps it
 *   annual      = TRUNC(rate × TRUNC(componentSA/1000, 3), 2)
 *   modal       = TRUNC(annual × factor, 2)
 * The whole rider is void when the components' annual total is below `minAnnual`.
 */
export function compositeCIPremium(rates: PlanRates, code: string, input: CompositeCIInput): CompositeCIResult | undefined {
  const rider = rates.riders[code];
  if (!rider || rider.kind !== "compositeCI") return undefined;
  const factor100 = toHundredths(rates.modeFactors[input.mode]);
  const components: CompositeCIComponent[] = [];
  for (const c of rider.components) {
    const rate = rider.rates[c.key]?.[input.sex]?.[String(input.age)];
    if (rate === undefined) continue;
    const raw = c.share * input.sumAssured;
    const componentSA = c.cap === null ? raw : Math.min(raw, c.cap);
    // TRUNC(SA/1000, 3) in thousandths of a baht per 1,000 = floor(SA) when SA is whole baht
    const annual = floorDiv(toHundredths(rate) * Math.floor(componentSA), 1000);
    components.push({ key: c.key, sumAssured: componentSA, rate, annual, modal: applyModeFactorToFixed(annual, factor100) });
  }
  if (components.length === 0) return undefined;
  const annual = components.reduce((s, c) => s + c.annual, 0);
  return {
    components,
    annual,
    modal: components.reduce((s, c) => s + c.modal, 0),
    belowMinimum: annual < rider.minAnnual * 100,
  };
}
