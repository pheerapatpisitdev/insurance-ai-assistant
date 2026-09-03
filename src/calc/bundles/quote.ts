import type { Bundle, PayMode, QuoteInput, QuoteResult, Sex } from "../types";
import { quote } from "../quote";
import { getPlan } from "../plans/registry";
import { modePremiumsFrom, type ModePremium } from "../mode-premiums";
import { baseAgeRange } from "../rules";

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
 * A bundle is sold whole: if any part of it cannot be issued, the arrangement is no longer
 * the one the agency designed, so the premium is withheld rather than quoted short. Every
 * line stays in the result, so the agent can see which part refused and why.
 *
 * A total under the monthly minimum is not that. Every line is issuable and the arrangement
 * stands — only this payment mode is out of reach — so the premium is priced as usual and
 * the warning left to say the rest. Hiding it would leave the agent guessing how far off a
 * monthly plan is, when the answer decides whether to quote it annually or move up a tier.
 */
export function quoteBundle(
  bundle: Bundle, tierNo: number, who: BundleInsured, today: Date = new Date(),
): QuoteResult | undefined {
  const input = bundleQuoteInput(bundle, tierNo, who);
  if (!input) return undefined;
  const result = quote(input, today);
  const complete = result.items.every((i) => i.eligible)
    && !result.warnings.some((w) => w.level === "error" && w.code !== "MIN_MONTHLY");
  if (complete) return result;
  return {
    ...result,
    totalAnnual: 0,
    totalModal: 0,
    warnings: [...result.warnings, {
      level: "error",
      code: "BUNDLE_INCOMPLETE",
      message: `ชุด${bundle.name} — ${describeTier(bundle, tierNo)} ใช้กับกรณีนี้ไม่ได้`,
    }],
  };
}

/**
 * The ages the bundle as a whole can be issued at: the base plan's range narrowed by every
 * rider it locks in. The age picker offers only these, so the common refusal — a rider that
 * starts later or ends earlier than the plan — never reaches the quote.
 */
export function bundleAgeRange(bundle: Bundle): { min: number; max: number } {
  const plan = getPlan(bundle.planCode);
  if (!plan) return { min: 0, max: 0 };
  const range = baseAgeRange(plan.rules, bundle.variant, plan.rates);
  let { min, max } = range;
  for (const code of new Set(bundle.tiers.flatMap((t) => t.riders.map((r) => r.code)))) {
    const rule = plan.rules.riders[code];
    if (!rule) continue;
    min = Math.max(min, rule.ageMin);
    max = Math.min(max, rule.ageMax);
  }
  return { min, max: Math.max(min, max) };
}

/**
 * The tier as it reads in the picker. Tiers are named for what the family ends up with
 * rather than numbered, so the agent and the customer pick by the same words; the sums
 * behind the name are itemised in the quote itself.
 */
export function describeTier(bundle: Bundle, tierNo: number): string | undefined {
  return bundle.tiers.find((t) => t.no === tierNo)?.name;
}

/**
 * What the tier costs in each of the three payment modes. A customer choosing a legacy
 * plan asks what it costs a year and what it costs a month in the same breath, so the
 * answer is quoted once rather than found by switching a picker back and forth.
 */
export function bundleModePremiums(
  bundle: Bundle, tierNo: number, who: Omit<BundleInsured, "mode">, today: Date = new Date(),
): ModePremium[] | undefined {
  return modePremiumsFrom((mode) => quoteBundle(bundle, tierNo, { ...who, mode }, today));
}
