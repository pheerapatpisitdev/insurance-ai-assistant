import { getPlan, listPlans } from "@/calc/plans/registry";

/**
 * Package codes are the company's filing system, not names a customer would recognise. They
 * are kept out of the prompts, but a model that has seen one in a document can still repeat
 * it, so every answer a model writes passes through here on its way out.
 *
 * A plan's own public name is left alone: Protection Life is sold as "(PLB)", so that PLB is
 * the product's name in the customer's hands, not a code leaking out of the rate tables.
 */
const REPLACEMENTS: [RegExp, string][] = (() => {
  const pairs: [string, string][] = [];
  for (const { code, name } of listPlans()) {
    const plan = getPlan(code)!;
    const label = plan.planLabel ?? name;
    for (const [variant, variantLabel] of Object.entries(plan.variantLabels)) {
      if (!variantLabel.includes(variant)) pairs.push([variant, variantLabel]);
    }
    if (!label.includes(code)) pairs.push([code, label]);
  }
  // longest first, so "WLF99HX#7" is handled before the "WLF99H" hiding inside it
  pairs.sort((a, b) => b[0].length - a[0].length);
  return pairs.map(([code, label]) => [new RegExp(escapeRegExp(code), "g"), label]);
})();

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** A parenthesised "(รหัส …)" aside has nothing in it for a customer. */
const CODE_ASIDE = /\s*\(\s*รหัส[^()]*\)/g;

/** Swaps any internal code for the name the plan picker shows. */
export function replaceCodes(text: string): string {
  let out = text.replace(CODE_ASIDE, "");
  for (const [re, label] of REPLACEMENTS) out = out.replace(re, label);
  return out;
}

/** True when a code slipped through — used by the tests to keep this honest. */
export function containsInternalCode(text: string): boolean {
  return REPLACEMENTS.some(([re]) => {
    re.lastIndex = 0;
    return re.test(text);
  });
}
