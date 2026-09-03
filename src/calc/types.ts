export type Sex = "M" | "F";
export type PayMode = "annual" | "semi" | "monthly";

export const PAY_MODE_LABEL: Record<PayMode, string> = {
  annual: "รายปี",
  semi: "ราย 6 เดือน",
  monthly: "รายเดือน",
};

// ---------- data/rates/<plan>.json ----------
export interface RatePerThousandByAgeClass {
  kind: "ratePerThousandByAgeClass";
  /** age → [class1, class2, class3, class4] rate per 1,000 */
  rates: Record<string, number[]>;
}
export interface FixedByAgePlan {
  kind: "fixedByAgePlan";
  plans: number[];
  /** age → premium per plan (same order as `plans`); 0 = not offered */
  premiums: Record<string, number[]>;
}
export interface FlatRateByClass {
  kind: "flatRateByClass";
  /** [class1, class2, class3, class4] rate per 1,000, independent of age */
  rates: number[];
}
export interface RatePerThousandByVariantAgeSex {
  kind: "ratePerThousandByVariantAgeSex";
  variants: string[];
  /** variant → sex → age → rate per 1,000 */
  rates: Record<string, Record<Sex, Record<string, number>>>;
  /** rider's own sum-assured discount tiers (ascending thresholds) */
  discountThresholds: number[];
  discountValues: number[];
  /** HIC rounds half-up instead of down (Excel ROUND vs ROUNDDOWN) */
  rounding?: "round" | "roundDown";
}
export interface PayorBenefit {
  kind: "payorBenefit";
  /** plancode → payer sex → payer age → waive period (years) → rate per 100 baht of base annual premium */
  rates: Record<string, Record<Sex, Record<string, Record<string, number>>>>;
  /** option code → display name and plancodes for insured ≤15 (parent) / ≥16 (spouse) */
  options: Record<string, { name: string; parent: string; spouse: string }>;
}
/**
 * Riders whose premium is a rate per 100 baht of the base plan's annual premium.
 * `by: "payer"` keys the rate on the payer (PB); `by: "insured"` on the insured (WP).
 */
export interface PremiumBased {
  kind: "premiumBased";
  by: "payer" | "insured";
  /** plancode → sex → age → waive period (years) → rate per 100 baht of base annual premium */
  rates: Record<string, Record<Sex, Record<string, Record<string, number>>>>;
  options: Record<string, { name: string; parent: string; spouse: string }>;
}
/** Riders quoted as a fixed annual premium looked up by a composed key and the insured's age. */
export interface FixedByKeyAge {
  kind: "fixedByKeyAge";
  /** how the option the user picks becomes a rate key */
  keyBy: "plan" | "ihealthyUltra" | "rokeRaiSoShield";
  /** key → sex → age → annual premium */
  rates: Record<string, Record<Sex, Record<string, number>>>;
  /** keyBy "plan": the selectable plan amounts */
  plans?: string[];
  /** keyBy "ihealthyUltra"/"rokeRaiSoShield": plan name → number used in the key */
  planNo?: Record<string, number>;
  /** keyBy "ihealthyUltra": territory and coverage name → key letter */
  territory?: Record<string, string>;
  coverage?: Record<string, string>;
}
/** A rider made of several benefit components, each a share of one sum assured. */
export interface CompositeCI {
  kind: "compositeCI";
  /** component key → sex → age → rate per 1,000 */
  rates: Record<string, Record<Sex, Record<string, number>>>;
  components: { key: string; share: number; cap: number | null }[];
  /** the whole rider is void below this annual premium */
  minAnnual: number;
}
export type RiderRates =
  | RatePerThousandByAgeClass
  | FixedByAgePlan
  | FlatRateByClass
  | RatePerThousandByVariantAgeSex
  | PayorBenefit
  | PremiumBased
  | FixedByKeyAge
  | CompositeCI;

export interface PlanRates {
  planCode: string;
  planName: string;
  version: string;
  effectiveText: string;
  expiresOn: string; // YYYY-MM-DD
  sourceFile: string;
  modeFactors: Record<PayMode, number>;
  base: {
    variants: string[];
    /** variant → premium-paying term in years (needed by premium-based riders) */
    payTerm?: Record<string, number>;
    /** variant → the age premiums are paid to, when the term is "to age N" rather than fixed */
    payTermToAge?: Record<string, number>;
    /** the W family sells packages: each variant carries its own issue-age range and label */
    packages?: BasePackage[];
    /** variant → sex → age → rate per 1,000 */
    rates: Record<string, Record<Sex, Record<string, number>>>;
  };
  discount: {
    thresholds: number[];
    /** variant → discount per 1,000 for each threshold (same order) */
    byVariant: Record<string, number[]>;
  };
  riders: Record<string, RiderRates>;
}

export interface BasePackage {
  code: string;
  plancode: string;
  name: string;
  ageMin: number;
  ageMax: number;
  seq: number;
  payTerm: number;
  rateKey: string;
  /** set when the term runs to a fixed age instead of a fixed number of years */
  payTermToAge?: number;
  /** ไลฟ์ โพรเทค+ sells the same terms under two products; the booster tells them apart */
  booster?: number;
  productName?: string;
}

// ---------- data/rules/<plan>.json ----------
export interface RiderRule {
  name: string;
  ageMin: number;
  ageMax: number;
  /** for sum-assured riders */
  saMin?: number;
  saMaxMultipleOfBase?: number;
  saMaxCap?: number;
  /** for plan riders: highest plan allowed per age band (ascending ageMax) */
  planMaxByAge?: { ageMax: number; planMax: number }[];
  /** stricter max for young insureds (e.g. AP under 16) */
  juvenile?: { ageMax: number; saMaxMultipleOfBase: number; saMaxCap: number };
  /** payor-benefit riders: allowed payer age */
  payer?: { ageMin: number; ageMax: number };
}
export interface CombinedRule {
  code: string;
  riders: string[];
  /** omit for a plain cap with no relation to the base sum assured */
  maxMultipleOfBase?: number;
  cap: number;
  message: string;
}
/** Two riders that cannot be bought together. */
export interface ExclusiveRule {
  code: string;
  riders: string[];
  message: string;
}
/** A rider that may only be bought alongside another. */
export interface RequiresRule {
  rider: string;
  needs: string[];
  message: string;
}
/** A rider that may not be bought alongside certain others. */
export interface ConflictRule {
  rider: string;
  with: string[];
  message: string;
}
/** What a package (base variant) does to the rider list. */
export interface PackageRule {
  /** package sequence numbers this applies to */
  seq: number[];
  /** riders the package does not sell */
  disable?: string[];
  /** riders the package requires; the quote is void without them */
  require?: string[];
  disabledMessage?: string;
  requiredMessage?: string;
}
export interface PlanRules {
  planCode: string;
  base: {
    ageMin: number;
    ageMax: number;
    saMin: number;
    saMax?: number;
    /** per-variant override of ageMax */
    ageMaxByVariant?: Record<string, number>;
    /** plan supports "premium → sum assured" input */
    premiumBasis?: boolean;
    /** sum assured becomes 0 (nothing is covered, total 0) when the base plan cannot be issued */
    saZeroWhenIneligible?: boolean;
    /** per-package minimum, overriding saMin */
    saMinByVariant?: Record<string, number>;
    /** packages that accept exactly their minimum and nothing else */
    saExactVariants?: string[];
  };
  minMonthlyTotal: number;
  riders: Record<string, RiderRule>;
  combined: CombinedRule[];
  exclusive?: ExclusiveRule[];
  requires?: RequiresRule[];
  conflicts?: ConflictRule[];
  packages?: PackageRule[];
}

// ---------- engine I/O ----------
export interface RiderInput {
  code: string;
  sumAssured?: number;
  plan?: number;
  /** PB/WP: "FIT" | "BEYOND"; PLS: "PLS05" …; MEX: "1200" …; iHealthy Ultra: "PLATINUM" … */
  option?: string;
  /** iHealthy Ultra only */
  territory?: string;
  coverage?: string;
}
export interface Payer {
  age: number;
  sex: Sex;
}
export interface QuoteInput {
  planCode: string;
  variant: string;
  age: number;
  sex: Sex;
  mode: PayMode;
  /** used when basis is "sumAssured" (default) */
  sumAssured: number;
  /** "premium": derive sum assured from targetPremium (modal, baht) */
  basis?: "sumAssured" | "premium";
  targetPremium?: number;
  payer?: Payer;
  riders: RiderInput[];
}

export interface QuoteItem {
  code: string;
  name: string;
  /** sum assured, or plan amount for plan riders */
  amount: number;
  /** optional replacement for the formatted amount (e.g. payer description) */
  amountLabel?: string;
  /** satang; 0 when not eligible/excluded */
  annual: number;
  modal: number;
  eligible: boolean;
  message?: string;
}
export interface Warning {
  level: "error" | "warn";
  code: string;
  message: string;
}
export interface Availability {
  code: string;
  name: string;
  eligible: boolean;
  ageRange: string;
  saMin?: number;
  saMax?: number;
  plans?: number[];
  options?: { code: string; name: string }[];
  needsPayer?: boolean;
  reason?: string;
}
export interface QuoteResult {
  items: QuoteItem[];
  /** satang */
  totalAnnual: number;
  totalModal: number;
  warnings: Warning[];
  availability: Availability[];
  /** sum assured actually used (derived when basis is "premium") */
  sumAssured: number;
  meta: { planName: string; version: string; expiresOn: string; expired: boolean };
}
