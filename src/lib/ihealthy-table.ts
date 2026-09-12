import { getPlan } from "@/calc/plans/registry";
import { baseRate } from "@/calc/lookup";
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
  /** the note under the button, e.g. "ตั้งทุนเอง" */
  note: string;
  /** the extra multiple paid on death before the booster age (1 = pays double) */
  booster: number;
  /** the package pins the sum assured here and the form must not let it change */
  fixedSum?: number;
  saMin: number;
  /** rate per thousand, [sex][age - ageMin]; null where the workbook has no rate */
  rates: Record<Sex, (number | null)[]>;
  /** riders this package refuses to sell, so the fold can grey them without asking */
  disabledRiders: string[];
  /** riders this package forces; IHU is always among them for WLF99HX */
  requiredRiders: string[];
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
  /** below this age only สมาร์ท and บรอนซ์ sell, and only in Thailand */
  juvenileBelowAge: number;
  expired: boolean;
  expiresOn: string;
  rateVersion: string;
  minMonthly: number;
  boosterBeforeAge: number;
  modeFactors: Record<PayMode, number>;
  bases: IHealthyBase[];
  plans: IHealthyPlanOption[];
  /** Thai label → the letter the rate key uses */
  territories: Record<string, string>;
  /** Thai label → the letter the rate key uses */
  coverages: Record<string, string>;
  /** rider annual premium, [key][sex][age - ageMin]; null where the workbook has no rate */
  riderRates: Record<string, Record<Sex, (number | null)[]>>;
}

const PLAN_CODE = "LIFEPROTECT";
const RIDER = "IHU";
/** The key builder switches from the juvenile table to the standard one here. */
const JUVENILE_BELOW_AGE = 11;

const BASES: { variant: string; short: string; label: string; note: string }[] = [
  { variant: "WLF99L", short: "x 1.5", label: "ไลฟ์ โพรเทค+ x 1.5", note: "ตั้งทุนเอง" },
  { variant: "WLF99H", short: "x 2", label: "ไลฟ์ โพรเทค+ x 2", note: "ตั้งทุนเอง" },
  { variant: "WLF99HX", short: "แพ็กเกจสุขภาพ", label: "Health Ultra Package", note: "ทุน 50,000" },
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
  const ageMin = rules.riders[RIDER].ageMin;
  const ageMax = rules.riders[RIDER].ageMax;
  const ages = Array.from({ length: ageMax - ageMin + 1 }, (_, i) => ageMin + i);

  const bases: IHealthyBase[] = BASES.map((b) => {
    const pkg = rates.base.packages!.find((p) => p.code === b.variant)!;
    const rule = (rules.packages ?? []).find((p) => p.seq.includes(pkg.seq));
    return {
      ...b,
      booster: pkg.booster ?? 0,
      ...(rules.base.saExactVariants?.includes(b.variant)
        ? { fixedSum: rules.base.saMinByVariant![b.variant] }
        : {}),
      saMin: rules.base.saMinByVariant?.[b.variant] ?? rules.base.saMin,
      rates: {
        M: ages.map((age) => baseRate(rates, b.variant, "M", age) ?? null),
        F: ages.map((age) => baseRate(rates, b.variant, "F", age) ?? null),
      },
      disabledRiders: rule?.disable ?? [],
      requiredRiders: rule?.require ?? [],
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
    plans: benefits.plans.map((p) => ({
      code: p.code, name: p.name, planNo: p.planNo, annualMax: p.annualMax, deductible: p.deductible,
    })),
    territories: rider.territory!,
    coverages: rider.coverage!,
    riderRates,
  };
  return { ...cached, expired };
}
