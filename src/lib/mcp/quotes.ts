import type { Sex } from "@/calc/types";
import { plbTable } from "@/lib/plb-table";
import { plbModes, termAt as plbTerm } from "@/lib/plb-quote";
import { lifeProtectTable } from "@/lib/lifeprotect-table";
import { lifeProtectModes, termAt as lifeProtectTerm, deathBenefitOf as lifeProtectDeath } from "@/lib/lifeprotect-quote";
import { iShieldTable } from "@/lib/ishield-table";
import { iShieldModes, termAt as iShieldTerm, illnessBenefit } from "@/lib/ishield-quote";
import { lifeTreasureTable } from "@/lib/lifetreasure-table";
import { lifeTreasureModes, termAt as lifeTreasureTerm } from "@/lib/lifetreasure-quote";

export type PlanCode = "PLB" | "LIFEPROTECT" | "ISHIELD" | "LIFETREASURE";

export function listQuotePlans() {
  return [plbTable(), lifeProtectTable(), iShieldTable(), lifeTreasureTable()].map((table) => ({
    plan_code: table.planCode,
    age_min: table.ageMin,
    age_max: table.ageMax,
    sum_assured_min: "saMin" in table ? table.saMin : 500_000,
    sum_assured_max: "saMax" in table ? table.saMax : 50_000_000,
    rate_version: table.rateVersion,
    rates_expired: table.expired,
    variants: table.terms.map((term) => ({ code: term.variant, label: term.label, ...("ageMax" in term ? { age_max: term.ageMax } : {}) })),
  }));
}

export function calculateQuote(input: { plan_code: PlanCode; variant: string; age: number; sex: Sex; sum_assured: number }) {
  const { plan_code, variant, age, sex, sum_assured } = input;
  const table = {
    PLB: plbTable,
    LIFEPROTECT: lifeProtectTable,
    ISHIELD: iShieldTable,
    LIFETREASURE: lifeTreasureTable,
  }[plan_code]();
  if (table.expired) throw new Error("ตารางอัตราเบี้ยหมดอายุ กรุณาขอราคาปัจจุบันจากเจ้าหน้าที่");
  const plan = listQuotePlans().find((p) => p.plan_code === plan_code)!;
  if (!Number.isInteger(age) || age < table.ageMin || age > table.ageMax) throw new Error(`อายุต้องอยู่ในช่วง ${table.ageMin}–${table.ageMax} ปี`);
  if (sum_assured < plan.sum_assured_min || sum_assured > plan.sum_assured_max) throw new Error(`ทุนประกันต้องอยู่ในช่วง ${plan.sum_assured_min}–${plan.sum_assured_max} บาท`);
  if (!table.terms.some((t) => t.variant === variant)) throw new Error(`ไม่พบแบบ ${variant} ในแผน ${plan_code}`);
  const who = { age, sex, sumAssured: sum_assured };
  const modes = plan_code === "PLB" ? plbModes(plbTable(), plbTerm(plbTable(), variant), who)
    : plan_code === "LIFEPROTECT" ? lifeProtectModes(lifeProtectTable(), lifeProtectTerm(lifeProtectTable(), variant), who)
    : plan_code === "ISHIELD" ? iShieldModes(iShieldTable(), iShieldTerm(iShieldTable(), variant), who)
    : lifeTreasureModes(lifeTreasureTable(), lifeTreasureTerm(lifeTreasureTable(), variant), who);
  if (!modes) throw new Error("แผนนี้ไม่รับอายุหรือแบบที่เลือก");
  const premiums = Object.fromEntries(modes.map((m) => [m.mode, {
    amount_baht: m.total / 100,
    available: !m.belowMinimum,
  }]));
  return {
    ...input,
    currency: "THB",
    rate_version: table.rateVersion,
    premiums,
    ...(plan_code === "LIFEPROTECT" ? { death_benefit: lifeProtectDeath(lifeProtectTable(), age, sum_assured) } : {}),
    ...(plan_code === "ISHIELD" ? { illness_benefit_baht: illnessBenefit(iShieldTable(), sum_assured) } : {}),
    note: "ราคาเบื้องต้นตามตารางที่ยังมีผล ใช้เงื่อนไขกรมธรรม์และการพิจารณารับประกันจริงเป็นหลัก",
  };
}
