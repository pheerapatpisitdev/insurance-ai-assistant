import { PENSION_LIMITS } from "@/calc/pension/engine";
import { CANCER_TIERS, CI_TIERS, HEALTH_TIERS, LIFE_SUMS } from "./assumptions";
import { ciNeed, healthNeed, lifeNeed, retireNeed, roundUpTo, taxSaved, type PlanInput, type Sex } from "./needs";

/**
 * The plan: each area's need met as far as the budget goes, in the owner's order —
 * life, health, critical illness, then whatever is left to the pension.
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
}

export interface Pricer {
  life(sum: number): number | undefined;
  health(plan: string): number | undefined;
  ci(tier: number): number | undefined;
  cancer(tier: number): number | undefined;
  pension(annual: number): { annual: number; monthlyPension: number; from: number } | undefined;
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

export function recommend(p: PlanInput, pr: Pricer): PlanResult {
  const start = p.budget * 12 * 100;
  let left = start;
  const spent = { life: 0, health: 0, pension: 0 };

  // 1. life
  const life = lifeNeed(p);
  const lifeArea: Area = { key: "life", unit: "sum", have: life.have, should: life.need, status: "covered" };
  if (life.sumAssured > 0) {
    const wanted = LIFE_SUMS.filter((s) => s <= life.sumAssured).reverse();
    const r = fit(wanted, (s) => pr.life(s), left);
    lifeArea.status = r.status;
    if (r.option !== undefined && r.annual !== undefined) {
      lifeArea.offer = {
        product: "Life Protect x 2", href: "/lifeprotect", sum: r.option,
        cover: life.doubled ? r.option * 2 : r.option, annual: r.annual, firstYear: false,
      };
      if (spends(r.status)) { left -= r.annual; spent.life += r.annual; }
    }
  }

  // 2. health
  const health = healthNeed(p);
  const healthArea: Area = { key: "health", unit: "room", have: health.haveRoom, should: health.room, status: "covered" };
  if (!health.covered) {
    const upTo = HEALTH_TIERS.findIndex((t) => t.code === health.plan);
    const wanted = HEALTH_TIERS.slice(0, upTo + 1).reverse();
    const r = fit(wanted, (t) => pr.health(t.code), left);
    healthArea.status = r.status;
    if (r.option && r.annual !== undefined) {
      healthArea.offer = {
        product: `iHealthy Ultra แผน${r.option.name}`, href: healthHref(p.age, p.sex, r.option.code),
        sum: r.option.room, cover: r.option.room, annual: r.annual, firstYear: true,
      };
      if (spends(r.status)) { left -= r.annual; spent.health += r.annual; }
    }
  }

  // 3. critical illness, then the cancer set if CI 123 cannot fit
  const ci = ciNeed(p);
  const ciArea: Area = { key: "ci", unit: "sum", have: ci.have, should: ci.need, status: "covered" };
  if (ci.gap > 0) {
    const target = roundUpTo(CI_TIERS.map((t) => t.sum), ci.gap);
    const r = fit(CI_TIERS.filter((t) => t.sum <= target).reverse(), (t) => pr.ci(t.no), left);
    const ciOffer = (t: { sum: number }, annual: number): Offer => ({
      product: "CI 123", href: "/ci123", sum: t.sum, cover: t.sum, annual, firstYear: true,
    });
    if (spends(r.status) && r.option && r.annual !== undefined) {
      ciArea.status = r.status;
      ciArea.offer = ciOffer(r.option, r.annual);
      left -= r.annual; spent.health += r.annual;
    } else {
      const c = fit(CANCER_TIERS.slice().reverse(), (t) => pr.cancer(t.no), left);
      if (spends(c.status) && c.option && c.annual !== undefined) {
        ciArea.status = "reduced";
        ciArea.offer = {
          product: "ชุดประกันมะเร็ง", href: "/cancer", sum: c.option.sum, cover: c.option.sum,
          annual: c.annual, firstYear: true,
        };
        left -= c.annual; spent.health += c.annual;
      } else {
        ciArea.status = r.status;
        if (r.option && r.annual !== undefined) ciArea.offer = ciOffer(r.option, r.annual);
      }
    }
  }

  // 4. retirement takes what is left, to the thousand baht
  const retireArea: Area = { key: "retire", unit: "pension", have: 0, should: retireNeed(p), status: "short" };
  if (p.age > PENSION_LIMITS.ageMax) {
    retireArea.status = "unavailable";
  } else {
    const spend = Math.floor(left / 100_000) * 100_000;
    const q = spend > 0 ? pr.pension(spend) : undefined;
    if (q) {
      retireArea.status = "fits";
      retireArea.offer = {
        product: "บำนาญ สมาร์ท 95", href: "/bumnan95", sum: q.annual, cover: q.monthlyPension,
        annual: q.annual, firstYear: false, fromAge: q.from,
      };
      left -= q.annual; spent.pension += q.annual;
    }
  }

  return {
    areas: [lifeArea, healthArea, ciArea, retireArea],
    budget: p.budget,
    usedAnnual: start - left,
    taxSaved: taxSaved(p, { life: spent.life / 100, health: spent.health / 100, pension: spent.pension / 100 }),
  };
}
