import { JUVENILE_BELOW_AGE } from "@/calc/riders/fixed-by-key-age";
import raw from "../../data/riders/ihealthy-ultra.json";

/** A row that names a part of the contract and has no figures of its own. */
export interface BenefitHeading {
  heading: string;
}

export interface BenefitRow {
  /** the หมวด number, or null for a sub-row like หมวดย่อยที่ 2.1 */
  no: number | null;
  title: string;
  /** true for the rows that live on the endorsement rather than the rider itself */
  endorsement: boolean;
  /** plan code → what the sheet says, verbatim */
  adult: Record<string, string>;
  /** the สมาร์ท and บรอนซ์ wording for a child, only where it differs */
  child?: Record<string, string>;
}

export type BenefitEntry = BenefitHeading | BenefitRow;

export interface IHealthyTerms {
  renewalToAge: number;
  waitingDays: number;
  specialWaitingDays: number;
  specialWaitingDiseases: string[];
  noClaimDiscountPercent: number;
  outOfTerritoryDays: number;
  renewalCopay: string;
  preExisting: string;
  exclusions: string;
  premiumChanges: string;
  outOfTerritory: string;
  noClaimDiscount: string;
  sharedLimit: string;
  participationNote: string;
}

export interface IHealthyFacts {
  name: string;
  plans: { code: string; name: string; planNo: number; annualMax: number; deductible: number }[];
  copayPercent: number;
  rows: BenefitEntry[];
  terms: IHealthyTerms;
  disclaimer: string;
  /** below this age the child columns apply; the same boundary the rate key uses */
  juvenileBelowAge: number;
}

export function isHeading(entry: BenefitEntry): entry is BenefitHeading {
  return "heading" in entry;
}

/**
 * What this plan pays on this row for someone of this age. Only the wording changes here —
 * whether the company sells that plan at that age is the rate table's answer, and the table
 * component asks `plansFor` for it rather than keeping a second list of who may buy what.
 */
export function benefitValue(
  row: BenefitRow, plan: string, age: number, juvenileBelowAge: number,
): string | undefined {
  if (age < juvenileBelowAge && row.child && plan in row.child) return row.child[plan];
  return row.adult[plan];
}

/**
 * No cast: the return type is what checks the extract script's output against the shapes
 * above, so a heading that loses its text or a row that loses its adult column fails the
 * build rather than the page. The spread is shallow — `rows` and every object inside it are
 * the JSON's own, shared by every caller, so sort or reverse a copy, never `facts.rows`.
 */
export function iHealthyFacts(): IHealthyFacts {
  return { ...raw, juvenileBelowAge: JUVENILE_BELOW_AGE };
}
