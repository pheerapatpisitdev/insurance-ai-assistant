import type { ModePremium } from "@/calc/mode-premiums";
import { applyModeFactor, toHundredths } from "@/calc/money";
import type { DeathBenefit, PayMode, Sex } from "@/calc/types";
import type { CashRow } from "@/lib/lifeprotect-quote";
import type { EasyProtectTable, EasyProtectTerm } from "@/lib/easyprotect-table";

/** Same order as calc/mode-premiums; repeated here so the browser does not import the engine. */
const MODES: PayMode[] = ["annual", "semi", "monthly"];

/**
 * The ages the page quotes a surrender value at, besides the end of the contract. Earlier
 * than the ไลฟ์เทรเชอร์ page's because this plan is bought young — the premium is paid off
 * in six years, and the question a thirty-year-old asks is what the policy is worth by the
 * time the children are grown, not at ninety.
 */
export const CASH_AGES = [50, 60, 70, 80];

export interface Insured {
  sex: Sex;
  age: number;
  sumAssured: number;
}

export function termAt(table: EasyProtectTable, variant: string): EasyProtectTerm {
  const term = table.terms.find((t) => t.variant === variant);
  if (!term) throw new Error(`Unknown term: ${variant}`);
  return term;
}

/**
 * The base plan's premium in every payment mode, worked out the way base-premium.ts does:
 * the sum and the mode factor applied to the rate per thousand, each instalment rounded down
 * on its own in satang. อีซี่ โพรเทค 6 has no sum-assured discount, so the rate the table
 * carries is the rate that is charged.
 *
 * Undefined when the table has no rate for the age, which the picker already prevents.
 */
export function easyProtectModes(
  table: EasyProtectTable, term: EasyProtectTerm, who: Insured,
): ModePremium[] | undefined {
  const rate = term.rates[who.sex][who.age - table.ageMin];
  if (rate === null || rate === undefined) return undefined;
  const rate100 = toHundredths(rate);
  return MODES.map((mode) => {
    const total = applyModeFactor(rate100, who.sumAssured, toHundredths(table.modeFactors[mode]));
    return { mode, total, belowMinimum: mode === "monthly" && total < table.minMonthly * 100 };
  });
}

/** How many years the premium is paid. */
export function payYears(term: EasyProtectTerm): number {
  return term.payTerm;
}

/** Every yearly premium added up, in satang. Honest only because this plan's premium is level. */
export function totalPaid(annualSatang: number, term: EasyProtectTerm): number {
  return annualSatang * term.payTerm;
}

/**
 * อีซี่ โพรเทค 6 pays the sum assured on death at any age — there is no booster to step down
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
  term: EasyProtectTerm, sex: Sex, age: number, sumAssured: number, ageMin: number,
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
 * What the family receives for every baht of premium, when all six years are paid — the
 * figure this plan is actually bought on, because six years of premium is a number a buyer
 * can hold in their head and compare against the cover it buys for the rest of their life.
 *
 * Null below one: past a certain age the premiums add up to more than the sum assured, and
 * the plan is then bought for the certainty rather than the multiple. The page has to be
 * able to say nothing rather than say a number that flatters.
 */
export function leverage(sumAssured: number, totalSatang: number): number | null {
  const times = (sumAssured * 100) / totalSatang;
  return times >= 1 ? times : null;
}
