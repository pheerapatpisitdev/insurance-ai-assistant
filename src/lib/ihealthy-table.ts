import { getPlan } from "@/calc/plans/registry";
import { baseRate } from "@/calc/lookup";
import { baseAgeRange, baseSumAssuredLimits } from "@/calc/rules";
import { JUVENILE_BELOW_AGE } from "@/calc/riders/fixed-by-key-age";
import type { PayMode, Sex } from "@/calc/types";
import benefits from "../../data/riders/ihealthy-ultra.json";

/**
 * Everything the health page needs to price itself in the browser.
 *
 * The registry holds five plans and about 2.7 MB of rate tables, and the two payor riders
 * alone are 416 kB of it. A customer reading this page picks a base plan and a health plan
 * and nothing else, so only those rates travel: three columns of base rate and the 28 keyed
 * tables of the rider. The engine, and every other rider, stays on the server behind the
 * action in `src/app/ihealthy/actions.ts`.
 */
export interface IHealthyBase {
  variant: string;
  /** what the button says, e.g. "x 2" */
  short: string;
  /** what prose calls it, e.g. "ไลฟ์ โพรเทค+ x 2" */
  label: string;
  /**
   * the note under the button, e.g. "ตั้งทุนเอง". Absent where `fixedSum` pins the sum: the
   * page says that figure from the field itself, so the subtitle cannot drift from it.
   */
  note?: string;
  /** the extra multiple paid on death before the booster age (1 = pays double) */
  booster: number;
  /** the package pins the sum assured here and the form must not let it change */
  fixedSum?: number;
  saMin: number;
  /** rate per thousand, [sex][age - ageMin]; null where this base is not issued at that age */
  rates: Record<Sex, (number | null)[]>;
}

export interface IHealthyPlanOption {
  code: string;
  name: string;
  planNo: number;
  annualMax: number;
  deductible: number;
}

export interface IHealthyTable {
  planCode: string;
  ageMin: number;
  ageMax: number;
  /** the age the key builder switches from the juvenile table to the standard one at */
  juvenileBelowAge: number;
  expired: boolean;
  expiresOn: string;
  rateVersion: string;
  minMonthly: number;
  boosterBeforeAge: number;
  modeFactors: Record<PayMode, number>;
  bases: IHealthyBase[];
  plans: IHealthyPlanOption[];
  /** Thai label → the letter the rate key uses; ประเทศไทย is the empty one */
  territories: Record<string, string>;
  /** Thai label → the letter the rate key uses; Full Coverage is the empty one */
  coverages: Record<string, string>;
  /**
   * rider annual premium, [key][sex][age - ageMin].
   *
   * Two different absences: a key the company does not sell at all is undefined — only 28 of
   * the 108 keys the letters can spell exist, so a miss is the ordinary case and the caller
   * must expect it — while null inside a key's array is an age that key is not sold at.
   */
  riderRates: Record<string, Record<Sex, (number | null)[]> | undefined>;
}

const PLAN_CODE = "LIFEPROTECT";
const RIDER = "IHU";

const BASES: { variant: string; short: string; label: string; note?: string }[] = [
  { variant: "WLF99L", short: "x 1.5", label: "ไลฟ์ โพรเทค+ x 1.5", note: "ตั้งทุนเอง" },
  { variant: "WLF99H", short: "x 2", label: "ไลฟ์ โพรเทค+ x 2", note: "ตั้งทุนเอง" },
  { variant: "WLF99HX", short: "แพ็กเกจสุขภาพ", label: "Health Ultra Package" },
];

/** Built once per process; `expired` is asked again on every call, as in lifeprotect-table.ts. */
let cached: Omit<IHealthyTable, "expired"> | undefined;

export function iHealthyTable(today: Date = new Date()): IHealthyTable {
  const plan = getPlan(PLAN_CODE)!;
  const expired = today.toISOString().slice(0, 10) > plan.rates.expiresOn;
  if (cached) return { ...cached, expired };

  const { rates, rules } = plan;
  const rider = rates.riders[RIDER];
  if (rider.kind !== "fixedByKeyAge") throw new Error("IHU is not a keyed rider any more");
  // the three tables every rate key is spelled from; a keyed rider may ship without them
  const { planNo, territory, coverage } = rider;
  if (!planNo || !territory || !coverage) {
    throw new Error("the IHU rate table no longer says how its keys are composed");
  }

  // the base plan issues from birth, but nothing on this page sells without the rider
  const { ageMin, ageMax } = rules.riders[RIDER];
  const ages = Array.from({ length: ageMax - ageMin + 1 }, (_, i) => ageMin + i);

  const bases: IHealthyBase[] = BASES.map((b) => {
    const pkg = rates.base.packages?.find((p) => p.code === b.variant);
    if (!pkg) throw new Error(`the rate table no longer sells ${b.variant}`);
    const range = baseAgeRange(rules, b.variant, rates);
    const sum = baseSumAssuredLimits(rules, b.variant);
    // the workbook prices WLF99HX from age 0, which its package does not sell
    const rateAt = (sex: Sex, age: number) =>
      age >= range.min && age <= range.max ? baseRate(rates, b.variant, sex, age) ?? null : null;
    return {
      ...b,
      booster: pkg.booster ?? 0,
      ...(sum.exact ? { fixedSum: sum.min } : {}),
      saMin: sum.min,
      rates: { M: ages.map((age) => rateAt("M", age)), F: ages.map((age) => rateAt("F", age)) },
    };
  });

  const riderRates: IHealthyTable["riderRates"] = {};
  for (const [key, bySex] of Object.entries(rider.rates)) {
    riderRates[key] = {
      M: ages.map((age) => bySex.M?.[String(age)] ?? null),
      F: ages.map((age) => bySex.F?.[String(age)] ?? null),
    };
  }

  cached = {
    planCode: PLAN_CODE,
    ageMin,
    ageMax,
    juvenileBelowAge: JUVENILE_BELOW_AGE,
    expiresOn: rates.expiresOn,
    rateVersion: rates.version,
    minMonthly: rules.minMonthlyTotal,
    boosterBeforeAge: rules.base.extraDeathBenefitBeforeAge!,
    modeFactors: rates.modeFactors,
    bases,
    // the number comes from the rate table that keys on it, so the two files join on one map
    plans: benefits.plans.map((p) => {
      const no = planNo[p.code];
      if (no === undefined) throw new Error(`the IHU rate table does not number ${p.code}`);
      return { code: p.code, name: p.name, planNo: no, annualMax: p.annualMax, deductible: p.deductible };
    }),
    territories: territory,
    coverages: coverage,
    riderRates,
  };
  return { ...cached, expired };
}
