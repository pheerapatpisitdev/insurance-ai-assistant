/**
 * The group tables, and the shapes they come in.
 *
 * These are the twelve kilobytes every visitor needs. The registrar's 1,099-row business-type
 * list is four times the size and is wanted by one tab, so it lives in `business-types.ts`
 * and is reached through `next/dynamic` — importing it here would undo that.
 *
 * They were generated from the standalone tool's `data.js`, which in turn came off the
 * insurer's rate sheets. Nothing here is computed; a figure that is wrong is wrong in the
 * sheet, and the fix belongs in the JSON rather than in code that adjusts it afterwards.
 */
import premiums from "../../../data/group-insurance/premiums.json";

/** Which of the two products is being quoted. They share every mechanic and no number. */
export type Product = "health" | "pa";

/** The three risk classes the insurer sorts an employer into. */
export type BizType = "biz1" | "biz2" | "biz3";

/**
 * A head-count band.
 *
 * Health sells to 10–100 people in three bands, PA to 5–2,000 in six, and the band is the
 * row of the rate table — which is why a group of 60 pays less per head than a group of 12
 * for the identical plan.
 */
export type Band = string;

/** `[biz class][band][plan index 0-5]` — the yearly premium per person, in baht. */
export type BandedTable = Record<BizType, Record<Band, number[]>>;

/** `[biz class][plan index 0-5]` — OPD alone is priced without regard to head count. */
export type FlatTable = Record<BizType, number[]>;

/** One line of the benefit table: the same wording across all six plan levels. */
export interface BenefitRow {
  /** a translation key, not the words themselves — the sheet is shown in two languages */
  key: string;
  /** the Thai label as the rate sheet writes it, kept for reference */
  label: string;
  /** six figures, already formatted with their thousands separators */
  values: string[];
}

export interface BizTypeOption {
  value: BizType;
  /** the Thai label as the rate sheet writes it; the page prints the translated one */
  label: string;
  desc?: string;
}

interface Premiums {
  healthIpdPremiums: BandedTable;
  healthOpdPremiums: FlatTable;
  healthBenefits: BenefitRow[];
  healthBizTypes: BizTypeOption[];
  healthEmployeeRanges: Band[];
  paEmployeeRanges: Band[];
  paMainPremiums: BandedTable;
  paMePremiums: BandedTable;
  paMainBenefits: BenefitRow[];
  paMeCoverLevels: string[];
  paBizTypes: BizTypeOption[];
}

export const GI = premiums as unknown as Premiums;

/** Six plan levels on every table, every product. Written once so a loop cannot disagree. */
export const PLAN_COUNT = 6;

/** The smallest and largest group each product will write. Outside it there is no quote. */
export const PRODUCT_LIMITS: Record<Product, { min: number; max: number }> = {
  health: { min: 10, max: 100 },
  pa: { min: 5, max: 2000 },
};

/** The risk-class labels, keyed to `translations.ts` because the two products word them differently. */
export const BIZ_LABEL_KEYS: Record<Product, Record<BizType, string>> = {
  health: { biz1: "biz1Label", biz2: "biz2Label", biz3: "biz3Label" },
  pa: { biz1: "paBiz1Label", biz2: "paBiz2Label", biz3: "paBiz3Label" },
};

export function bizTypesFor(product: Product): BizTypeOption[] {
  return product === "pa" ? GI.paBizTypes : GI.healthBizTypes;
}
