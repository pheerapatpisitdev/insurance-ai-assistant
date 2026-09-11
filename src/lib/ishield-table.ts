import { getPlan } from "@/calc/plans/registry";
import { baseRate } from "@/calc/lookup";
import { baseAgeRange } from "@/calc/rules";
import { cashValueSchedule } from "@/calc/cash-value";
import type { CoverTopUp } from "@/lib/cash-projection";
import type { PayMode, Sex } from "@/calc/types";

/**
 * Everything the iShield page needs to price itself in the browser, built the way
 * lifeprotect-table.ts is and for the same reason: the plan registry, with every other
 * plan's tables behind it, stays on the server.
 *
 * The one thing iShield does that Life Protect does not is take a different oldest issue
 * age for each payment term — 52, 51, 56, 52 — so the page has to know the range per term
 * rather than one range for the plan.
 */
export interface IShieldTerm {
  variant: string;
  /** what the term is called in prose, e.g. "ชำระเบี้ย 10 ปี" */
  label: string;
  /** the same term as it fits on a quarter of a phone screen, e.g. "10 ปี" */
  short: string;
  payTerm: number;
  ageMax: number;
  /** rate per thousand, [sex][age - ageMin]; null where the plan does not issue at that age */
  rates: Record<Sex, (number | null)[]>;
  /** surrender factors per thousand, [sex][age - ageMin] → one per policy year from the first */
  schedule: Record<Sex, (number[] | null)[]>;
}

export interface IShieldTable {
  planCode: string;
  ageMin: number;
  /** the oldest age any term takes; each term states its own */
  ageMax: number;
  /** true when the rate table has lapsed; then no price may be shown */
  expired: boolean;
  rateVersion: string;
  minMonthly: number;
  saMin: number;
  saMax: number;
  /** cover runs to this age, and staying to it pays the sum assured back */
  maturityAge: number;
  /** how the death benefit is topped up above the sum assured */
  topUp: CoverTopUp;
  /** the critical illness benefit, as the company states it */
  illness: { earlyCount: number; earlyPercent: number; majorCount: number; majorPercent: number; waitingDays: number };
  modeFactors: Record<PayMode, number>;
  terms: IShieldTerm[];
}

const PLAN_CODE = "ISHIELD";

/** The four payment terms, in the order the page offers them. */
const TERMS: { variant: string; label: string; short: string }[] = [
  { variant: "WLCI05", label: "ชำระเบี้ย 5 ปี", short: "5 ปี" },
  { variant: "WLCI10", label: "ชำระเบี้ย 10 ปี", short: "10 ปี" },
  { variant: "WLCI15", label: "ชำระเบี้ย 15 ปี", short: "15 ปี" },
  { variant: "WLCI20", label: "ชำระเบี้ย 20 ปี", short: "20 ปี" },
];

/**
 * From the proposal: 20 early-stage illnesses at a quarter of the sum each, 50 major-stage
 * at up to the whole of it, and nothing at all in the first 90 days.
 */
const ILLNESS = { earlyCount: 20, earlyPercent: 25, majorCount: 50, majorPercent: 100, waitingDays: 90 };

/**
 * iShield's benefit sheet pays the greater of the sum assured and the premiums paid, and
 * does not compare the surrender value — which is not the rule Life Protect follows.
 */
const TOP_UP: CoverTopUp = { premiumPercent: 100, includeCashValue: false };

/** Built once per process; `expired` is asked again on every call, as in lifeprotect-table.ts. */
let cached: Omit<IShieldTable, "expired"> | undefined;

export function iShieldTable(today: Date = new Date()): IShieldTable {
  const plan = getPlan(PLAN_CODE)!;
  const expired = today.toISOString().slice(0, 10) > plan.rates.expiresOn;
  if (cached) return { ...cached, expired };

  const { rates, rules } = plan;
  const ranges = TERMS.map((t) => baseAgeRange(rules, t.variant, rates));
  const ageMin = Math.min(...ranges.map((r) => r.min));
  const ageMax = Math.max(...ranges.map((r) => r.max));
  const ages = Array.from({ length: ageMax - ageMin + 1 }, (_, i) => ageMin + i);

  // cover runs a year past the last row of the surrender table, as it does for every plan
  const maturityAge = ageMin + cashValueSchedule(PLAN_CODE, TERMS[0].variant, "M", ageMin, 1000).length;

  const terms: IShieldTerm[] = TERMS.map((t, i) => {
    const takes = (age: number) => age >= ranges[i].min && age <= ranges[i].max;
    const scheduleFor = (sex: Sex, age: number): number[] | null => {
      if (!takes(age)) return null;
      // priced on a sum of 1,000 so each row's amount is the factor itself
      const rows = cashValueSchedule(PLAN_CODE, t.variant, sex, age, 1000);
      return rows.length ? rows.map((r) => r.amount) : null;
    };
    return {
      variant: t.variant,
      label: t.label,
      short: t.short,
      payTerm: rates.base.payTerm![t.variant],
      ageMax: ranges[i].max,
      rates: {
        M: ages.map((age) => (takes(age) ? baseRate(rates, t.variant, "M", age) ?? null : null)),
        F: ages.map((age) => (takes(age) ? baseRate(rates, t.variant, "F", age) ?? null : null)),
      },
      schedule: {
        M: ages.map((age) => scheduleFor("M", age)),
        F: ages.map((age) => scheduleFor("F", age)),
      },
    };
  });

  cached = {
    planCode: PLAN_CODE,
    ageMin,
    ageMax,
    rateVersion: rates.version,
    minMonthly: rules.minMonthlyTotal,
    saMin: rules.base.saMin,
    saMax: rules.base.saMax!,
    maturityAge,
    topUp: TOP_UP,
    illness: ILLNESS,
    modeFactors: rates.modeFactors,
    terms,
  };
  return { ...cached, expired };
}
