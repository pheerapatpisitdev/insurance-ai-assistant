import type { ModePremium } from "@/calc/mode-premiums";
import { getBundle } from "@/calc/bundles/registry";
import { quoteBundle } from "@/calc/bundles/quote";
import { availablePensionAges, quotePension } from "@/calc/pension/engine";
import { IHEALTHY_OPENING } from "@/lib/ihealthy-choice";
import { baseAt, iHealthyPricing } from "@/lib/ihealthy-quote";
import { iHealthyTable } from "@/lib/ihealthy-table";
import { lifeProtectModes, termAt } from "@/lib/lifeprotect-quote";
import { lifeProtectTable } from "@/lib/lifeprotect-table";
import { plbModes, plbTakes, termAt as plbTermAt } from "@/lib/plb-quote";
import { plbTable } from "@/lib/plb-table";
import type { Sex } from "./needs";
import type { Pricer } from "./recommend";

/**
 * Premiums from the rate tables, the same arrangements the sales pages and the ตัวเลขชัดๆ
 * angle quote: PLB, or Life Protect x 2 paying to 99 or for 19 years; the Health Ultra Package (WLF99HX at its fixed
 * sum, Thailand, full coverage); the CI 123 and cancer sets; บำนาญ สมาร์ท 95 paid until it
 * starts. Satang a year; undefined where the plan will not take this person.
 */

const HEALTH_BASE = "WLF99HX";

const annualOf = (modes: ModePremium[] | undefined) => modes?.find((m) => m.mode === "annual")?.total;

function bundleAnnual(code: string, tier: number, age: number, sex: Sex, today: Date): number | undefined {
  const bundle = getBundle(code);
  if (!bundle) return undefined;
  const q = quoteBundle(bundle, tier, { age, sex, mode: "annual" }, today);
  return q && q.totalAnnual && !q.meta.expired ? q.totalAnnual : undefined;
}

export function realPricer(age: number, sex: Sex, today: Date = new Date()): Pricer {
  const lp = lifeProtectTable(today);
  const plb = plbTable(today);
  const ih = iHealthyTable(today);
  return {
    life(variant, sum) {
      if (variant.startsWith("PLB")) {
        if (plb.expired || !plbTakes(plb, age) || sum < plb.saMin) return undefined;
        return annualOf(plbModes(plb, plbTermAt(plb, variant), { sex, age, sumAssured: sum }));
      }
      if (lp.expired || age < lp.ageMin || age > lp.ageMax) return undefined;
      return annualOf(lifeProtectModes(lp, termAt(lp, variant), { sex, age, sumAssured: sum }));
    },
    health(plan) {
      if (ih.expired || age < ih.ageMin || age > ih.ageMax) return undefined;
      const base = baseAt(ih, HEALTH_BASE);
      const priced = iHealthyPricing(ih, {
        base: HEALTH_BASE, sex, age, sumAssured: base.fixedSum ?? base.saMin, plan,
        territory: IHEALTHY_OPENING.territory, coverage: IHEALTHY_OPENING.coverage,
      });
      return annualOf(priced?.total);
    },
    ci: (tier) => bundleAnnual("CI123_SET", tier, age, sex, today),
    cancer: (tier) => bundleAnnual("CANCER_SET", tier, age, sex, today),
    pension(start, by) {
      const from = availablePensionAges(age, "untilAnnuity").find((a) => a >= start);
      if (from === undefined) return undefined;
      const q = quotePension({
        age, sex, annuityAge: from, pay: "untilAnnuity", mode: "annual",
        ...("premium" in by
          ? { basis: "premium" as const, amount: by.premium / 100 }
          : { basis: "monthlyPension" as const, amount: by.monthly }),
      });
      return q.ok ? { annual: Math.round(q.quote.annualPremium * 100), monthlyPension: q.quote.monthlyPension, from } : undefined;
    },
  };
}
