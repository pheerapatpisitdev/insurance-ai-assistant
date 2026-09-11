import type { ModePremium } from "@/calc/mode-premiums";
import { applyModeFactor, toHundredths } from "@/calc/money";
import type { DeathBenefit, PayMode, Sex } from "@/calc/types";
import { CASH_AGES, type LifeProtectTable, type LifeProtectTerm } from "@/lib/lifeprotect-table";

/** Same order as calc/mode-premiums; repeated here so the browser does not import the engine. */
const MODES: PayMode[] = ["annual", "semi", "monthly"];

export interface Insured {
  sex: Sex;
  age: number;
  sumAssured: number;
}

export function termAt(table: LifeProtectTable, variant: string): LifeProtectTerm {
  const term = table.terms.find((t) => t.variant === variant);
  if (!term) throw new Error(`Unknown term: ${variant}`);
  return term;
}

/**
 * The base plan's premium in every payment mode, worked out the way base-premium.ts does:
 * rate per thousand, no discount (this plan's discount table is all zeros), each instalment
 * rounded down on its own in satang. The test suite prices random arrangements both ways.
 *
 * Undefined when the workbook has no rate for the age, which the picker already prevents.
 */
export function lifeProtectModes(
  table: LifeProtectTable, term: LifeProtectTerm, who: Insured,
): ModePremium[] | undefined {
  const rate = term.rates[who.sex][who.age - table.ageMin];
  if (rate === null || rate === undefined) return undefined;
  const rate100 = toHundredths(rate);
  return MODES.map((mode) => {
    const total = applyModeFactor(rate100, who.sumAssured, toHundredths(table.modeFactors[mode]));
    return { mode, total, belowMinimum: mode === "monthly" && total < table.minMonthly * 100 };
  });
}

/** How many years the premium is paid: the term itself, or the years left to the paying age. */
export function payYears(term: LifeProtectTerm, age: number): number {
  if (term.payToAge !== undefined) return Math.max(0, term.payToAge - age);
  return term.payTerm ?? 0;
}

/** Every yearly premium added up, in satang. Honest only because this plan's premium is level. */
export function totalPaid(annualSatang: number, years: number): number {
  return annualSatang * years;
}

/** What quote.ts returns for this plan with no riders: double before the booster age, the sum after. */
export function deathBenefitOf(table: LifeProtectTable, age: number, sumAssured: number): DeathBenefit {
  const alreadyPastAge = age >= table.boosterBeforeAge;
  return {
    beforeAge: table.boosterBeforeAge,
    sumBefore: alreadyPastAge ? sumAssured : sumAssured + Math.round(sumAssured * table.booster),
    sumFrom: sumAssured,
    alreadyPastAge,
  };
}

export interface CashRow {
  age: number;
  /** baht */
  amount: number;
}

/**
 * The cash value at each milestone still ahead of the insured, worth something. The same
 * ROUND(factor × sum / 1000) as cash-value.ts, so the figure equals the company's table.
 *
 * The schedule's last value is the money held when cover ends, which the company labels
 * with the age after the final policy year rather than the age that year opened at.
 */
export function cashAt(term: LifeProtectTerm, sex: Sex, age: number, sumAssured: number, ageMin: number): CashRow[] {
  const factors = term.schedule[sex][age - ageMin];
  if (!factors) return [];
  const baht = (factor: number) => Math.round((factor * sumAssured) / 1000);
  const rows = CASH_AGES
    .filter((at) => at > age && at - age < factors.length)
    .map((at) => ({ age: at, amount: baht(factors[at - age]) }));
  rows.push({ age: age + factors.length, amount: baht(factors[factors.length - 1]) });
  return rows.filter((r) => r.amount > 0);
}
