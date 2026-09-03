import type { Bundle, PayMode, QuoteInput, QuoteResult, Sex } from "../types";
import { quote } from "../quote";

export interface BundleInsured {
  age: number;
  sex: Sex;
  mode: PayMode;
}

/** The engine input a tier stands for. Undefined when the bundle does not sell that tier. */
export function bundleQuoteInput(bundle: Bundle, tierNo: number, who: BundleInsured): QuoteInput | undefined {
  const tier = bundle.tiers.find((t) => t.no === tierNo);
  if (!tier) return undefined;
  return {
    planCode: bundle.planCode,
    variant: bundle.variant,
    age: who.age,
    sex: who.sex,
    mode: who.mode,
    sumAssured: tier.sumAssured,
    riders: tier.riders.map((r) => ({ ...r })),
  };
}

/**
 * A bundle is sold whole: if any part of it cannot be issued — a rider the insured is too
 * old for, or a total under the monthly minimum — the arrangement is no longer the one the
 * agency designed, so the premium is withheld rather than quoted short. Every line stays in
 * the result, so the agent can see which part refused and why.
 */
export function quoteBundle(
  bundle: Bundle, tierNo: number, who: BundleInsured, today: Date = new Date(),
): QuoteResult | undefined {
  const input = bundleQuoteInput(bundle, tierNo, who);
  if (!input) return undefined;
  const result = quote(input, today);
  const complete = result.items.every((i) => i.eligible) && !result.warnings.some((w) => w.level === "error");
  if (complete) return result;
  return {
    ...result,
    totalAnnual: 0,
    totalModal: 0,
    warnings: [...result.warnings, {
      level: "error",
      code: "BUNDLE_INCOMPLETE",
      message: `ชุด${bundle.name} ${bundle.tierLabel} ${tierNo} ใช้กับกรณีนี้ไม่ได้`,
    }],
  };
}
