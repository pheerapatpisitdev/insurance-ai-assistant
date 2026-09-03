import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { quote } from "@/calc/quote";
import type { PayMode, Sex, RiderInput, QuoteInput } from "@/calc/types";

type RawRiders = Record<string, number | string | [string, number] | [string, string, string] | undefined>;
interface GoldenCase {
  input: { variant: string; age: number; sex: string; mode: string; sumAssured: number; payer?: { age: number; sex: Sex }; riders: RawRiders };
  expected: { sumAssured: number; modal: Record<string, unknown>; annual: Record<string, unknown>; totalModal: unknown; monthlyBelowMinimum: boolean };
}
interface Golden { source: string; cases: GoldenCase[] }

/** The workbook shows a text message (or #N/A) instead of a number when a rider is excluded; treat text as 0. */
const satang = (v: unknown) => (typeof v === "number" ? Math.round(v * 100) : 0);

function toInput(planCode: string, c: GoldenCase["input"]): QuoteInput {
  const r = c.riders;
  const riders: RiderInput[] = [];
  if (typeof r.PB === "string") riders.push({ code: "PB", option: r.PB });
  if (typeof r.WP === "string") riders.push({ code: "WP", option: r.WP });
  for (const code of ["AP", "ECARE", "DCI", "CPR", "HIC", "CI123"]) {
    if (typeof r[code] === "number") riders.push({ code, sumAssured: r[code] as number });
  }
  if (typeof r.MEX === "string") riders.push({ code: "MEX", option: r.MEX });
  if (typeof r.MEB === "number") riders.push({ code: "MEB", plan: r.MEB });
  if (Array.isArray(r.PLS)) riders.push({ code: "PLS", option: r.PLS[0], sumAssured: r.PLS[1] as number });
  if (Array.isArray(r.IHU)) riders.push({ code: "IHU", option: r.IHU[0], territory: r.IHU[1] as string, coverage: r.IHU[2] as string });
  if (typeof r.RRSS === "string") riders.push({ code: "RRSS", option: r.RRSS });
  return { planCode, variant: c.variant, age: c.age, sex: c.sex as Sex, mode: c.mode as PayMode, sumAssured: c.sumAssured, payer: c.payer, riders };
}

const CODES = ["PB", "WP", "AP", "ECARE", "MEX", "MEB", "DCI", "PLS", "CPR", "HIC", "IHU", "RRSS"];

for (const [file, planCode] of [["ismart", "ISMART"], ["lifetreasure", "LIFETREASURE"], ["lifeprotect", "LIFEPROTECT"]] as const) {
  const path = join(__dirname, `${file}.json`);
  const present = existsSync(path);
  const golden: Golden = present ? JSON.parse(readFileSync(path, "utf8")) : { source: "missing", cases: [] };

  describe.skipIf(!present)(`golden vs Excel ${planCode} (${golden.source})`, () => {
    golden.cases.forEach((c, i) => {
      it(`case ${i}: ${JSON.stringify(c.input)}`, () => {
        const r = quote(toInput(planCode, c.input), new Date("2026-09-03"));
        const by = Object.fromEntries(r.items.map((it) => [it.code === c.input.variant ? "BASE" : it.code, it]));
        expect(r.sumAssured, "sum assured used").toBe(c.expected.sumAssured);
        expect(by.BASE.modal, "BASE modal").toBe(satang(c.expected.modal.BASE));
        expect(by.BASE.annual, "BASE annual").toBe(satang(c.expected.annual.BASE));
        for (const code of CODES) expect(by[code]?.modal ?? 0, `${code} modal`).toBe(satang(c.expected.modal[code]));
        // CI 123: the workbook shows the main benefit and three endorsements on four rows
        const ciRows = r.items.filter((it) => it.code.startsWith("CI123"));
        const ciModal = ciRows.reduce((s, it) => s + it.modal, 0);
        const expCi = ["CI123", "CI123_1", "CI123_2", "CI123_3"].reduce((s, k) => s + satang(c.expected.modal[k]), 0);
        expect(ciModal, "CI123 modal (all rows)").toBe(expCi);
        expect(r.totalModal, "total modal").toBe(satang(c.expected.totalModal));
        expect(r.warnings.some((w) => w.code === "MIN_MONTHLY"), "MIN_MONTHLY warning").toBe(c.expected.monthlyBelowMinimum);
      });
    });
  });
}
