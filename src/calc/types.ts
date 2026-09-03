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
}
export interface PayorBenefit {
  kind: "payorBenefit";
  /** plancode → payer sex → payer age → waive period (years) → rate per 100 baht of base annual premium */
  rates: Record<string, Record<Sex, Record<string, Record<string, number>>>>;
  /** option code → display name and plancodes for insured ≤15 (parent) / ≥16 (spouse) */
  options: Record<string, { name: string; parent: string; spouse: string }>;
}
export type RiderRates = RatePerThousandByAgeClass | FixedByAgePlan | FlatRateByClass | RatePerThousandByVariantAgeSex | PayorBenefit;

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
    /** variant → premium-paying term in years (needed by payor-benefit riders) */
    payTerm?: Record<string, number>;
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
  maxMultipleOfBase: number;
  cap: number;
  message: string;
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
  };
  minMonthlyTotal: number;
  riders: Record<string, RiderRule>;
  combined: CombinedRule[];
}

// ---------- engine I/O ----------
export interface RiderInput {
  code: string;
  sumAssured?: number;
  plan?: number;
  /** PB: "FIT" | "BEYOND"; PLS: "PLS05" … */
  option?: string;
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
