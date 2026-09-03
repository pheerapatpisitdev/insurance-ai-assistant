import type { PlanRates, PlanRules } from "../types";
import plbRates from "../../../data/rates/plb.json";
import plbRules from "../../../data/rules/plb.json";
import ishieldRates from "../../../data/rates/ishield.json";
import ishieldRules from "../../../data/rules/ishield.json";

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
  ISHIELD: {
    rates: ishieldRates as unknown as PlanRates,
    rules: ishieldRules as unknown as PlanRules,
    riderOrder: ["PB", "AP", "ECARE", "MEB", "PLS"],
    variantLabels: {
      WLCI05: "iShield 05 (ชำระเบี้ย 5 ปี)",
      WLCI10: "iShield 10 (ชำระเบี้ย 10 ปี)",
      WLCI15: "iShield 15 (ชำระเบี้ย 15 ปี)",
      WLCI20: "iShield 20 (ชำระเบี้ย 20 ปี)",
    },
  },
};

export function listPlans(): { code: string; name: string }[] {
  return Object.entries(PLANS).map(([code, p]) => ({ code, name: p.rates.planName }));
}

export function getPlan(code: string): PlanBundle | undefined {
  return PLANS[code];
}
