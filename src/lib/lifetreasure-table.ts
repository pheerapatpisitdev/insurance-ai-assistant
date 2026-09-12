import { getPlan } from "@/calc/plans/registry";
import { baseRate } from "@/calc/lookup";
import { baseAgeRange } from "@/calc/rules";
import { cashValueSchedule, maturityValue } from "@/calc/cash-value";
import type { CoverTopUp, PayMode, Sex } from "@/calc/types";

/**
 * Everything the ไลฟ์เทรเชอร์ page needs to price itself in the browser, built the way
 * lifeprotect-table.ts is: the plan registry, with every other plan's rates and surrender
 * tables behind it, stays on the server.
 *
 * Two differences from Life Protect. There is no booster — the sum assured is what the
 * family receives at any age, topped up only by the policy's own floors — and the rate is
 * discounted by the sum assured, so the discount table has to travel with the rates. Every
 * policy this plan issues clears the top threshold (the smallest sum it sells is ten
 * million), but the table is carried whole rather than folded into one number, so a change
 * to the thresholds cannot silently leave the page quoting an old discount.
 */
export interface LifeTreasureTerm {
  variant: string;
  /** what the term is called in prose and in the chat message, e.g. "ชำระเบี้ย 12 ปี" */
  label: string;
  /** the same term as it fits on a third of a phone screen, e.g. "12 ปี" */
  short: string;
  /** premium-paying years */
  payTerm: number;
  /** rate per thousand, [sex][age - ageMin]; null where the workbook has no rate */
  rates: Record<Sex, (number | null)[]>;
  /**
   * cash-value factors per thousand of sum assured, [sex][age - ageMin] → one factor per
   * policy year from the first, null where the company table has no schedule for that age.
   */
  schedule: Record<Sex, (number[] | null)[]>;
}

export interface LifeTreasureTable {
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
   * The largest sum the page offers. The plan's own rules name no ceiling, so this is the
   * page's choice rather than the company's — anyone who wants more is a conversation.
   */
  saMax: number;
  /** the age cover runs to */
  coverToAge: number;
  /** how the death benefit is topped up above the sum assured */
  topUp: CoverTopUp;
  /** rate per thousand taken off at each sum assured, ascending thresholds */
  discount: { thresholds: number[]; byVariant: Record<string, number[]> };
  modeFactors: Record<PayMode, number>;
  terms: LifeTreasureTerm[];
}

const PLAN_CODE = "LIFETREASURE";

/** The largest sum the slider offers; see `saMax`. */
const PAGE_SA_MAX = 50_000_000;

/** The three payment terms, in the order the page offers them. */
const TERMS: { variant: string; label: string; short: string }[] = [
  { variant: "H99F06A", label: "ชำระเบี้ย 6 ปี", short: "6 ปี" },
  { variant: "H99F12A", label: "ชำระเบี้ย 12 ปี", short: "12 ปี" },
  { variant: "H99F18A", label: "ชำระเบี้ย 18 ปี", short: "18 ปี" },
];

/** Built once per process; `expired` is asked again on every call, as in lifeprotect-table.ts. */
let cached: Omit<LifeTreasureTable, "expired"> | undefined;

export function lifeTreasureTable(today: Date = new Date()): LifeTreasureTable {
  const plan = getPlan(PLAN_CODE)!;
  const expired = today.toISOString().slice(0, 10) > plan.rates.expiresOn;
  if (cached) return { ...cached, expired };

  const { rates, rules } = plan;
  const packages = TERMS.map((t) => rates.base.packages!.find((p) => p.code === t.variant)!);
  // every term issues at the same ages; the widest would be wrong for the narrowest
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
    discount: rates.discount,
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
