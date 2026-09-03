import type { BasePackage, PlanRates, PlanRules } from "../types";
import plbRates from "../../../data/rates/plb.json";
import plbRules from "../../../data/rules/plb.json";
import ishieldRates from "../../../data/rates/ishield.json";
import ishieldRules from "../../../data/rules/ishield.json";
import ismartRates from "../../../data/rates/ismart.json";
import ismartRules from "../../../data/rules/ismart.json";
import lifetreasureRates from "../../../data/rates/lifetreasure.json";
import lifetreasureRules from "../../../data/rules/lifetreasure.json";
import lifeprotectRates from "../../../data/rates/lifeprotect.json";
import lifeprotectRules from "../../../data/rules/lifeprotect.json";

export interface PlanBundle {
  rates: PlanRates;
  rules: PlanRules;
  /** overrides the workbook's Thai name in the plan picker */
  planLabel?: string;
  /** rider codes in display order */
  riderOrder: string[];
  /** what to quote when nobody picks a term; falls back to the first variant */
  defaultVariant?: string;
  variantLabels: Record<string, string>;
}

/** "(Non-Participating)" / "(ไม่มีเงินปันผล)" adds nothing on screen, so it is trimmed off. */
const NON_PARTICIPATING = /\s*\((?:ไม่มีเงินปันผล|Non-Participating)\)\s*/gi;
export function trimSuffix(name: string): string {
  return name.replace(NON_PARTICIPATING, "").trim();
}

/** A package's product name in English where the workbook has one, else Thai. */
export function productLabel(pkg: BasePackage): string | undefined {
  const raw = pkg.productNameEn ?? pkg.productName;
  return raw ? trimSuffix(raw) : undefined;
}

/** The three W-family plans share a rider order and take their variant labels from the package table. */
function wFamily(code: string, rates: unknown, rules: unknown, planLabel?: string, defaultVariant?: string): Record<string, PlanBundle> {
  const r = rates as PlanRates;
  const packages = r.base.packages ?? [];
  // ไลฟ์ โพรเทค+ sells the same payment terms under two products, so the term alone would
  // show up twice with identical text. Put the product in front when there is more than one.
  const products = new Set(packages.map((p) => productLabel(p)).filter(Boolean));
  return {
    [code]: {
      rates: r,
      rules: rules as PlanRules,
      planLabel,
      defaultVariant,
      riderOrder: ["PB", "WP", "AP", "ECARE", "MEX", "MEB", "DCI", "PLS", "CPR", "HIC", "IHU", "RRSS", "CI123"],
      variantLabels: Object.fromEntries(packages.map((p) => [
        p.code,
        products.size > 1 && productLabel(p) ? `${productLabel(p)} · ${p.name}` : p.name,
      ])),
    },
  };
}

const PLANS: Record<string, PlanBundle> = {
  PLB: {
    planLabel: "Protection Life (PLB)",
    rates: plbRates as unknown as PlanRates,
    rules: plbRules as unknown as PlanRules,
    riderOrder: ["AP", "ECARE", "MEB"],
    variantLabels: {
      PLB05: "Protection Life (ชำระเบี้ย 5 ปี)",
      PLB10: "Protection Life (ชำระเบี้ย 10 ปี)",
      PLB12: "Protection Life (ชำระเบี้ย 12 ปี)",
      PLB15: "Protection Life (ชำระเบี้ย 15 ปี)",
    },
  },
  ISHIELD: {
    planLabel: "iShield",
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
  ...wFamily("ISMART", ismartRates, ismartRules, "iSmart 80/6"),
  ...wFamily("LIFETREASURE", lifetreasureRates, lifetreasureRules, "Life Treasure"),
  // Life Protect+ 100 paid to age 99 is the one agents quote most, so it is the default here too.
  ...wFamily("LIFEPROTECT", lifeprotectRates, lifeprotectRules, "Life Protect+ 50 / 100", "WLF99H"),
};

/** Display order for the plan picker; anything not listed follows in definition order. */
const PLAN_ORDER = ["LIFEPROTECT", "ISMART", "LIFETREASURE", "ISHIELD", "PLB"];

export function listPlans(): { code: string; name: string }[] {
  const entries = Object.entries(PLANS).map(([code, p]) => ({ code, name: p.planLabel ?? p.rates.planName }));
  return entries.sort((a, b) => {
    const ia = PLAN_ORDER.indexOf(a.code);
    const ib = PLAN_ORDER.indexOf(b.code);
    return (ia < 0 ? PLAN_ORDER.length : ia) - (ib < 0 ? PLAN_ORDER.length : ib);
  });
}

export function getPlan(code: string): PlanBundle | undefined {
  return PLANS[code];
}
