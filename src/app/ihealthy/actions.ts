"use server";
import { quote } from "@/calc/quote";
import { getPlan, type PlanBundle } from "@/calc/plans/registry";
import {
  CANNOT_BUY, disabledRiders, packageExactSumAssured, packageSeq, requiredRiders, riderAvailability,
} from "@/calc/rules";
import { iHealthyTable } from "@/lib/ihealthy-table";
import type { PayMode, Sex } from "@/calc/types";

const PLAN_CODE = "LIFEPROTECT";
/** The health rider is the page's whole subject; it is never one of the extras. */
const THE_HEALTH_RIDER = "IHU";

export interface AttachedRider {
  code: string;
  sumAssured?: number;
  plan?: number;
  option?: string;
}

export interface RiderQuoteInput {
  base: string;
  age: number;
  sex: Sex;
  sumAssured: number;
  mode: PayMode;
  plan: string;
  territory: string;
  coverage: string;
  riders: AttachedRider[];
}

export interface RiderChoice {
  code: string;
  name: string;
  ageRange: string;
  /** false for a rider this age cannot buy: shown, greyed, and not attachable */
  eligible: boolean;
  /** why not, in the company's own words */
  reason?: string;
  saMin?: number;
  saMax?: number;
  /** the fixed plan amounts this rider sells, when it sells plans rather than sums */
  plans?: number[];
  /** the named variants this rider sells */
  options?: { code: string; name: string }[];
  /** the package pins this rider's sum assured here, and says so in these words */
  exactSumAssured?: number;
  exactMessage?: string;
}

/**
 * One priced line of the arrangement.
 *
 * Mapped from the engine's own `QuoteItem` rather than being it: this is a public POST
 * endpoint, and what crosses the wire is decided here, so a field added to the engine's
 * display type later does not start shipping to the browser on its own. Two of its fields
 * are deliberately left behind — the annual premium, because the fold prices the instalment
 * on screen and a second price for the same thing only invites quoting the wrong one, and
 * the sums assured, because the fold's own controls are where they were typed.
 */
export interface RiderQuoteRow {
  code: string;
  name: string;
  /** satang, in the mode that was asked for */
  modal: number;
  eligible: boolean;
  message?: string;
}

export interface RiderQuoteResult {
  available: RiderChoice[];
  items: RiderQuoteRow[];
  /** the whole arrangement in this mode, in satang */
  totalModal: number;
  warnings: string[];
}

const MODES: PayMode[] = ["annual", "semi", "monthly"];
/** Nobody is older than this, and no rate table in the building reaches it. */
const AGE_MAX = 120;
/** Comfortably above every cap in the rules; a figure past it is not a sum assured. */
const SUM_MAX = 100_000_000;
const BAD_REQUEST = "คำขอไม่ถูกต้อง";

function isCount(v: unknown, max: number): v is number {
  return typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= max;
}

/** A label the rate tables are keyed by: present, and short enough to be one. */
function isLabel(v: unknown): v is string {
  return typeof v === "string" && v.length > 0 && v.length <= 60;
}

function parseRider(raw: unknown, plan: PlanBundle): AttachedRider | undefined {
  if (typeof raw !== "object" || raw === null) return undefined;
  const r = raw as Record<string, unknown>;
  if (!isLabel(r.code) || !plan.riderOrder.includes(r.code)) return undefined;
  if (r.sumAssured !== undefined && !isCount(r.sumAssured, SUM_MAX)) return undefined;
  if (r.plan !== undefined && !isCount(r.plan, SUM_MAX)) return undefined;
  if (r.option !== undefined && !isLabel(r.option)) return undefined;
  return {
    code: r.code,
    ...(r.sumAssured === undefined ? {} : { sumAssured: r.sumAssured as number }),
    ...(r.plan === undefined ? {} : { plan: r.plan as number }),
    ...(r.option === undefined ? {} : { option: r.option as string }),
  };
}

/**
 * The request, or nothing at all.
 *
 * A server action is a POST endpoint whose body is whatever the caller cares to send, so the
 * declared parameter type is a promise the client makes and not one it keeps. Everything the
 * engine would index a rate table with is checked here: an age of 500 or a base the table
 * never carried would otherwise reach `quote()` and come back as arithmetic on undefined.
 */
function parseRequest(raw: unknown, plan: PlanBundle, bases: string[]): RiderQuoteInput | undefined {
  if (typeof raw !== "object" || raw === null) return undefined;
  const r = raw as Record<string, unknown>;
  if (!isLabel(r.base) || !bases.includes(r.base)) return undefined;
  if (!isCount(r.age, AGE_MAX)) return undefined;
  if (r.sex !== "M" && r.sex !== "F") return undefined;
  if (!isCount(r.sumAssured, SUM_MAX) || r.sumAssured === 0) return undefined;
  if (!MODES.includes(r.mode as PayMode)) return undefined;
  // Plan, territory and coverage are only checked for being labels at all. Which spellings
  // exist is the rider's own rate table's business, and it already answers for one it does
  // not carry by pricing nothing and saying so — the same answer a withdrawn plan gets.
  if (!isLabel(r.plan) || !isLabel(r.territory) || !isLabel(r.coverage)) return undefined;
  if (!Array.isArray(r.riders) || r.riders.length > plan.riderOrder.length) return undefined;
  const riders: AttachedRider[] = [];
  for (const one of r.riders) {
    const rider = parseRider(one, plan);
    if (rider === undefined) return undefined;
    riders.push(rider);
  }
  return {
    base: r.base, age: r.age, sex: r.sex, sumAssured: r.sumAssured, mode: r.mode as PayMode,
    plan: r.plan, territory: r.territory, coverage: r.coverage, riders,
  };
}

/**
 * The agent's half of the page. Everything the customer sees is priced in the browser from
 * a slim table; the moment another rider is attached the arrangement stops being slim, so it
 * is priced here by the engine itself — the same `quote()` the back-office calculator runs.
 *
 * It is a server action and not more browser arithmetic because the two payor riders' rate
 * tables are 416 kB on their own. A customer who never opens the fold never downloads them.
 */
export async function priceWithRiders(input: RiderQuoteInput): Promise<RiderQuoteResult> {
  const plan = getPlan(PLAN_CODE)!;
  const asked = parseRequest(input, plan, iHealthyTable().bases.map((b) => b.variant));
  // Nothing this page can do produces an unparsable request, so the empty quote is for
  // whoever is posting by hand: a harmless answer rather than a stack trace in the log.
  if (asked === undefined) return { available: [], items: [], totalModal: 0, warnings: [BAD_REQUEST] };

  const seq = packageSeq(asked.base, plan.rates);
  const off = disabledRiders(plan.rules, seq);
  // A rider the package makes mandatory is attached below rather than offered: leaving one
  // off voids the whole quote, so it is not the agent's to tick. Here that names only the
  // health rider the page is about, which the customer's own pickers upstairs already set.
  const required = new Set(requiredRiders(plan.rules, seq));
  const ctx = { age: asked.age, baseSumAssured: asked.sumAssured };

  // A rider this age cannot buy stays on the list, greyed, carrying its reason. Taking it
  // away answers the agent's question — "can we add the critical-illness cover for him?" —
  // by making the question unaskable, which is the fault this whole page was built to fix.
  // A rider the package does not sell is a different matter: it is not on offer here at all.
  const available: RiderChoice[] = [];
  for (const code of plan.riderOrder) {
    if (code === THE_HEALTH_RIDER || required.has(code) || off.has(code)) continue;
    const a = riderAvailability(plan.rules, plan.rates, code, ctx);
    const exact = packageExactSumAssured(plan.rules, seq, code);
    available.push({
      code, name: a.name, ageRange: a.ageRange, eligible: a.eligible, reason: a.reason,
      saMin: a.saMin, saMax: a.saMax, plans: a.plans, options: a.options,
      exactSumAssured: exact?.amount, exactMessage: exact?.message,
    });
  }

  // The arrangement can change under an open fold — a package that refuses seven riders, an
  // age that puts four out of range — so what was ticked earlier is filtered against what
  // this arrangement offers instead of being sent on to be priced. The fold keeps the tick
  // in case the agent goes back; the total here counts only what is still on offer, and the
  // pinned sums are the package's to set, not the caller's.
  const offered = new Map(available.map((c) => [c.code, c]));
  const attached: AttachedRider[] = [];
  const dropped: string[] = [];
  for (const rider of asked.riders) {
    const choice = offered.get(rider.code);
    if (choice === undefined || !choice.eligible) {
      dropped.push(rider.code);
      continue;
    }
    attached.push(
      choice.exactSumAssured === undefined ? rider : { ...rider, sumAssured: choice.exactSumAssured },
    );
  }

  const result = quote({
    planCode: PLAN_CODE, variant: asked.base, age: asked.age, sex: asked.sex, mode: asked.mode,
    basis: "sumAssured", sumAssured: asked.sumAssured,
    // The page asks for no payer of its own, so the insured is taken to pay their own
    // premiums. A payor rider bought for a child needs a real parent, and the engine says so
    // rather than being handed a guess.
    payer: { age: asked.age, sex: asked.sex },
    riders: [
      { code: THE_HEALTH_RIDER, option: asked.plan, territory: asked.territory, coverage: asked.coverage },
      ...[...required].filter((c) => c !== THE_HEALTH_RIDER).map((code) => ({
        code, sumAssured: packageExactSumAssured(plan.rules, seq, code)?.amount,
      })),
      ...attached,
    ],
  });

  // Why a tick was left out is the engine's to say, and it says two different things: a
  // package does not sell this rider at all, an eight-year-old is too young for that one.
  // Both would otherwise come out as the same shrug.
  const why = new Map(result.availability.map((a) => [a.code, a]));
  return {
    available,
    items: result.items.map((i) => ({
      code: i.code, name: i.name, modal: i.modal, eligible: i.eligible, message: i.message,
    })),
    totalModal: result.totalModal,
    warnings: [
      ...dropped.map((code) => {
        const a = why.get(code);
        return `${a?.name ?? code} ${a?.reason ?? CANNOT_BUY} จึงไม่ได้คิดเบี้ยให้`;
      }),
      ...result.warnings.map((w) => w.message),
    ],
  };
}
