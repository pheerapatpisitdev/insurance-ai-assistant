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
export type RiderRates = RatePerThousandByAgeClass | FixedByAgePlan;

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
  base: { ageMin: number; ageMax: number; saMin: number };
  minMonthlyTotal: number;
  riders: Record<string, RiderRule>;
  combined: CombinedRule[];
}

// ---------- engine I/O ----------
export interface RiderInput {
  code: string;
  sumAssured?: number;
  plan?: number;
}
export interface QuoteInput {
  planCode: string;
  variant: string;
  age: number;
  sex: Sex;
  mode: PayMode;
  sumAssured: number;
  riders: RiderInput[];
}

export interface QuoteItem {
  code: string;
  name: string;
  /** sum assured, or plan amount for plan riders */
  amount: number;
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
  reason?: string;
}
export interface QuoteResult {
  items: QuoteItem[];
  /** satang */
  totalAnnual: number;
  totalModal: number;
  warnings: Warning[];
  availability: Availability[];
  meta: { planName: string; version: string; expiresOn: string; expired: boolean };
}
