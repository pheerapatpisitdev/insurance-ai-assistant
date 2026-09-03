import type { Availability, PayMode, PlanRates, PlanRules, RiderInput, RiderRule, Warning } from "./types";

export interface RiderContext {
  age: number;
  baseSumAssured: number;
}

export const CANNOT_BUY = "ไม่สามารถซื้อได้";

function fmt(n: number): string {
  return n.toLocaleString("en-US");
}

function allowedPlans(rates: PlanRates, rules: PlanRules, code: string, age: number): number[] | undefined {
  const rule = rules.riders[code];
  const rider = rates.riders[code];
  if (!rule?.planMaxByAge || !rider || rider.kind !== "fixedByAgePlan") return undefined;
  const band = rule.planMaxByAge.find((b) => age <= b.ageMax);
  if (!band) return [];
  return rider.plans.filter((p) => p <= band.planMax);
}

function saMaxFor(rule: RiderRule, baseSumAssured: number): number | undefined {
  if (rule.saMaxMultipleOfBase === undefined) return undefined;
  const byMultiple = rule.saMaxMultipleOfBase * baseSumAssured;
  return rule.saMaxCap === undefined ? byMultiple : Math.min(byMultiple, rule.saMaxCap);
}

/** What the UI needs to enable/disable a rider and bound its input. */
export function riderAvailability(rules: PlanRules, rates: PlanRates, code: string, ctx: RiderContext): Availability {
  const rule = rules.riders[code];
  const ageRange = `${rule.ageMin} - ${rule.ageMax} ปี`;
  const eligible = ctx.age >= rule.ageMin && ctx.age <= rule.ageMax;
  return {
    code,
    name: rule.name,
    eligible,
    ageRange,
    saMin: rule.saMin,
    saMax: saMaxFor(rule, ctx.baseSumAssured),
    plans: allowedPlans(rates, rules, code, ctx.age),
    reason: eligible ? undefined : CANNOT_BUY,
  };
}

/** Per-rider input check. Returns the Excel-style message, or undefined when OK. */
export function checkRiderInput(
  rules: PlanRules,
  rates: PlanRates,
  code: string,
  ctx: RiderContext,
  input: RiderInput,
): string | undefined {
  const a = riderAvailability(rules, rates, code, ctx);
  if (!a.eligible) return CANNOT_BUY;
  if (input.plan !== undefined) {
    if (!a.plans || !a.plans.includes(input.plan)) return `${code} เกินกว่าที่กำหนด`;
    return undefined;
  }
  const sa = input.sumAssured ?? 0;
  if (a.saMin !== undefined && sa < a.saMin) return `${code} ต่ำกว่าขั้นต่ำ ${fmt(a.saMin)}`;
  if (a.saMax !== undefined && sa > a.saMax) return `${code} เกินกว่าที่กำหนด`;
  return undefined;
}

export interface CombinedViolation {
  code: string;
  codes: string[];
  message: string;
}

/** Excel I23/I24: AP_SA + ECARE_SA > MIN(5*base, 10,000,000). */
export function checkCombined(rules: PlanRules, baseSumAssured: number, riders: RiderInput[]): CombinedViolation[] {
  const out: CombinedViolation[] = [];
  for (const c of rules.combined) {
    const total = riders.filter((r) => c.riders.includes(r.code)).reduce((s, r) => s + (r.sumAssured ?? 0), 0);
    const limit = Math.min(c.maxMultipleOfBase * baseSumAssured, c.cap);
    if (total > limit) out.push({ code: c.code, codes: [...c.riders], message: c.message });
  }
  return out;
}

/** Excel J32/G36. totalModal in satang. */
export function checkMonthlyMinimum(rules: PlanRules, mode: PayMode, totalModal: number): Warning | undefined {
  if (mode !== "monthly") return undefined;
  if (totalModal >= rules.minMonthlyTotal * 100) return undefined;
  return { level: "error", code: "MIN_MONTHLY", message: `เบี้ยประกันภัยรายเดือนต่ำกว่า ${fmt(rules.minMonthlyTotal)} บาท` };
}
