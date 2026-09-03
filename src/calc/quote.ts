import type { Availability, PlanRates, QuoteInput, QuoteItem, QuoteResult, RiderInput, Warning } from "./types";
import { getPlan } from "./plans/registry";
import { basePremium, type BasePremiumResult } from "./base-premium";
import { sumAssuredFromPremium } from "./sa-from-premium";
import { ratePerThousandRiderPremium } from "./riders/rate-per-thousand";
import { fixedPlanRiderPremium } from "./riders/fixed-by-plan";
import { variantRiderPremium } from "./riders/variant-rate";
import { payorBenefitPremium } from "./riders/payor-benefit";
import { CANNOT_BUY, NOT_COVERED, baseAgeRange, checkCombined, checkMonthlyMinimum, checkRiderInput, riderAvailability } from "./rules";

function fmt(n: number): string {
  return n.toLocaleString("en-US");
}

/** Resolve the sum assured to quote on, emitting min/max warnings. Returns 0 when premium-basis SA is out of range (Excel D26). */
function resolveSumAssured(input: QuoteInput, rates: PlanRates, saMin: number, saMax: number | undefined, warnings: Warning[]): number {
  const minMsg = { level: "error" as const, code: "BASE_SA_MIN", message: `จำนวนเงินเอาประกันภัยขั้นต่ำ ${fmt(saMin)} บาท` };
  const maxMsg = saMax === undefined ? undefined
    : { level: "error" as const, code: "BASE_SA_MAX", message: `จำนวนเงินเอาประกันภัยสูงสุด ${saMax / 1_000_000} ล้านบาท` };
  if (input.basis === "premium") {
    const sa = sumAssuredFromPremium(rates, { variant: input.variant, sex: input.sex, age: input.age, mode: input.mode, targetPremium: input.targetPremium ?? 0 }) ?? 0;
    if (sa < saMin) { warnings.push(minMsg); return 0; }
    if (maxMsg && saMax !== undefined && sa > saMax) { warnings.push(maxMsg); return 0; }
    return sa;
  }
  if (input.sumAssured < saMin) warnings.push(minMsg);
  if (maxMsg && saMax !== undefined && input.sumAssured > saMax) warnings.push(maxMsg);
  return input.sumAssured;
}

interface RiderPremium { annual: number; modal: number; name?: string; amountLabel?: string }

function riderPremium(rates: PlanRates, code: string, ri: RiderInput, input: QuoteInput, sa: number, bp: BasePremiumResult | undefined): RiderPremium | undefined | typeof NOT_COVERED {
  const rider = rates.riders[code];
  switch (rider.kind) {
    case "ratePerThousandByAgeClass":
    case "flatRateByClass":
      return ratePerThousandRiderPremium(rates, code, { age: input.age, sumAssured: ri.sumAssured ?? 0, mode: input.mode });
    case "fixedByAgePlan":
      return fixedPlanRiderPremium(rates, code, { age: input.age, plan: ri.plan ?? 0, mode: input.mode });
    case "ratePerThousandByVariantAgeSex":
      return variantRiderPremium(rates, code, { variant: ri.option ?? "", sex: input.sex, age: input.age, sumAssured: ri.sumAssured ?? 0, mode: input.mode });
    case "payorBenefit": {
      if (!bp || !input.payer) return NOT_COVERED;
      const r = payorBenefitPremium(rates, code, {
        option: ri.option ?? "", insuredAge: input.age, payer: input.payer,
        payTerm: rates.base.payTerm?.[input.variant] ?? 0, baseAnnual: bp.annual, mode: input.mode,
      });
      if (!r) return undefined;
      return {
        ...r,
        name: rider.options[ri.option ?? ""]?.name,
        amountLabel: `ผู้ชำระเบี้ย ${input.payer.sex === "M" ? "ชาย" : "หญิง"} ${input.payer.age} ปี`,
      };
    }
  }
}

/** Pure function: QuoteInput → QuoteResult. `today` is injectable for tests. */
export function quote(input: QuoteInput, today: Date = new Date()): QuoteResult {
  const plan = getPlan(input.planCode);
  if (!plan) throw new Error(`Unknown plan: ${input.planCode}`);
  const { rates, rules } = plan;
  const warnings: Warning[] = [];
  const items: QuoteItem[] = [];

  // ---- sum assured & base ----
  const sa = resolveSumAssured(input, rates, rules.base.saMin, rules.base.saMax, warnings);
  const baseName = `${rates.planName} ${input.variant}`;
  const ageRange = baseAgeRange(rules, input.variant);
  const inAgeRange = input.age >= ageRange.min && input.age <= ageRange.max;
  const bp = inAgeRange && sa > 0
    ? basePremium(rates, { variant: input.variant, sex: input.sex, age: input.age, sumAssured: sa, mode: input.mode })
    : undefined;
  if (!bp) {
    items.push({ code: input.variant, name: baseName, amount: sa, annual: 0, modal: 0, eligible: false, message: sa > 0 ? CANNOT_BUY : NOT_COVERED });
    if (!inAgeRange) warnings.push({ level: "error", code: "BASE_AGE", message: `อายุรับประกัน ${ageRange.min} - ${ageRange.max} ปี` });
  } else {
    items.push({ code: input.variant, name: baseName, amount: sa, annual: bp.annual, modal: bp.modal, eligible: true });
  }

  // ---- riders ----
  const ctx = { age: input.age, baseSumAssured: sa };
  const combined = checkCombined(rules, sa, input.riders);
  for (const c of combined) warnings.push({ level: "error", code: c.code, message: c.message });

  for (const code of plan.riderOrder) {
    const ri = input.riders.find((r) => r.code === code);
    if (!ri) continue;
    const rule = rules.riders[code];
    const amount = ri.plan ?? ri.sumAssured ?? 0;
    const name = ri.option && rates.riders[code].kind === "ratePerThousandByVariantAgeSex" ? `${rule.name} (${ri.option})` : rule.name;
    const excludedBy = combined.find((c) => c.codes.includes(code));
    const message = excludedBy?.message ?? checkRiderInput(rules, rates, code, ctx, ri, input.payer);
    if (message) {
      items.push({ code, name, amount, annual: 0, modal: 0, eligible: false, message });
      continue;
    }
    const premium = riderPremium(rates, code, ri, input, sa, bp);
    if (premium === NOT_COVERED || !premium) {
      items.push({ code, name, amount, annual: 0, modal: 0, eligible: false, message: premium === NOT_COVERED ? NOT_COVERED : CANNOT_BUY });
      continue;
    }
    items.push({ code, name: premium.name ?? name, amount, amountLabel: premium.amountLabel, annual: premium.annual, modal: premium.modal, eligible: true });
  }

  // ---- totals & global checks (Excel: total is 0 when no sum assured) ----
  const totalAnnual = sa > 0 ? items.reduce((s, i) => s + i.annual, 0) : 0;
  const totalModal = sa > 0 ? items.reduce((s, i) => s + i.modal, 0) : 0;
  const mm = checkMonthlyMinimum(rules, input.mode, totalModal);
  if (mm && sa > 0) warnings.push(mm);

  const availability: Availability[] = plan.riderOrder.map((code) => riderAvailability(rules, rates, code, ctx));
  const expired = today.toISOString().slice(0, 10) > rates.expiresOn;

  return {
    items, totalAnnual, totalModal, warnings, availability, sumAssured: sa,
    meta: { planName: rates.planName, version: rates.version, expiresOn: rates.expiresOn, expired },
  };
}
