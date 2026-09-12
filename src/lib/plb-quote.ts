import type { ModePremium } from "@/calc/mode-premiums";
import { applyModeFactor, toHundredths } from "@/calc/money";
import type { PayMode, Sex } from "@/calc/types";
import type { PlbTable, PlbTerm } from "@/lib/plb-table";

/** Same order as calc/mode-premiums; repeated here so the browser does not import the engine. */
const MODES: PayMode[] = ["annual", "semi", "monthly"];

export interface Insured {
  sex: Sex;
  age: number;
  sumAssured: number;
}

export function termAt(table: PlbTable, variant: string): PlbTerm {
  const term = table.terms.find((t) => t.variant === variant);
  if (!term) throw new Error(`Unknown term: ${variant}`);
  return term;
}

/** Whether the plan issues at that age at all. Every PLB term takes the same range. */
export function plbTakes(table: PlbTable, age: number): boolean {
  return age >= table.ageMin && age <= table.ageMax;
}

/**
 * The rate per thousand taken off at this sum assured — discount.ts's rule, restated against
 * the table the page carries rather than against a whole PlanRates: highest threshold at or
 * below the sum wins, nothing below the first.
 */
export function plbDiscount(table: PlbTable, variant: string, sumAssured: number): number {
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
export function plbModes(table: PlbTable, term: PlbTerm, who: Insured): ModePremium[] | undefined {
  const rate = term.rates[who.sex][who.age - table.ageMin];
  if (rate === null || rate === undefined) return undefined;
  const net100 = toHundredths(rate) - toHundredths(plbDiscount(table, term.variant, who.sumAssured));
  return MODES.map((mode) => {
    const total = applyModeFactor(net100, who.sumAssured, toHundredths(table.modeFactors[mode]));
    return { mode, total, belowMinimum: mode === "monthly" && total < table.minMonthly * 100 };
  });
}

/** The age the cover ends at: PLB covers for exactly as long as the premium is paid. */
export function coverEndsAt(term: PlbTerm, age: number): number {
  return age + term.years;
}

/** Every premium over the whole term, in satang. The premium never changes while it runs. */
export function totalPaid(annualSatang: number, term: PlbTerm): number {
  return annualSatang * term.years;
}

/**
 * What a million of cover costs a year at this sum, in whole baht — the figure that makes
 * the sum-assured discount visible. Rounded up, so it never understates the price.
 */
export function perMillion(annualSatang: number, sumAssured: number): number {
  return Math.ceil((annualSatang / 100) * (1_000_000 / sumAssured));
}
