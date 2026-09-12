import type { ModePremium } from "@/calc/mode-premiums";
import { applyModeFactor, toHundredths } from "@/calc/money";
import type { DeathBenefit, PayMode, Sex } from "@/calc/types";
import type { CashRow } from "@/lib/lifeprotect-quote";
import type { LifeTreasureTable, LifeTreasureTerm } from "@/lib/lifetreasure-table";

/** Same order as calc/mode-premiums; repeated here so the browser does not import the engine. */
const MODES: PayMode[] = ["annual", "semi", "monthly"];

/**
 * The ages the page quotes a surrender value at, besides the end of the contract. Later than
 * the other pages' because this plan is bought later in life and held for the estate: a
 * buyer of fifty has nothing to learn from a figure at sixty.
 */
export const CASH_AGES = [60, 70, 80, 90];

export interface Insured {
  sex: Sex;
  age: number;
  sumAssured: number;
}

export function termAt(table: LifeTreasureTable, variant: string): LifeTreasureTerm {
  const term = table.terms.find((t) => t.variant === variant);
  if (!term) throw new Error(`Unknown term: ${variant}`);
  return term;
}

/**
 * The rate per thousand taken off at this sum assured — discount.ts's rule, restated against
 * the table the page carries rather than against a whole PlanRates: highest threshold at or
 * below the sum wins, nothing below the first.
 */
export function lifeTreasureDiscount(table: LifeTreasureTable, variant: string, sumAssured: number): number {
  const values = table.discount.byVariant[variant];
  if (!values) return 0;
  let result = 0;
  table.discount.thresholds.forEach((threshold, i) => {
    if (sumAssured >= threshold) result = values[i];
  });
  return result;
}

/**
 * The base plan's premium in every payment mode, worked out the way base-premium.ts does:
 * the discount comes off the rate per thousand first, then the sum and the mode factor, each
 * instalment rounded down on its own in satang.
 *
 * Undefined when the workbook has no rate for the age, which the picker already prevents.
 */
export function lifeTreasureModes(
  table: LifeTreasureTable, term: LifeTreasureTerm, who: Insured,
): ModePremium[] | undefined {
  const rate = term.rates[who.sex][who.age - table.ageMin];
  if (rate === null || rate === undefined) return undefined;
  const net100 = toHundredths(rate) - toHundredths(lifeTreasureDiscount(table, term.variant, who.sumAssured));
  return MODES.map((mode) => {
    const total = applyModeFactor(net100, who.sumAssured, toHundredths(table.modeFactors[mode]));
    return { mode, total, belowMinimum: mode === "monthly" && total < table.minMonthly * 100 };
  });
}

/** How many years the premium is paid. Every term here is a fixed count of years. */
export function payYears(term: LifeTreasureTerm): number {
  return term.payTerm;
}

/** Every yearly premium added up, in satang. Honest only because this plan's premium is level. */
export function totalPaid(annualSatang: number, term: LifeTreasureTerm): number {
  return annualSatang * term.payTerm;
}

/**
 * ไลฟ์เทรเชอร์ pays the sum assured on death at any age — there is no booster to step down
 * from, so the two halves of a DeathBenefit are the same figure and `beforeAge` is zero.
 * What lifts the cover above that sum is the policy's own floors, which cashProjection
 * applies from `topUp`: the surrender value, and 101% of the premiums paid so far.
 */
export function deathBenefitOf(sumAssured: number): DeathBenefit {
  return { beforeAge: 0, sumBefore: sumAssured, sumFrom: sumAssured, alreadyPastAge: true };
}

/**
 * The cash value at each milestone still ahead of the insured, worth something, plus the
 * money held when cover ends. The same ROUND(factor × sum / 1000) as cash-value.ts, so the
 * figure equals the company's table.
 */
export function cashAt(
  term: LifeTreasureTerm, sex: Sex, age: number, sumAssured: number, ageMin: number,
): CashRow[] {
  const factors = term.schedule[sex][age - ageMin];
  if (!factors) return [];
  const baht = (factor: number) => Math.round((factor * sumAssured) / 1000);
  const rows = CASH_AGES
    .filter((at) => at > age && at - age < factors.length)
    .map((at) => ({ age: at, amount: baht(factors[at - age]) }));
  rows.push({ age: age + factors.length, amount: baht(factors[factors.length - 1]) });
  return rows.filter((r) => r.amount > 0);
}

/**
 * What the family receives for every baht of premium, when the premiums are all paid — the
 * figure an estate buyer is actually comparing against every other way of leaving money.
 *
 * Null below one: past a certain age the premiums add up to more than the sum assured, and
 * the plan is then bought for the certainty rather than the multiple. The page has to be
 * able to say nothing rather than say a number that flatters.
 */
export function leverage(sumAssured: number, totalSatang: number): number | null {
  const times = (sumAssured * 100) / totalSatang;
  return times >= 1 ? times : null;
}
