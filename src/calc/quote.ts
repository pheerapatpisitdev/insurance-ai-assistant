import type { Availability, QuoteInput, QuoteItem, QuoteResult, Warning } from "./types";
import { getPlan } from "./plans/registry";
import { basePremium } from "./base-premium";
import { ratePerThousandRiderPremium } from "./riders/rate-per-thousand";
import { fixedPlanRiderPremium } from "./riders/fixed-by-plan";
import { CANNOT_BUY, checkCombined, checkMonthlyMinimum, checkRiderInput, riderAvailability } from "./rules";

function fmt(n: number): string {
  return n.toLocaleString("en-US");
}

/** Pure function: QuoteInput → QuoteResult. `today` is injectable for tests. */
export function quote(input: QuoteInput, today: Date = new Date()): QuoteResult {
  const plan = getPlan(input.planCode);
  if (!plan) throw new Error(`Unknown plan: ${input.planCode}`);
  const { rates, rules } = plan;
  const warnings: Warning[] = [];
  const items: QuoteItem[] = [];

  // ---- base ----
  const baseName = `${rates.planName} ${input.variant}`;
  const inAgeRange = input.age >= rules.base.ageMin && input.age <= rules.base.ageMax;
  const bp = inAgeRange
    ? basePremium(rates, { variant: input.variant, sex: input.sex, age: input.age, sumAssured: input.sumAssured, mode: input.mode })
    : undefined;
  if (!bp) {
    items.push({ code: input.variant, name: baseName, amount: input.sumAssured, annual: 0, modal: 0, eligible: false, message: CANNOT_BUY });
    warnings.push({ level: "error", code: "BASE_AGE", message: `อายุรับประกัน ${rules.base.ageMin} - ${rules.base.ageMax} ปี` });
  } else {
    items.push({ code: input.variant, name: baseName, amount: input.sumAssured, annual: bp.annual, modal: bp.modal, eligible: true });
  }
  if (input.sumAssured < rules.base.saMin) {
    warnings.push({ level: "error", code: "BASE_SA_MIN", message: `จำนวนเงินเอาประกันภัยขั้นต่ำ ${fmt(rules.base.saMin)} บาท` });
  }

  // ---- riders ----
  const ctx = { age: input.age, baseSumAssured: input.sumAssured };
  const combined = checkCombined(rules, input.sumAssured, input.riders);
  for (const c of combined) warnings.push({ level: "error", code: c.code, message: c.message });

  for (const code of plan.riderOrder) {
    const ri = input.riders.find((r) => r.code === code);
    if (!ri) continue;
    const rule = rules.riders[code];
    const amount = ri.plan ?? ri.sumAssured ?? 0;
    const excludedBy = combined.find((c) => c.codes.includes(code));
    const message = excludedBy?.message ?? checkRiderInput(rules, rates, code, ctx, ri);
    if (message) {
      items.push({ code, name: rule.name, amount, annual: 0, modal: 0, eligible: false, message });
      continue;
    }
    const rider = rates.riders[code];
    const premium =
      rider.kind === "ratePerThousandByAgeClass"
        ? ratePerThousandRiderPremium(rates, code, { age: input.age, sumAssured: ri.sumAssured ?? 0, mode: input.mode })
        : fixedPlanRiderPremium(rates, code, { age: input.age, plan: ri.plan ?? 0, mode: input.mode });
    if (!premium) {
      items.push({ code, name: rule.name, amount, annual: 0, modal: 0, eligible: false, message: CANNOT_BUY });
      continue;
    }
    items.push({ code, name: rule.name, amount, annual: premium.annual, modal: premium.modal, eligible: true });
  }

  // ---- totals & global checks ----
  const totalAnnual = items.reduce((s, i) => s + i.annual, 0);
  const totalModal = items.reduce((s, i) => s + i.modal, 0);
  const mm = checkMonthlyMinimum(rules, input.mode, totalModal);
  if (mm) warnings.push(mm);

  const availability: Availability[] = plan.riderOrder.map((code) => riderAvailability(rules, rates, code, ctx));
  const expired = today.toISOString().slice(0, 10) > rates.expiresOn;

  return {
    items, totalAnnual, totalModal, warnings, availability,
    meta: { planName: rates.planName, version: rates.version, expiresOn: rates.expiresOn, expired },
  };
}
