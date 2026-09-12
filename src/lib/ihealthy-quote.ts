import type { ModePremium } from "@/calc/mode-premiums";
import { applyModeFactor, applyModeFactorToFixed, toHundredths } from "@/calc/money";
import type { DeathBenefit, PayMode, Sex } from "@/calc/types";
import type { IHealthyPlanOption, IHealthyTable } from "@/lib/ihealthy-table";

/** Same order as calc/mode-premiums; repeated here so the browser does not import the engine. */
const MODES: PayMode[] = ["annual", "semi", "monthly"];

export interface IHealthyChoice {
  base: string;
  sex: Sex;
  age: number;
  sumAssured: number;
  plan: string;
  territory: string;
  coverage: string;
}

export interface IHealthyPricing {
  /** the base plan on its own, per mode */
  base: ModePremium[];
  /** the health rider on its own, per mode */
  rider: ModePremium[];
  /** what the customer actually pays, and the mode that falls under the company's floor */
  total: ModePremium[];
}

/**
 * The key the workbook composes at `'iHealthy Ultra Rate'!D7`:
 * "MHP" + coverage letter + plan number + (age < 11 ? "J" : "S") + territory letter.
 */
export function ihuKey(
  table: IHealthyTable, plan: string, age: number, territory: string, coverage: string,
): string | undefined {
  const option = table.plans.find((p) => p.code === plan);
  const c = table.coverages[coverage];
  const t = table.territories[territory];
  if (!option || c === undefined || t === undefined) return undefined;
  return `MHP${c}${option.planNo}${age < table.juvenileBelowAge ? "J" : "S"}${t}`;
}

function hasRate(table: IHealthyTable, key: string, age: number): boolean {
  const rates = table.riderRates[key];
  if (!rates) return false;
  const i = age - table.ageMin;
  return rates.M[i] !== null || rates.F[i] !== null;
}

/**
 * The plans this age can buy, which the rate table answers on its own: there is no
 * `MHP3J`, so a child is never offered ซิลเวอร์. Matching `กรอกข้อมูล!M29` without
 * repeating its conditions.
 */
export function plansFor(table: IHealthyTable, age: number): IHealthyPlanOption[] {
  return table.plans.filter((p) => {
    const key = ihuKey(table, p.code, age, "ประเทศไทย", "Full Coverage");
    return key !== undefined && hasRate(table, key, age);
  });
}

/** The territories this plan sells in at this age, again read off the rate table. */
export function territoriesFor(table: IHealthyTable, plan: string, age: number): string[] {
  return Object.keys(table.territories).filter((t) => {
    const key = ihuKey(table, plan, age, t, "Full Coverage");
    return key !== undefined && hasRate(table, key, age);
  });
}

/** Outside Thailand the company sells full cover only. */
export function coveragesFor(table: IHealthyTable, territory: string): string[] {
  return territory === "ประเทศไทย" ? Object.keys(table.coverages) : ["Full Coverage"];
}

function baseModes(table: IHealthyTable, choice: IHealthyChoice): ModePremium[] | undefined {
  const base = table.bases.find((b) => b.variant === choice.base);
  const rate = base?.rates[choice.sex][choice.age - table.ageMin];
  if (rate === null || rate === undefined) return undefined;
  const rate100 = toHundredths(rate);
  return MODES.map((mode) => ({
    mode,
    total: applyModeFactor(rate100, choice.sumAssured, toHundredths(table.modeFactors[mode])),
    belowMinimum: false,
  }));
}

function riderModes(table: IHealthyTable, choice: IHealthyChoice): ModePremium[] | undefined {
  const key = ihuKey(table, choice.plan, choice.age, choice.territory, choice.coverage);
  const annual = key ? table.riderRates[key]?.[choice.sex][choice.age - table.ageMin] : null;
  if (annual === null || annual === undefined) return undefined;
  const annual100 = toHundredths(annual);
  return MODES.map((mode) => ({
    mode,
    total: applyModeFactorToFixed(annual100, toHundredths(table.modeFactors[mode])),
    belowMinimum: false,
  }));
}

/**
 * The base plan and the health rider priced in every mode, the way base-premium.ts and
 * riders/fixed-by-key-age.ts do it: the base is a rate per thousand rounded down in satang,
 * the rider is a fixed annual premium scaled by the mode factor and rounded down. The
 * company's monthly floor is judged on the total, as `checkMonthlyMinimum` judges it.
 *
 * Undefined when the arrangement has no price, which the pickers already prevent.
 */
export function iHealthyPricing(table: IHealthyTable, choice: IHealthyChoice): IHealthyPricing | undefined {
  const base = baseModes(table, choice);
  const rider = riderModes(table, choice);
  if (!base || !rider) return undefined;
  const total = MODES.map((mode, i) => {
    const sum = base[i].total + rider[i].total;
    return { mode, total: sum, belowMinimum: mode === "monthly" && sum < table.minMonthly * 100 };
  });
  return { base, rider, total };
}

/** What quote.ts returns for this base with no death-paying rider attached. */
export function deathBenefitOf(table: IHealthyTable, base: string, age: number, sumAssured: number): DeathBenefit {
  const booster = table.bases.find((b) => b.variant === base)?.booster ?? 0;
  const alreadyPastAge = age >= table.boosterBeforeAge;
  return {
    beforeAge: table.boosterBeforeAge,
    sumBefore: alreadyPastAge ? sumAssured : sumAssured + Math.round(sumAssured * booster),
    sumFrom: sumAssured,
    alreadyPastAge,
  };
}
