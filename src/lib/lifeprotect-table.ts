import { getPlan } from "@/calc/plans/registry";
import { baseRate } from "@/calc/lookup";
import { baseAgeRange } from "@/calc/rules";
import { cashValueSchedule, maturityValue } from "@/calc/cash-value";
import type { PayMode, Sex } from "@/calc/types";

/**
 * Everything the Life Protect+ 100 page needs to price itself in the browser.
 *
 * /legacy sells one arrangement over a closed domain, so the server prices all of it. This
 * page lets the customer pick any of twenty sums in three terms, and a table of every answer
 * would run to 200 kB. The base plan has no riders, so its premium is one rate per thousand
 * times the sum, rounded the way money.ts rounds — the browser can do that itself from about
 * five hundred rates, and the plan registry (with every other plan's tables) stays on the
 * server.
 */
export interface LifeProtectTerm {
  variant: string;
  /** what the term is called in prose and in the chat message, e.g. "จ่าย 19 ปี" */
  label: string;
  /** the same term as it fits on a third of a phone screen, e.g. "ถึงอายุ 99" */
  short: string;
  /** premium-paying years, when fixed */
  payTerm?: number;
  /** the age premiums are paid to, when the term runs to an age instead */
  payToAge?: number;
  /** rate per thousand, [sex][age - ageMin]; null where the workbook has no rate */
  rates: Record<Sex, (number | null)[]>;
  /**
   * cash-value factors per thousand of sum assured, [sex][age - ageMin] → one factor per
   * policy year, from the first. Null where the company table has no schedule for that
   * issue age.
   *
   * The whole schedule rather than only the milestones, because the chart and the
   * year-by-year table need every year and the milestones are a subset of it. Sending both
   * would be one set of numbers travelling two ways, which can drift apart.
   */
  schedule: Record<Sex, (number[] | null)[]>;
}

export interface LifeProtectTable {
  planCode: string;
  ageMin: number;
  ageMax: number;
  /** true when the rate table has lapsed; then no price may be shown */
  expired: boolean;
  rateVersion: string;
  /** the smallest monthly instalment the company accepts, in baht */
  minMonthly: number;
  /** death before this age pays the extra multiple */
  boosterBeforeAge: number;
  /** the extra multiple of the sum assured (1 = pays double) */
  booster: number;
  /** the age cover runs to */
  coverToAge: number;
  modeFactors: Record<PayMode, number>;
  terms: LifeProtectTerm[];
}

const PLAN_CODE = "LIFEPROTECT";

/** The three payment terms of ไลฟ์ โพรเทค+ 100, in the order the page offers them. */
const TERMS: { variant: string; label: string; short: string }[] = [
  { variant: "WLF09H", label: "จ่าย 9 ปี", short: "จ่าย 9 ปี" },
  { variant: "WLF19H", label: "จ่าย 19 ปี", short: "จ่าย 19 ปี" },
  { variant: "WLF99H", label: "จ่ายถึงอายุ 99", short: "ถึงอายุ 99" },
];

/** Built once per process; `expired` is asked again on every call, as in legacy-table.ts. */
let cached: Omit<LifeProtectTable, "expired"> | undefined;

export function lifeProtectTable(today: Date = new Date()): LifeProtectTable {
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
  const coverToAge = maturityValue(cashValueSchedule(PLAN_CODE, TERMS[2].variant, "M", ageMin, 1000))!.age;

  const scheduleFor = (variant: string, sex: Sex, age: number): number[] | null => {
    // priced on a sum of 1,000 so each row's amount is the factor itself
    const rows = cashValueSchedule(PLAN_CODE, variant, sex, age, 1000);
    return rows.length ? rows.map((r) => r.amount) : null;
  };

  const terms: LifeProtectTerm[] = TERMS.map((t, i) => {
    const pkg = packages[i];
    return {
      variant: t.variant,
      label: t.label,
      short: t.short,
      ...(pkg.payTermToAge !== undefined ? { payToAge: pkg.payTermToAge } : { payTerm: pkg.payTerm }),
      rates: {
        M: ages.map((age) => baseRate(rates, t.variant, "M", age) ?? null),
        F: ages.map((age) => baseRate(rates, t.variant, "F", age) ?? null),
      },
      schedule: {
        M: ages.map((age) => scheduleFor(t.variant, "M", age)),
        F: ages.map((age) => scheduleFor(t.variant, "F", age)),
      },
    };
  });

  cached = {
    planCode: PLAN_CODE,
    ageMin,
    ageMax,
    rateVersion: rates.version,
    minMonthly: rules.minMonthlyTotal,
    boosterBeforeAge: rules.base.extraDeathBenefitBeforeAge!,
    booster: packages[0].booster ?? 0,
    coverToAge,
    modeFactors: rates.modeFactors,
    terms,
  };
  return { ...cached, expired };
}
