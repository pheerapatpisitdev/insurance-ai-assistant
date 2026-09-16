import { authorise } from "@/lib/api/key";
import { ok, refuse } from "@/lib/api/respond";
import { getPlan, listPlans } from "@/calc/plans/registry";
import { baseAgeRange, baseSumAssuredLimits } from "@/calc/rules";
import { hasExpired } from "@/calc/calendar";
import { pricedHere } from "@/lib/copilot/price";

export const dynamic = "force-dynamic";

/**
 * Everything the caller needs before asking for a premium.
 *
 * Written so that one request is enough to build a form or to brief a model: what is sold,
 * who it may be sold to, what it may be written for, and the exact strings the quote endpoint
 * expects back. A caller that has to guess a variant code will guess wrong.
 */
export async function GET(request: Request) {
  const auth = await authorise(request);
  if ("refused" in auth) return refuse(auth.refused);

  const canPrice = pricedHere();
  const plans = listPlans().map(({ code, name }) => {
    const plan = getPlan(code)!;
    const variants = plan.rates.base.variants ?? [];
    const ages = baseAgeRange(plan.rules, plan.defaultVariant ?? variants[0] ?? "", plan.rates);
    return {
      code,
      name,
      ageMin: ages.min,
      ageMax: ages.max,
      /** true where the figure a caller gives is a premium and the answer is a sum assured */
      premiumBasis: Boolean(plan.rules.base.premiumBasis),
      quotable: canPrice.has(code) || code === "LIFEPROTECT",
      packages: variants.map((variant) => {
        const sums = baseSumAssuredLimits(plan.rules, variant);
        return {
          variant,
          label: plan.variantLabels[variant] ?? variant,
          sumAssuredMin: sums.min,
          ...(sums.max === undefined ? {} : { sumAssuredMax: sums.max }),
          /** where the company writes this package for one sum and no other */
          sumAssuredFixed: sums.exact,
        };
      }),
    };
  });

  /**
   * The rate tables carry their own version and their own expiry, and this answer spans all
   * of them — so it reports the earliest expiry of the set and calls itself expired as soon
   * as any one of them is, which is the reading that cannot mislead: a caller told "not
   * expired" would take every figure in the list as current.
   */
  const tables = listPlans().map(({ code }) => getPlan(code)!.rates);
  const expiresOn = tables.map((t) => t.expiresOn).sort()[0];
  const version = [...new Set(tables.map((t) => t.version))].sort().join(", ");
  return ok(auth.caller, { version, expiresOn, expired: hasExpired(new Date(), expiresOn) }, { plans });
}
