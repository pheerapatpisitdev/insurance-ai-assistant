import type { Availability, PayMode, Payer, PlanRates, PlanRules, RiderInput, RiderRule, Warning } from "./types";

export interface RiderContext {
  age: number;
  baseSumAssured: number;
}

export const CANNOT_BUY = "ไม่สามารถซื้อได้";
export const NOT_COVERED = "ไม่คุ้มครอง";
export const CHOOSE_OPTION = "กรุณาเลือกแบบ";
export const PAYER_MISSING = "กรอกอายุผู้ชำระเบี้ย";
export const PAYER_AGE = "อายุผู้ชำระเบี้ยไม่อยู่ในเกณฑ์";

function fmt(n: number): string {
  return n.toLocaleString("en-US");
}

/** Issue-age range of the base plan for a variant (Excel J7:M7 in iShield; global in PLB). */
export function baseAgeRange(rules: PlanRules, variant: string): { min: number; max: number } {
  return { min: rules.base.ageMin, max: rules.base.ageMaxByVariant?.[variant] ?? rules.base.ageMax };
}

function allowedPlans(rates: PlanRates, rules: PlanRules, code: string, age: number): number[] | undefined {
  const rule = rules.riders[code];
  const rider = rates.riders[code];
  if (!rule?.planMaxByAge || !rider || rider.kind !== "fixedByAgePlan") return undefined;
  const band = rule.planMaxByAge.find((b) => age <= b.ageMax);
  if (!band) return [];
  return rider.plans.filter((p) => p <= band.planMax);
}

function riderOptions(rates: PlanRates, code: string): { code: string; name: string }[] | undefined {
  const rider = rates.riders[code];
  if (!rider) return undefined;
  if (rider.kind === "payorBenefit") return Object.entries(rider.options).map(([c, o]) => ({ code: c, name: o.name }));
  if (rider.kind === "ratePerThousandByVariantAgeSex") return rider.variants.map((v) => ({ code: v, name: v }));
  return undefined;
}

function saMaxFor(rule: RiderRule, ctx: RiderContext): number | undefined {
  const j = rule.juvenile;
  if (j && ctx.age <= j.ageMax) return Math.min(j.saMaxMultipleOfBase * ctx.baseSumAssured, j.saMaxCap);
  if (rule.saMaxMultipleOfBase === undefined) return undefined;
  const byMultiple = rule.saMaxMultipleOfBase * ctx.baseSumAssured;
  return rule.saMaxCap === undefined ? byMultiple : Math.min(byMultiple, rule.saMaxCap);
}

/** What the UI needs to enable/disable a rider and bound its input. */
export function riderAvailability(rules: PlanRules, rates: PlanRates, code: string, ctx: RiderContext): Availability {
  const rule = rules.riders[code];
  const eligible = ctx.age >= rule.ageMin && ctx.age <= rule.ageMax;
  return {
    code,
    name: rule.name,
    eligible,
    ageRange: `${rule.ageMin} - ${rule.ageMax} ปี`,
    saMin: rule.saMin,
    saMax: saMaxFor(rule, ctx),
    plans: allowedPlans(rates, rules, code, ctx.age),
    options: riderOptions(rates, code),
    needsPayer: rates.riders[code]?.kind === "payorBenefit" || undefined,
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
  payer?: Payer,
): string | undefined {
  const a = riderAvailability(rules, rates, code, ctx);
  if (!a.eligible) return CANNOT_BUY;
  if (a.options && (!input.option || !a.options.some((o) => o.code === input.option))) return CHOOSE_OPTION;
  if (a.needsPayer) {
    const p = rules.riders[code].payer;
    if (!payer) return PAYER_MISSING;
    if (p && (payer.age < p.ageMin || payer.age > p.ageMax)) return PAYER_AGE;
    return undefined;
  }
  if (input.plan !== undefined) {
    if (!a.plans || !a.plans.includes(input.plan)) return `${code} เกินกว่าที่กำหนด`;
    return undefined;
  }
  const label = input.option ?? code;
  const sa = input.sumAssured ?? 0;
  if (a.saMin !== undefined && sa < a.saMin) return `${label} ต่ำกว่าขั้นต่ำ ${fmt(a.saMin)}`;
  if (a.saMax !== undefined && sa > a.saMax) return `${label} เกินกว่าที่กำหนด`;
  return undefined;
}

export interface CombinedViolation {
  code: string;
  codes: string[];
  message: string;
}

/** e.g. AP_SA + ECARE_SA > MIN(5*base, 10,000,000). */
export function checkCombined(rules: PlanRules, baseSumAssured: number, riders: RiderInput[]): CombinedViolation[] {
  const out: CombinedViolation[] = [];
  for (const c of rules.combined) {
    const total = riders.filter((r) => c.riders.includes(r.code)).reduce((s, r) => s + (r.sumAssured ?? 0), 0);
    const limit = Math.min(c.maxMultipleOfBase * baseSumAssured, c.cap);
    if (total > limit) out.push({ code: c.code, codes: [...c.riders], message: c.message });
  }
  return out;
}

/** totalModal in satang. */
export function checkMonthlyMinimum(rules: PlanRules, mode: PayMode, totalModal: number): Warning | undefined {
  if (mode !== "monthly") return undefined;
  if (totalModal >= rules.minMonthlyTotal * 100) return undefined;
  return { level: "error", code: "MIN_MONTHLY", message: `เบี้ยประกันภัยรายเดือนต่ำกว่า ${fmt(rules.minMonthlyTotal)} บาท` };
}
