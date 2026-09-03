import type { PlanRates, PlanRules } from "../types";
import plbRates from "../../../data/rates/plb.json";
import plbRules from "../../../data/rules/plb.json";

export interface PlanBundle {
  rates: PlanRates;
  rules: PlanRules;
  /** rider codes in display order */
  riderOrder: string[];
  variantLabels: Record<string, string>;
}

const PLANS: Record<string, PlanBundle> = {
  PLB: {
    rates: plbRates as unknown as PlanRates,
    rules: plbRules as unknown as PlanRules,
    riderOrder: ["AP", "ECARE", "MEB"],
    variantLabels: {
      PLB05: "PLB05 (ชำระเบี้ย 5 ปี)",
      PLB10: "PLB10 (ชำระเบี้ย 10 ปี)",
      PLB12: "PLB12 (ชำระเบี้ย 12 ปี)",
      PLB15: "PLB15 (ชำระเบี้ย 15 ปี)",
    },
  },
};

export function listPlans(): { code: string; name: string }[] {
  return Object.entries(PLANS).map(([code, p]) => ({ code, name: p.rates.planName }));
}

export function getPlan(code: string): PlanBundle | undefined {
  return PLANS[code];
}
