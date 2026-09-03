import { describe, it, expect } from "vitest";
import { quote } from "@/calc/quote";
import golden from "./ishield.json";
import type { PayMode, Sex, RiderInput, QuoteInput } from "@/calc/types";

type Case = (typeof golden)["cases"][number];
type RawRiders = Record<string, number | string | [string, number] | undefined>;

function toInput(c: Case["input"]): QuoteInput {
  const riders: RiderInput[] = [];
  const r = c.riders as RawRiders;
  if (typeof r.PB === "string") riders.push({ code: "PB", option: r.PB });
  if (typeof r.AP === "number") riders.push({ code: "AP", sumAssured: r.AP });
  if (typeof r.ECARE === "number") riders.push({ code: "ECARE", sumAssured: r.ECARE });
  if (typeof r.MEB === "number") riders.push({ code: "MEB", plan: r.MEB });
  if (Array.isArray(r.PLS)) riders.push({ code: "PLS", option: r.PLS[0], sumAssured: r.PLS[1] });
  const x = c as Record<string, unknown>;
  return {
    planCode: "ISHIELD", variant: c.variant, age: c.age, sex: c.sex as Sex, mode: c.mode as PayMode,
    sumAssured: (x.sumAssured as number | undefined) ?? 0,
    basis: x.basis as "premium" | undefined,
    targetPremium: x.targetPremium as number | undefined,
    payer: x.payer as { age: number; sex: Sex } | undefined,
    riders,
  };
}

/** Excel shows a text message (or #N/A) instead of a number when a rider is excluded; treat text as 0. */
function satang(v: unknown): number {
  return typeof v === "number" ? Math.round(v * 100) : 0;
}

describe(`golden vs Excel iShield (${golden.source})`, () => {
  golden.cases.forEach((c, i) => {
    it(`case ${i}: ${JSON.stringify(c.input)}`, () => {
      const r = quote(toInput(c.input), new Date("2026-09-03"));
      const by = Object.fromEntries(r.items.map((it) => [it.code === c.input.variant ? "BASE" : it.code, it]));
      const modal = c.expected.modal as Record<string, unknown>;
      const annual = c.expected.annual as Record<string, unknown>;
      expect(r.sumAssured, "sum assured used").toBe(typeof c.expected.sumAssured === "number" ? c.expected.sumAssured : 0);
      expect(by.BASE.modal, "BASE modal").toBe(satang(modal.BASE));
      expect(by.BASE.annual, "BASE annual").toBe(satang(annual.BASE));
      for (const code of ["PB", "AP", "ECARE", "MEB", "PLS"]) {
        expect(by[code]?.modal ?? 0, `${code} modal`).toBe(satang(modal[code]));
      }
      expect(r.totalModal, "total modal").toBe(satang(c.expected.totalModal));
      const excelSaysLow = typeof c.expected.monthlyMessage === "string" && c.expected.monthlyMessage.length > 0;
      expect(r.warnings.some((w) => w.code === "MIN_MONTHLY"), "MIN_MONTHLY warning").toBe(excelSaysLow);
    });
  });
});
