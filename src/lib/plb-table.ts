import { getPlan } from "@/calc/plans/registry";
import { baseRate } from "@/calc/lookup";
import { baseAgeRange } from "@/calc/rules";
import type { PayMode, Sex } from "@/calc/types";

/**
 * Everything the PLB page needs to price itself in the browser, built the way
 * ishield-table.ts is and for the same reason: the plan registry, with every other plan's
 * tables behind it, stays on the server.
 *
 * Two things PLB does that iShield does not. Its four terms share one issue-age range
 * (20–59), so there is nothing to work out per term. And its rate is discounted by the sum
 * assured — up to a baht per thousand off a rate of about six — so the discount table has to
 * travel with the rates or the page would quote a premium the company does not charge.
 */
export interface PlbTerm {
  variant: string;
  /** what the term is called in prose, e.g. "ชำระเบี้ย 12 ปี" */
  label: string;
  /** the same term as it fits on a quarter of a phone screen, e.g. "12 ปี" */
  short: string;
  /** how many years the premium is paid — and, for this plan, how many years it covers */
  years: number;
  /** rate per thousand, [sex][age - ageMin]; null where the plan does not issue at that age */
  rates: Record<Sex, (number | null)[]>;
}

export interface PlbTable {
  planCode: string;
  ageMin: number;
  ageMax: number;
  /** true when the rate table has lapsed; then no price may be shown */
  expired: boolean;
  rateVersion: string;
  minMonthly: number;
  saMin: number;
  /**
   * The largest sum the page offers. The plan's own rules name no ceiling, so this is the
   * page's choice rather than the company's — anyone who wants more is a conversation, which
   * is what the page is for.
   */
  saMax: number;
  /** rate per thousand taken off at each sum assured, ascending thresholds */
  discount: { thresholds: number[]; byVariant: Record<string, number[]> };
  modeFactors: Record<PayMode, number>;
  terms: PlbTerm[];
}

const PLAN_CODE = "PLB";

/** The largest sum the slider offers; see `saMax`. */
const PAGE_SA_MAX = 5_000_000;

/**
 * The four terms, in the order the page offers them. PLB's cover runs exactly as long as the
 * premium is paid — `สรุปผลประโยชน์!D36` and `E36` read the same number off the same
 * variant code — so one figure serves as both.
 */
const TERMS: { variant: string; years: number }[] = [
  { variant: "PLB05", years: 5 },
  { variant: "PLB10", years: 10 },
  { variant: "PLB12", years: 12 },
  { variant: "PLB15", years: 15 },
];

/** Built once per process; `expired` is asked again on every call, as in ishield-table.ts. */
let cached: Omit<PlbTable, "expired"> | undefined;

export function plbTable(today: Date = new Date()): PlbTable {
  const plan = getPlan(PLAN_CODE)!;
  const expired = today.toISOString().slice(0, 10) > plan.rates.expiresOn;
  if (cached) return { ...cached, expired };

  const { rates, rules } = plan;
  const range = baseAgeRange(rules, TERMS[0].variant, rates);
  const ages = Array.from({ length: range.max - range.min + 1 }, (_, i) => range.min + i);

  cached = {
    planCode: PLAN_CODE,
    ageMin: range.min,
    ageMax: range.max,
    rateVersion: rates.version,
    minMonthly: rules.minMonthlyTotal,
    saMin: rules.base.saMin,
    saMax: PAGE_SA_MAX,
    discount: rates.discount,
    modeFactors: rates.modeFactors,
    terms: TERMS.map((t) => ({
      variant: t.variant,
      label: `ชำระเบี้ย ${t.years} ปี`,
      short: `${t.years} ปี`,
      years: t.years,
      rates: {
        M: ages.map((age) => baseRate(rates, t.variant, "M", age) ?? null),
        F: ages.map((age) => baseRate(rates, t.variant, "F", age) ?? null),
      },
    })),
  };
  return { ...cached, expired };
}
