import { hasExpired } from "@/calc/calendar";
import { getPlan } from "@/calc/plans/registry";
import { baseRate } from "@/calc/lookup";
import { baseAgeRange } from "@/calc/rules";
import { cashValueSchedule, maturityValue } from "@/calc/cash-value";
import type { CoverTopUp, PayMode, Sex } from "@/calc/types";

/**
 * Everything the อีซี่ โพรเทค 6 page needs to price itself in the browser, built the way
 * lifetreasure-table.ts is: the rates, the surrender factors and the registry behind them
 * stay on the server, and what crosses to the phone is one plan's numbers.
 *
 * This plan sells a single arrangement — six years of premium, cover to 99 — so where
 * ไลฟ์เทรเชอร์ carries three terms this carries one. It is still a list, because the shape
 * of the page should not have to change the day the company adds a second term.
 */
export interface EasyProtectTerm {
  variant: string;
  /** what the term is called in prose and in the chat message, e.g. "ชำระเบี้ย 6 ปี" */
  label: string;
  /** the same term as it fits on a button, e.g. "6 ปี" */
  short: string;
  /** premium-paying years */
  payTerm: number;
  /** rate per thousand, [sex][age - ageMin]; null where the table has no rate */
  rates: Record<Sex, (number | null)[]>;
  /**
   * cash-value factors per thousand of sum assured, [sex][age - ageMin] → one factor per
   * policy year from the first, null where the company table has no schedule for that age.
   */
  schedule: Record<Sex, (number[] | null)[]>;
}

export interface EasyProtectTable {
  planCode: string;
  ageMin: number;
  ageMax: number;
  /** true when the rate table has lapsed; then no price may be shown */
  expired: boolean;
  rateVersion: string;
  /** the smallest monthly instalment the company accepts, in baht */
  minMonthly: number;
  /** the smallest sum assured the plan issues */
  saMin: number;
  /**
   * The largest sum the page offers. The plan's rules name no ceiling, so this is the page's
   * choice rather than the company's — above it is a conversation, not a slider.
   */
  saMax: number;
  /** the age cover runs to */
  coverToAge: number;
  /** how the death benefit is topped up above the sum assured */
  topUp: CoverTopUp;
  modeFactors: Record<PayMode, number>;
  terms: EasyProtectTerm[];
}

const PLAN_CODE = "EASYPROTECT";

/** The largest sum the slider offers; see `saMax`. */
const PAGE_SA_MAX = 10_000_000;

const TERMS: { variant: string; label: string; short: string }[] = [
  { variant: "W99F06A", label: "ชำระเบี้ย 6 ปี", short: "6 ปี" },
];

/** Built once per process; `expired` is asked again on every call, as in lifetreasure-table.ts. */
let cached: Omit<EasyProtectTable, "expired"> | undefined;

export function easyProtectTable(today: Date = new Date()): EasyProtectTable {
  const plan = getPlan(PLAN_CODE)!;
  const expired = hasExpired(today, plan.rates.expiresOn);
  if (cached) return { ...cached, expired };

  const { rates, rules } = plan;
  const packages = TERMS.map((t) => rates.base.packages!.find((p) => p.code === t.variant)!);
  const ageMin = Math.max(...packages.map((p) => baseAgeRange(rules, p.code, rates).min));
  const ageMax = Math.min(...packages.map((p) => baseAgeRange(rules, p.code, rates).max));
  const ages = Array.from({ length: ageMax - ageMin + 1 }, (_, i) => ageMin + i);
  // the company's cash-value table stops the year before cover ends
  const coverToAge = maturityValue(cashValueSchedule(PLAN_CODE, TERMS[0].variant, "M", ageMin, 1000))!.age;

  const scheduleFor = (variant: string, sex: Sex, age: number): number[] | null => {
    // priced on a sum of 1,000 so each row's amount is the factor itself
    const rows = cashValueSchedule(PLAN_CODE, variant, sex, age, 1000);
    return rows.length ? rows.map((r) => r.amount) : null;
  };

  cached = {
    planCode: PLAN_CODE,
    ageMin,
    ageMax,
    rateVersion: rates.version,
    minMonthly: rules.minMonthlyTotal,
    saMin: rules.base.saMin,
    saMax: PAGE_SA_MAX,
    coverToAge,
    topUp: plan.coverTopUp!,
    modeFactors: rates.modeFactors,
    terms: TERMS.map((t, i) => ({
      variant: t.variant,
      label: t.label,
      short: t.short,
      payTerm: packages[i].payTerm!,
      rates: {
        M: ages.map((age) => baseRate(rates, t.variant, "M", age) ?? null),
        F: ages.map((age) => baseRate(rates, t.variant, "F", age) ?? null),
      },
      schedule: {
        M: ages.map((age) => scheduleFor(t.variant, "M", age)),
        F: ages.map((age) => scheduleFor(t.variant, "F", age)),
      },
    })),
  };
  return { ...cached, expired };
}
