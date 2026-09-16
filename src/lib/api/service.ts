import { quote } from "@/calc/quote";
import { quoteModePremiums } from "@/calc/mode-premiums";
import { getPlan, listPlans } from "@/calc/plans/registry";
import { baseAgeRange, baseSumAssuredLimits, packageSeq, requiredRiders } from "@/calc/rules";
import { hasExpired } from "@/calc/calendar";
import { cardUrl, valueTablePath } from "@/lib/card-link";
import { valueTableCard } from "@/lib/quote-card";
import { siteUrl } from "@/lib/site-url";
import { pricedHere } from "@/lib/copilot/price";
import { iHealthyTable } from "@/lib/ihealthy-table";
import { iHealthyPricing, plansFor, territoriesFor } from "@/lib/ihealthy-quote";
import { IHEALTHY_OPENING, type IHealthyInitial } from "@/lib/ihealthy-choice";
import { arrangementFor } from "@/lib/assistant/ihealthy/quote";
import { cardPath, cardQuery, queryFrom } from "@/lib/ihealthy-link";
import { planLabel } from "@/lib/ihealthy-facts";
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

/**
 * Whether `quotePremium` can actually price this package.
 *
 * Asked of the package's own rules rather than assumed, because the catalogue was wrong in
 * both directions and each way cost something. iShield was marked unquotable and prices
 * perfectly well, so a model reading the list refused a quotation it could have given. The
 * two Health packages were offered as if they were ordinary ones, and every attempt came
 * back "กรุณาเลือกแผน iHealthy Ultra" — at which point the model stopped asking the system
 * and invented an explanation for the customer instead.
 *
 * A package with a mandatory rider is the second case in general: this function sends no
 * riders, so the arrangement can never be completed here. Those go through `quoteHealth`.
 */
function quotableHere(plan: NonNullable<ReturnType<typeof getPlan>>, variant: string): boolean {
  return requiredRiders(plan.rules, packageSeq(variant, plan.rates)).length === 0;
}

export function planCatalogue() {
  const canPrice = pricedHere();
  return listPlans().map(({ code, name }) => {
    const plan = getPlan(code)!;
    const variants = plan.rates.base.variants ?? [];
    const ages = baseAgeRange(plan.rules, plan.defaultVariant ?? variants[0] ?? "", plan.rates);
    const packages = variants.map((variant) => {
      const sums = baseSumAssuredLimits(plan.rules, variant);
      const quotable = quotableHere(plan, variant);
      return {
        variant,
        label: plan.variantLabels[variant] ?? variant,
        sumAssuredMin: sums.min,
        ...(sums.max === undefined ? {} : { sumAssuredMax: sums.max }),
        /** where the company writes this package for one sum and no other */
        sumAssuredFixed: sums.exact,
        quotable,
        // said in the payload the model reads, because a bare false is a dead end and a dead
        // end is where it starts guessing
        ...(quotable ? {} : {
          useInstead: "quote_health",
          note: "แพ็กเกจสุขภาพ ต้องใช้ quote_health เพราะต้องเลือกแผนความคุ้มครองก่อน ห้ามคิดจากที่นี่",
        }),
      };
    });
    return {
      code,
      name,
      ageMin: ages.min,
      ageMax: ages.max,
      /** true where the figure a caller gives is a premium and the answer is a sum assured */
      premiumBasis: Boolean(plan.rules.base.premiumBasis),
      quotable: (canPrice.has(code) || code === "LIFEPROTECT" || code === "ISHIELD")
        && packages.some((p) => p.quotable),
      packages,
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
    /**
     * The same two pictures the bot sends a customer, ready to embed.
     *
     * Both, every time one can be drawn. The card says what it costs and the table says what
     * it is worth in the year the customer is thinking about, and a price with no table is
     * the half of the answer that sells nothing.
     *
     * The guard is `valueTableCard`, which is what the sales page and the Messenger bot ask.
     * This used to ask `plan.coverTopUp` — the rule for a surrender schedule, not the rule
     * for a table — so PLB and iShield, which draw a cover table every day, reported through
     * this door that they had none.
     */
    images: {
      quote: cardUrl(siteUrl(""), card),
      ...(valueTableCard(card) ? { valueTable: siteUrl(valueTablePath(card)) } : {}),
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

  /**
   * Turned away here rather than at the engine, which would answer "กรุณาเลือกแผน iHealthy
   * Ultra" — true, and useless to a caller with no field to put a plan in. A refusal that
   * does not say where to go is where a model stops asking and starts telling the customer
   * something it made up.
   */
  if (!quotableHere(plan, variant)) {
    return {
      kind: "unreadable",
      field: "variant",
      message:
        `${variant} เป็นแพ็กเกจสุขภาพ คิดเบี้ยที่นี่ไม่ได้ เพราะต้องเลือกแผนความคุ้มครองก่อน `
        + "ให้ใช้ quote_health (หรือ POST /api/v1/quote/health) แทน",
    };
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

/* ── health cover ────────────────────────────────────────────────────────────────────────
 *
 * Health is not shaped like the others and cannot be squeezed into `quotePremium`.
 *
 * iHealthy Ultra is a rider: it cannot be issued on its own, so quoting it is always quoting
 * a life contract as well, plus the daily-cash rider the agency attaches as standard. That is
 * why `quote_premium` on the Health Ultra Package came back "กรุณาเลือกแผน iHealthy Ultra" —
 * the arrangement needs a plan, a territory and a way of sharing the bill, and that function
 * has nowhere to put them.
 *
 * What a caller chooses here is the plan and, at most, the territory. Everything else is the
 * packaged arrangement the owner settled on — the cheapest vehicle at its pinned fifty
 * thousand, full cover, the standard daily cash — which is what the sales page opens on and
 * what the Messenger bot quotes. Offering the rest through an API would be offering a
 * different product from the one the agency sells.
 */

export interface HealthCatalogue {
  ageMin: number;
  ageMax: number;
  plans: { code: string; name: string; annualMax: number; deductible: number }[];
  territories: string[];
  version: string;
  expiresOn: string;
  expired: boolean;
}

/**
 * The plans on sale, and — where an age is given — only the ones that age can buy.
 *
 * Asked of the rate table rather than of a list kept here: there is no ซิลเวอร์ for a child
 * because the company writes no rate for one, and a catalogue that offered it would be
 * offering something `quoteHealth` would then refuse.
 */
export function healthCatalogue(age?: number): HealthCatalogue {
  const table = iHealthyTable();
  const at = age ?? IHEALTHY_OPENING.age;
  const plans = plansFor(table, at).map((p) => ({
    code: p.code, name: planLabel(p.code), annualMax: p.annualMax, deductible: p.deductible,
  }));
  return {
    ageMin: table.ageMin,
    ageMax: table.ageMax,
    plans,
    territories: Object.keys(table.territories),
    version: table.rateVersion,
    expiresOn: table.expiresOn,
    expired: table.expired,
  };
}

export interface HealthAsk {
  age?: unknown;
  sex?: unknown;
  plan?: unknown;
  territory?: unknown;
}

export type HealthOutcome =
  | { kind: "ok"; meta: Envelope; quote: ReturnType<typeof shapeHealth> }
  | { kind: "unreadable"; message: string; field?: string }
  | { kind: "not_issuable"; reasons: string[] };

function shapeHealth(
  table: ReturnType<typeof iHealthyTable>,
  v: IHealthyInitial,
  plan: { code: string; annualMax: number; deductible: number },
  priced: NonNullable<ReturnType<typeof iHealthyPricing>>,
) {
  const at = (parts: { mode: PayMode; total: number }[]) =>
    baht(parts.find((m) => m.mode === "annual")!.total);
  return {
    plan: { code: plan.code, name: planLabel(plan.code), annualMax: plan.annualMax, deductible: plan.deductible },
    insured: { age: v.age, sex: v.sex },
    /**
     * The arrangement spelled out, because the number is not a health premium on its own.
     * A caller told only the total will present it as the price of health cover, and the
     * customer will ask later why they are also insured for fifty thousand of life.
     */
    arrangement: {
      baseLabel: table.bases.find((b) => b.variant === v.base)?.label ?? v.base,
      baseVariant: v.base,
      sumAssured: v.sumAssured,
      territory: v.territory,
      coverage: v.coverage,
      standardRider: priced.standard?.label,
    },
    premium: {
      annual: at(priced.total),
      byMode: priced.total.map((m) => ({
        mode: m.mode, amount: baht(m.total), belowMinimum: m.belowMinimum,
      })),
    },
    /** what the yearly total is made of, in the same baht the total is in */
    partsOfPremium: {
      health: at(priced.rider),
      lifeBase: at(priced.base),
      ...(priced.standard ? { dailyCash: at(priced.standard.premiums) } : {}),
    },
    /**
     * Both pictures, as with every other quotation.
     *
     * Health has no surrender value, so the second one is not a value table but the plans
     * side by side — which is the picture the Messenger bot already sends, and the answer to
     * the question that follows every health price: and what do the others cost.
     */
    images: {
      quote: siteUrl(cardPath(table, v)),
      valueTable: siteUrl(`/api/ihealthy-card/table?${cardQuery(table, v)}&fit=phone`),
    },
    page: siteUrl(`/ihealthy-ultra?${queryFrom(table, v)}`),
  };
}

/** One health premium for the packaged arrangement, or the reason there is not one. */
export function quoteHealth(ask: HealthAsk): HealthOutcome {
  const table = iHealthyTable();

  const age = ask.age;
  if (!Number.isInteger(age) || (age as number) < 0 || (age as number) > 99) {
    return { kind: "unreadable", field: "age", message: "age ต้องเป็นจำนวนเต็ม 0-99" };
  }
  const sex = typeof ask.sex === "string" ? ask.sex.toUpperCase() : "";
  if (sex !== "M" && sex !== "F") return { kind: "unreadable", field: "sex", message: "sex ต้องเป็น M หรือ F" };

  if ((age as number) < table.ageMin || (age as number) > table.ageMax) {
    return {
      kind: "not_issuable",
      reasons: [`ไอเฮลท์ตี้ อัลตร้า รับประกันอายุ ${table.ageMin} - ${table.ageMax} ปี`],
    };
  }

  // The plans are read at this age, so an unknown plan and a plan this age cannot buy come
  // back as the same answer with the same list — which is the list the caller needs either way.
  const sellable = plansFor(table, age as number);
  const chosen = sellable.find((p) => p.code === ask.plan);
  if (!chosen) {
    return {
      kind: "unreadable",
      field: "plan",
      message: `แผนที่อายุ ${age} ปีซื้อได้: ${sellable.map((p) => p.code).join(", ")}`,
    };
  }

  const territories = territoriesFor(table, chosen.code, age as number);
  let territory = IHEALTHY_OPENING.territory;
  if (ask.territory !== undefined) {
    if (typeof ask.territory !== "string" || !territories.includes(ask.territory)) {
      return {
        kind: "unreadable",
        field: "territory",
        message: `แผน ${planLabel(chosen.code)} ขายในพื้นที่: ${territories.join(", ")}`,
      };
    }
    territory = ask.territory;
  }

  const v = arrangementFor({ age: age as number, sex: sex as Sex, plan: chosen.code, territory });
  const priced = iHealthyPricing(table, {
    base: v.base, sex: sex as Sex, age: age as number, sumAssured: v.sumAssured,
    plan: v.plan, territory: v.territory, coverage: v.coverage,
  });
  if (!priced) return { kind: "not_issuable", reasons: ["อยู่นอกเงื่อนไขที่แบบนี้รับประกัน"] };

  return {
    kind: "ok",
    meta: { version: table.rateVersion, expiresOn: table.expiresOn, expired: table.expired },
    quote: shapeHealth(table, v, chosen, priced),
  };
}
