import { describe, it, expect } from "vitest";
import { quote } from "@/calc/quote";
import golden from "./plb.json";
import type { PayMode, Sex, RiderInput } from "@/calc/types";

type Case = (typeof golden)["cases"][number];

function toInput(c: Case["input"]) {
  const riders: RiderInput[] = [];
  const r = c.riders as Record<string, number | undefined>;
  if (r.AP !== undefined) riders.push({ code: "AP", sumAssured: r.AP });
  if (r.ECARE !== undefined) riders.push({ code: "ECARE", sumAssured: r.ECARE });
  if (r.MEB !== undefined) riders.push({ code: "MEB", plan: r.MEB });
  return { planCode: "PLB", variant: c.variant, age: c.age, sex: c.sex as Sex, mode: c.mode as PayMode, sumAssured: c.sumAssured, riders };
}

/** Excel shows a text message (or #N/A) instead of a number when a rider is excluded; treat text as 0. */
function satang(v: unknown): number {
  return typeof v === "number" ? Math.round(v * 100) : 0;
}

describe(`golden vs Excel (${golden.source})`, () => {
  golden.cases.forEach((c, i) => {
    it(`case ${i}: ${c.input.variant} ${c.input.sex} ${c.input.age} ${c.input.mode} SA ${c.input.sumAssured} riders ${JSON.stringify(c.input.riders)}`, () => {
      const r = quote(toInput(c.input), new Date("2026-09-03"));
      const by = Object.fromEntries(r.items.map((it) => [it.code === c.input.variant ? "BASE" : it.code, it]));
      const modal = c.expected.modal as Record<string, unknown>;
      const annual = c.expected.annual as Record<string, unknown>;
      expect(by.BASE.modal, "BASE modal").toBe(satang(modal.BASE));
      expect(by.BASE.annual, "BASE annual").toBe(satang(annual.BASE));
      for (const code of ["AP", "ECARE", "MEB"]) {
        expect(by[code]?.modal ?? 0, `${code} modal`).toBe(satang(modal[code]));
      }
      expect(r.totalModal, "total modal").toBe(satang(c.expected.totalModal));
      const excelSaysLow = typeof c.expected.monthlyMessage === "string" && c.expected.monthlyMessage.length > 0;
      expect(r.warnings.some((w) => w.code === "MIN_MONTHLY"), "MIN_MONTHLY warning").toBe(excelSaysLow);
    });
  });
});
