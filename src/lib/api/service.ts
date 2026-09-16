import { quote } from "@/calc/quote";
import { quoteModePremiums } from "@/calc/mode-premiums";
import { getPlan, listPlans } from "@/calc/plans/registry";
import { baseAgeRange, baseSumAssuredLimits } from "@/calc/rules";
import { hasExpired } from "@/calc/calendar";
import { cardUrl, valueTablePath } from "@/lib/card-link";
import { siteUrl } from "@/lib/site-url";
import { pricedHere } from "@/lib/copilot/price";
import type { PayMode, Sex } from "@/calc/types";

/**
 * What this system answers, once, for every way of asking it.
 *
 * There are three doors onto the same two questions — REST for anything that speaks HTTP, MCP
 * for Claude, an OpenAPI description for a custom GPT — and none of them may compute
 * anything. A premium worked out twice is a premium quoted two ways, and the difference lands
 * on a customer. So the doors format; this decides.
 */

const MODES: PayMode[] = ["annual", "semi", "monthly"];
const baht = (satang: number) => Math.round(satang / 100);

export interface Envelope {
  version: string;
  expiresOn: string;
  expired: boolean;
}

/** The rate tables as one answer: the earliest expiry wins, so "current" can never overstate. */
export function tablesMeta(): Envelope {
  const tables = listPlans().map(({ code }) => getPlan(code)!.rates);
  const expiresOn = tables.map((t) => t.expiresOn).sort()[0];
  return {
    version: [...new Set(tables.map((t) => t.version))].sort().join(", "),
    expiresOn,
    expired: hasExpired(new Date(), expiresOn),
  };
}

export function planCatalogue() {
  const canPrice = pricedHere();
  return listPlans().map(({ code, name }) => {
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
}

export interface QuoteAsk {
  plan?: unknown;
  variant?: unknown;
  age?: unknown;
  sex?: unknown;
  sumAssured?: unknown;
  mode?: unknown;
}

export type QuoteOutcome =
  | { kind: "ok"; meta: Envelope; quote: ReturnType<typeof shape> }
  /** the request could not be read: a field missing, a number that is not one */
  | { kind: "unreadable"; message: string; field?: string }
  /**
   * The company will not write this. Deliberately not a premium of zero: a caller reading
   * zero as a price is how somebody advertises free insurance, and a model reading it will
   * call the refusal a bargain.
   */
  | { kind: "not_issuable"; reasons: string[] };

function shape(
  input: { planCode: string; variant: string; age: number; sex: Sex; mode: PayMode; sumAssured: number; riders: [] },
  result: ReturnType<typeof quote>,
) {
  const plan = getPlan(input.planCode)!;
  const card = {
    kind: "plan" as const, planCode: input.planCode, variant: input.variant,
    age: input.age, sex: input.sex, sumAssured: result.sumAssured,
  };
  return {
    plan: {
      code: input.planCode,
      name: plan.planLabel ?? result.meta.planName,
      variant: input.variant,
      label: plan.variantLabels[input.variant] ?? input.variant,
    },
    insured: { age: input.age, sex: input.sex },
    sumAssured: result.sumAssured,
    premium: {
      annual: baht(result.totalAnnual),
      byMode: (quoteModePremiums(input) ?? []).map((m) => ({
        mode: m.mode,
        amount: baht(m.total),
        /** the company will not take this instalment, however the arithmetic comes out */
        belowMinimum: m.belowMinimum,
      })),
    },
    ...(result.deathBenefit ? {
      deathBenefit: {
        beforeAge: result.deathBenefit.beforeAge,
        sumBefore: result.deathBenefit.sumBefore,
        sumFrom: result.deathBenefit.sumFrom,
      },
    } : {}),
    ...(result.maturityBenefit ? { maturityBenefit: result.maturityBenefit } : {}),
    /** the same pictures the bot sends a customer, ready to embed */
    images: {
      quote: cardUrl(siteUrl(""), card),
      ...(plan.coverTopUp ? { valueTable: siteUrl(valueTablePath(card)) } : {}),
    },
  };
}

/** One premium, or the reason there is not one. */
export function quotePremium(ask: QuoteAsk): QuoteOutcome {
  const code = typeof ask.plan === "string" ? ask.plan : "";
  const plan = code ? getPlan(code) : undefined;
  if (!plan) {
    return { kind: "unreadable", field: "plan", message: "ไม่รู้จักแบบประกันนี้ ดูรายการได้จาก list_plans หรือ GET /api/v1/plans" };
  }

  const variants = plan.rates.base.variants ?? [];
  const asked = typeof ask.variant === "string" ? ask.variant : undefined;
  const variant = asked ?? plan.defaultVariant ?? (variants.length === 1 ? variants[0] : undefined);
  if (!variant || !variants.includes(variant)) {
    return { kind: "unreadable", field: "variant", message: `ต้องระบุ variant ของแบบนี้: ${variants.join(", ")}` };
  }

  const age = ask.age;
  if (!Number.isInteger(age) || (age as number) < 0 || (age as number) > 99) {
    return { kind: "unreadable", field: "age", message: "age ต้องเป็นจำนวนเต็ม 0-99" };
  }
  const sex = typeof ask.sex === "string" ? ask.sex.toUpperCase() : "";
  if (sex !== "M" && sex !== "F") return { kind: "unreadable", field: "sex", message: "sex ต้องเป็น M หรือ F" };

  const sumAssured = ask.sumAssured;
  if (!Number.isFinite(sumAssured) || (sumAssured as number) <= 0) {
    return { kind: "unreadable", field: "sumAssured", message: "sumAssured ต้องเป็นจำนวนเงินที่มากกว่า 0" };
  }

  const mode = (typeof ask.mode === "string" ? ask.mode : "annual") as PayMode;
  if (!MODES.includes(mode)) return { kind: "unreadable", field: "mode", message: `mode ต้องเป็น ${MODES.join(", ")}` };

  const input = {
    planCode: code, variant, age: age as number, sex: sex as Sex, mode,
    sumAssured: sumAssured as number, riders: [] as [],
  };
  const result = quote(input);

  const blocking = result.warnings.filter((w) => w.level === "error").map((w) => w.message);
  if (blocking.length || result.totalAnnual <= 0) {
    return { kind: "not_issuable", reasons: blocking.length ? blocking : ["อยู่นอกเงื่อนไขที่แบบนี้รับประกัน"] };
  }

  return { kind: "ok", meta: result.meta, quote: shape(input, result) };
}
