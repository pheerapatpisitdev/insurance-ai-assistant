import type { ModePremium } from "@/calc/mode-premiums";
import { applyModeFactor, toHundredths } from "@/calc/money";
import type { DeathBenefit, PayMode, Sex } from "@/calc/types";
import type { IShieldTable, IShieldTerm } from "@/lib/ishield-table";
import type { CashRow } from "@/lib/lifeprotect-quote";

/** Same order as calc/mode-premiums; repeated here so the browser does not import the engine. */
const MODES: PayMode[] = ["annual", "semi", "monthly"];

/** The ages the page quotes a surrender value at, besides the end of the contract. */
export const CASH_AGES = [60, 70, 80];

export interface Insured {
  sex: Sex;
  age: number;
  sumAssured: number;
}

export function termAt(table: IShieldTable, variant: string): IShieldTerm {
  const term = table.terms.find((t) => t.variant === variant);
  if (!term) throw new Error(`Unknown term: ${variant}`);
  return term;
}

/** Whether this payment term is sold at that age at all — iShield stops at a different age for each. */
export function termTakes(table: IShieldTable, term: IShieldTerm, age: number): boolean {
  return age >= table.ageMin && age <= term.ageMax;
}

/**
 * The base plan's premium in every payment mode, worked out the way base-premium.ts does:
 * rate per thousand, no discount, each instalment rounded down on its own in satang.
 *
 * Undefined when the plan does not issue that term at that age, which is a real answer here
 * rather than an impossible one — a customer of 56 can only buy the fifteen-year term.
 */
export function iShieldModes(
  table: IShieldTable, term: IShieldTerm, who: Insured,
): ModePremium[] | undefined {
  const rate = term.rates[who.sex][who.age - table.ageMin];
  if (rate === null || rate === undefined) return undefined;
  const rate100 = toHundredths(rate);
  return MODES.map((mode) => {
    const total = applyModeFactor(rate100, who.sumAssured, toHundredths(table.modeFactors[mode]));
    return { mode, total, belowMinimum: mode === "monthly" && total < table.minMonthly * 100 };
  });
}

/** How many years the premium is paid. iShield's terms are all a fixed count of years. */
export function payYears(term: IShieldTerm): number {
  return term.payTerm;
}

/**
 * iShield pays the sum assured on death at any age — there is no booster to step down from,
 * so the two halves of a DeathBenefit are the same figure and `beforeAge` is zero, which
 * makes every projected year read `sumFrom`.
 */
export function deathBenefitOf(sumAssured: number): DeathBenefit {
  return { beforeAge: 0, sumBefore: sumAssured, sumFrom: sumAssured, alreadyPastAge: true };
}

/** What a diagnosis pays, as the proposal states it: a quarter of the sum, or the whole of it. */
export function illnessBenefit(table: IShieldTable, sumAssured: number) {
  return {
    early: Math.round((sumAssured * table.illness.earlyPercent) / 100),
    major: Math.round((sumAssured * table.illness.majorPercent) / 100),
  };
}

/**
 * The cash value at each milestone still ahead of the insured, worth something, plus the
 * money held when cover ends. The same ROUND(factor × sum / 1000) as cash-value.ts, so the
 * figure equals the company's table.
 */
export function cashAt(term: IShieldTerm, sex: Sex, age: number, sumAssured: number, ageMin: number): CashRow[] {
  const factors = term.schedule[sex][age - ageMin];
  if (!factors) return [];
  const baht = (factor: number) => Math.round((factor * sumAssured) / 1000);
  const rows = CASH_AGES
    .filter((at) => at > age && at - age < factors.length)
    .map((at) => ({ age: at, amount: baht(factors[at - age]) }));
  rows.push({ age: age + factors.length, amount: baht(factors[factors.length - 1]) });
  return rows.filter((r) => r.amount > 0);
}
