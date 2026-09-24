import { PENSION_LIMITS } from "@/calc/pension/engine";
import { CANCER_TIERS, CI_TIERS, HEALTH_TIERS, LIFE_PLANS, LIFE_SUMS, PENSION_STEP } from "./assumptions";
import { ciNeed, healthNeed, lifeNeed, retireNeed, roundUpTo, taxSaved, type PlanInput, type Sex } from "./needs";
import { FIXED_PICK, type OrderedBy, type OrderPick } from "./order";

/**
 * The plan: each area's need met as far as the budget goes, in the order picked for this
 * person (order.ts) — the owner's life, health, critical illness, retirement when the model
 * gives none. The pension aims at its gap, except in last place, where it takes what is left.
 *
 * Prices come from a Pricer so this can be tested with prices anyone can check by eye;
 * the real one (pricer.ts) reads the rate tables. Every premium here is satang a year.
 */

export type AreaKey = "life" | "health" | "ci" | "retire";
export type Status = "fits" | "reduced" | "short" | "covered" | "unavailable";

export interface Offer {
  product: string;
  href: string;
  /** the contract's own amount: the sum assured, the tier's CI sum, the pension's premium */
  sum: number;
  /** what it pays: double the sum before sixty, the room a day, the pension a month */
  cover: number;
  /** satang a year */
  annual: number;
  /** premium rises with age, so it is the first year's */
  firstYear: boolean;
  /** the pension's starting age */
  fromAge?: number;
  /** a term plan's last covered age; it pays nothing back at the end */
  coverUntil?: number;
}

export interface Area {
  key: AreaKey;
  /** how have / should / cover read: baht, baht a day, baht a month */
  unit: "sum" | "room" | "pension";
  have: number;
  should: number;
  status: Status;
  /** for "short", the smallest option — shown, not counted */
  offer?: Offer;
}

export interface PlanResult {
  areas: Area[];
  /** baht a month, as the customer set it */
  budget: number;
  /** satang a year actually spent */
  usedAnnual: number;
  /** baht a year, estimated */
  taxSaved: number;
  /** the order the budget served the areas in; `areas` is in this order too */
  order: AreaKey[];
  orderedBy: OrderedBy;
  /** the card's opening lines */
  summary: string;
}

export interface Pricer {
  /** variant is one of LIFE_PLANS' — PLB15, WLF99H or WLF19H */
  life(variant: string, sum: number): number | undefined;
  health(plan: string): number | undefined;
  ci(tier: number): number | undefined;
  cancer(tier: number): number | undefined;
  /**
   * start: the wanted age — the pension begins then or at the next age the plan issues;
   * by: a premium in satang a year, or a pension in baht a month
   */
  pension(start: number, by: { premium: number } | { monthly: number }): { annual: number; monthlyPension: number; from: number } | undefined;
}

interface Fit<T> {
  status: "fits" | "reduced" | "short" | "unavailable";
  option?: T;
  annual?: number;
}

/** From the wanted option down: the wanted one if it fits, else the largest that does. */
function fit<T>(wanted: T[], price: (o: T) => number | undefined, left: number): Fit<T> {
  const first = price(wanted[0]);
  if (first === undefined) return { status: "unavailable" };
  if (first <= left) return { status: "fits", option: wanted[0], annual: first };
  for (const o of wanted.slice(1)) {
    const a = price(o);
    if (a !== undefined && a <= left) return { status: "reduced", option: o, annual: a };
  }
  const last = wanted[wanted.length - 1];
  return { status: "short", option: last, annual: price(last) };
}

const spends = (s: Fit<unknown>["status"]) => s === "fits" || s === "reduced";

export function healthHref(age: number, sex: Sex, plan: string): string {
  return `/ihealthy-ultra?age=${age}&sex=${sex}&plan=${plan}`;
}

interface Purse {
  /** satang a year still to spend */
  left: number;
  /** satang a year spent, by the deduction each counts under */
  life: number;
  health: number;
  pension: number;
}

function spend(purse: Purse, kind: "life" | "health" | "pension", annual: number) {
  purse.left -= annual;
  purse[kind] += annual;
}

export function recommend(p: PlanInput, pr: Pricer, pick: OrderPick = FIXED_PICK): PlanResult {
  const start = p.budget * 12 * 100;
  const purse: Purse = { left: start, life: 0, health: 0, pension: 0 };
  const areas = pick.order.map((key, i) => {
    if (key === "life") return lifeArea(p, pr, purse);
    if (key === "health") return healthArea(p, pr, purse);
    if (key === "ci") return ciArea(p, pr, purse);
    return retireArea(p, pr, purse, i === pick.order.length - 1);
  });
  return {
    areas,
    budget: p.budget,
    usedAnnual: start - purse.left,
    taxSaved: taxSaved(p, { life: purse.life / 100, health: purse.health / 100, pension: purse.pension / 100 }),
    order: pick.order,
    orderedBy: pick.by,
    summary: pick.summary,
  };
}

function lifeArea(p: PlanInput, pr: Pricer, purse: Purse): Area {
  const life = lifeNeed(p);
  const lifeArea: Area = { key: "life", unit: "sum", have: life.have, should: life.need, status: "covered" };
  if (life.gap > 0) {
    const term = LIFE_PLANS.term;
    const plan = p.lifeWant === "save" ? LIFE_PLANS.pay19
      : pr.life(term.variant, LIFE_SUMS[0]) !== undefined ? term : LIFE_PLANS.to99;
    const doubled = plan.doubles && life.doubled;
    const target = roundUpTo(LIFE_SUMS, doubled ? life.gap / 2 : life.gap);
    const cap = "maxSum" in plan ? plan.maxSum : Infinity;
    const wanted = LIFE_SUMS.filter((s) => s <= Math.min(target, cap)).reverse();
    const r = fit(wanted, (s) => pr.life(plan.variant, s), purse.left);
    // a capped plan can fit its ceiling and still fall short of the need
    lifeArea.status = r.status === "fits" && wanted[0] < target ? "reduced" : r.status;
    if (r.option !== undefined && r.annual !== undefined) {
      lifeArea.offer = {
        product: plan.product, href: plan.href, sum: r.option,
        cover: doubled ? r.option * 2 : r.option, annual: r.annual, firstYear: false,
        coverUntil: "years" in plan ? p.age + plan.years : undefined,
      };
      if (spends(r.status)) spend(purse, "life", r.annual);
    }
  }
  return lifeArea;
}

function healthArea(p: PlanInput, pr: Pricer, purse: Purse): Area {
  const health = healthNeed(p);
  const healthArea: Area = { key: "health", unit: "room", have: health.haveRoom, should: health.room, status: "covered" };
  if (!health.covered) {
    const upTo = HEALTH_TIERS.findIndex((t) => t.code === health.plan);
    const wanted = HEALTH_TIERS.slice(0, upTo + 1).reverse();
    const r = fit(wanted, (t) => pr.health(t.code), purse.left);
    healthArea.status = r.status;
    if (r.option && r.annual !== undefined) {
      healthArea.offer = {
        product: `iHealthy Ultra แผน${r.option.name}`, href: healthHref(p.age, p.sex, r.option.code),
        sum: r.option.room, cover: r.option.room, annual: r.annual, firstYear: true,
      };
      if (spends(r.status)) spend(purse, "health", r.annual);
    }
  }
  return healthArea;
}

/** CI 123 first; the cancer set when CI 123 cannot fit */
function ciArea(p: PlanInput, pr: Pricer, purse: Purse): Area {
  const ci = ciNeed(p);
  const ciArea: Area = { key: "ci", unit: "sum", have: ci.have, should: ci.need, status: "covered" };
  if (ci.gap > 0) {
    const target = roundUpTo(CI_TIERS.map((t) => t.sum), ci.gap);
    const r = fit(CI_TIERS.filter((t) => t.sum <= target).reverse(), (t) => pr.ci(t.no), purse.left);
    const ciOffer = (t: { sum: number }, annual: number): Offer => ({
      product: "CI 123", href: "/ci123", sum: t.sum, cover: t.sum, annual, firstYear: true,
    });
    if (spends(r.status) && r.option && r.annual !== undefined) {
      ciArea.status = r.status;
      ciArea.offer = ciOffer(r.option, r.annual);
      spend(purse, "health", r.annual);
    } else {
      const c = fit(CANCER_TIERS.slice().reverse(), (t) => pr.cancer(t.no), purse.left);
      if (spends(c.status) && c.option && c.annual !== undefined) {
        ciArea.status = "reduced";
        ciArea.offer = {
          product: "ชุดประกันมะเร็ง", href: "/cancer", sum: c.option.sum, cover: c.option.sum,
          annual: c.annual, firstYear: true,
        };
        spend(purse, "health", c.annual);
      } else {
        ciArea.status = r.status;
        if (r.option && r.annual !== undefined) ciArea.offer = ciOffer(r.option, r.annual);
      }
    }
  }
  return ciArea;
}

type PensionQuote = NonNullable<ReturnType<Pricer["pension"]>>;

function pensionOffer(q: PensionQuote): Offer {
  return {
    product: "บำนาญ สมาร์ท 95", href: "/bumnan95", sum: q.annual, cover: q.monthlyPension,
    annual: q.annual, firstYear: false, fromAge: q.from,
  };
}

/** Last: whatever is left, to the thousand baht, buys the pension. Earlier: the gap, stepped down to fit. */
function retireArea(p: PlanInput, pr: Pricer, purse: Purse, last: boolean): Area {
  const need = retireNeed(p);
  const area: Area = { key: "retire", unit: "pension", have: need.have, should: need.should, status: "covered" };
  if (need.gap === 0) return area;
  if (p.age > PENSION_LIMITS.ageMax) return { ...area, status: "unavailable" };
  if (last) {
    const spendable = Math.floor(purse.left / 100_000) * 100_000;
    const q = spendable > 0 ? pr.pension(p.retireAge, { premium: spendable }) : undefined;
    if (!q) return { ...area, status: "short" };
    spend(purse, "pension", q.annual);
    return { ...area, status: q.monthlyPension >= need.gap ? "fits" : "reduced", offer: pensionOffer(q) };
  }
  const top = Math.ceil(need.gap / PENSION_STEP) * PENSION_STEP;
  const quotes = new Map<number, PensionQuote>();
  for (let m = top; m >= PENSION_STEP; m -= PENSION_STEP) {
    const q = pr.pension(p.retireAge, { monthly: m });
    if (q) quotes.set(m, q);
  }
  const steps = [...quotes.keys()];
  if (!steps.length) return { ...area, status: "unavailable" };
  const r = fit(steps, (m) => quotes.get(m)!.annual, purse.left);
  const q = r.option !== undefined ? quotes.get(r.option) : undefined;
  if (spends(r.status) && q) spend(purse, "pension", q.annual);
  const status = r.status === "fits" && steps[0] < top ? "reduced" : r.status;
  return { ...area, status, offer: q ? pensionOffer(q) : undefined };
}
