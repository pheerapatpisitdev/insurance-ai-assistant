import { getBundle } from "@/calc/bundles/registry";
import { bundleAgeRange, bundleModePremiums, quoteBundle } from "@/calc/bundles/quote";
import { MODES } from "@/calc/mode-premiums";
import type { Sex } from "@/calc/types";
import { CANCER_DAILY_RIDER, CANCER_RIDER } from "@/lib/cancer-benefits";

/**
 * Every price the cancer page can show, worked out on the server — the same reasoning as
 * `ci123-table.ts`: a closed domain of 66 ages, two sexes and eight tiers, so the engine
 * never has to reach the browser.
 *
 * Unlike CI 123 the base is not the same in every tier. CPR may be at most five times the
 * base, so the base rises with it, and each tier carries its own base sum and death benefit.
 */
export const CANCER_BUNDLE = "CANCER_SET";

export interface CancerTier {
  /** the CPR sum assured — the lump sum a cancer can pay */
  cpr: number;
  /** HIC's daily amount while in hospital */
  hic: number;
  /** the Life Protect+ 100 sum assured this tier is built on */
  baseSum: number;
  /** the base contract's death benefit: before the booster age, and from it */
  death: { beforeAge: number; sumBefore: number; sumFrom: number };
}

export interface CancerTable {
  bundleCode: string;
  ageMin: number;
  ageMax: number;
  tiers: CancerTier[];
  /** true when the rate table behind these figures has lapsed; then no price may be shown */
  expired: boolean;
  rateVersion: string;
  /** the smallest monthly instalment the company will accept, in baht */
  minMonthlyTotal: number;
  /**
   * [tier - 1][age - ageMin] = [annual, semi, monthly, monthlyUnderMinimum], in satang, for
   * the whole arrangement. Null where it cannot be priced.
   */
  premiums: Record<Sex, (readonly number[] | null)[][]>;
  /** [tier - 1][age - ageMin] = [base, CPR, HIC] annual premiums in satang, by sex */
  parts: Record<Sex, (readonly number[] | null)[][]>;
}

const BUNDLE = getBundle(CANCER_BUNDLE)!;
const RANGE = bundleAgeRange(BUNDLE);

const riderSum = (tier: (typeof BUNDLE.tiers)[number], code: string) =>
  tier.riders.find((r) => r.code === code)!.sumAssured!;

/** Built once per server process; `expired` is asked again on every call, as in legacy-table. */
let cached: Omit<CancerTable, "expired"> | undefined;

export function cancerTable(today: Date = new Date()): CancerTable {
  const first = quoteBundle(BUNDLE, 1, { age: RANGE.min, sex: "M", mode: "annual" }, today)!;
  const expired = first.meta.expired;
  if (cached) return { ...cached, expired };
  const ages = Array.from({ length: RANGE.max - RANGE.min + 1 }, (_, i) => RANGE.min + i);

  const priceRow = (tier: number, sex: Sex, age: number): readonly number[] | null => {
    const modes = bundleModePremiums(BUNDLE, tier, { age, sex }, today);
    if (!modes) return null;
    const by = (m: (typeof modes)[number]["mode"]) => modes.find((x) => x.mode === m);
    const [annual, semi, monthly] = MODES.map(by);
    if (!annual || !semi || !monthly) return null;
    return [annual.total, semi.total, monthly.total, monthly.belowMinimum ? 1 : 0];
  };
  const partsRow = (tier: number, sex: Sex, age: number): readonly number[] | null => {
    const q = quoteBundle(BUNDLE, tier, { age, sex, mode: "annual" }, today);
    if (!q || q.totalAnnual === 0) return null;
    const annual = (code: string) => q.items.find((i) => i.code === code && i.eligible)?.annual;
    const row = [annual(BUNDLE.variant), annual(CANCER_RIDER), annual(CANCER_DAILY_RIDER)];
    return row.every((n) => n !== undefined) ? (row as number[]) : null;
  };
  const forSex = <T,>(sex: Sex, f: (tier: number, sex: Sex, age: number) => T) =>
    BUNDLE.tiers.map((t) => ages.map((age) => f(t.no, sex, age)));

  cached = {
    bundleCode: BUNDLE.code,
    ageMin: RANGE.min,
    ageMax: RANGE.max,
    tiers: BUNDLE.tiers.map((t) => {
      // quoted at the youngest age, where the booster is still ahead of everybody
      const d = quoteBundle(BUNDLE, t.no, { age: RANGE.min, sex: "M", mode: "annual" }, today)!.deathBenefit!;
      return {
        cpr: riderSum(t, CANCER_RIDER), hic: riderSum(t, CANCER_DAILY_RIDER), baseSum: t.sumAssured,
        death: { beforeAge: d.beforeAge, sumBefore: d.sumBefore, sumFrom: d.sumFrom },
      };
    }),
    rateVersion: first.meta.version,
    minMonthlyTotal: first.meta.minMonthlyTotal,
    premiums: { M: forSex("M", priceRow), F: forSex("F", priceRow) },
    parts: { M: forSex("M", partsRow), F: forSex("F", partsRow) },
  };
  return { ...cached, expired };
}
