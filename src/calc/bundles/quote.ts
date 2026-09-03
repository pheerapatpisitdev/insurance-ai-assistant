import type { Bundle, PayMode, QuoteInput, QuoteResult, Sex } from "../types";
import { quote } from "../quote";
import { getPlan } from "../plans/registry";
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

const fmt = (n: number) => n.toLocaleString("en-US");

/**
 * The tier as it reads in the picker — "แผน 3 — หลัก 200,000 / DCI 2,800,000". Sums are
 * spelled out rather than hidden behind a tier number, so the agent picks by what is covered.
 */
export function describeTier(bundle: Bundle, tierNo: number): string | undefined {
  const tier = bundle.tiers.find((t) => t.no === tierNo);
  if (!tier) return undefined;
  const parts = [`หลัก ${fmt(tier.sumAssured)}`];
  for (const r of tier.riders) parts.push(`${r.code} ${fmt(r.sumAssured ?? r.plan ?? 0)}`);
  return `${bundle.tierLabel} ${tierNo} — ${parts.join(" / ")}`;
}
