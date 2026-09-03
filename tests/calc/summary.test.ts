import { describe, it, expect } from "vitest";
import { quote } from "@/calc/quote";
import { summaryText } from "@/lib/summary";
import { getBundle } from "@/calc/bundles/registry";
import { bundleModePremiums, bundleQuoteInput, describeTier, quoteBundle } from "@/calc/bundles/quote";

describe("summaryText", () => {
  it("renders a compact Thai summary", () => {
    const input = { planCode: "PLB", variant: "PLB12", age: 35, sex: "M" as const, mode: "monthly" as const, sumAssured: 1_000_000,
      riders: [{ code: "AP", sumAssured: 1_000_000 }] };
    const text = summaryText(input, quote(input, new Date("2026-09-03")));
    expect(text).toBe([
      "Protection Life (PLB) PLB12",
      "เพศชาย อายุ 35 ปี ชำระรายเดือน",
      "- Protection Life (PLB) PLB12 ทุน 1,000,000 บาท: 492.30 บาท",
      "- สัญญาเพิ่มเติมอุบัติเหตุ (AP) ทุน 1,000,000 บาท: 270.00 บาท",
      "รวมเบี้ยต่องวด (รายเดือน): 762.30 บาท",
      "รวมเบี้ยรายปี: 8,470.00 บาท",
      "⚠ เบี้ยประกันภัยรายเดือนต่ำกว่า 1,000 บาท",
      "(ตารางเบี้ย A2026-1)",
    ].join("\n"));
  });

  it("answers a bundle in full: no payment mode chosen, no price per line, all three totals", () => {
    const bundle = getBundle("LEGACY_FAMILY")!;
    const who = { age: 40, sex: "F" as const, mode: "annual" as const };
    const input = bundleQuoteInput(bundle, 3, who)!;
    const result = quoteBundle(bundle, 3, who, new Date("2026-09-04"))!;
    const text = summaryText(input, result, {
      name: bundle.name,
      tier: describeTier(bundle, 3)!,
      modes: bundleModePremiums(bundle, 3, { age: 40, sex: "F" }, new Date("2026-09-04"))!,
    });
    expect(text).toBe([
      "ชุดมรดกเพื่อครอบครัว — มรดก 3 ล้าน",
      "Life Protect+ 100 — ชำระเบี้ยครบอายุ 99 ปี",
      "เพศหญิง อายุ 40 ปี",
      "- Life Protect+ 100 — ชำระเบี้ยครบอายุ 99 ปี ทุน 150,000 บาท",
      "- สัญญาเพิ่มเติมโรคร้ายแรง (DCI) ทุน 2,850,000 บาท",
      "ผลประโยชน์กรณีเสียชีวิต",
      "- ก่อนอายุ 60 ปี: 3,150,000 บาท",
      "- อายุ 60 ปีขึ้นไป: 3,000,000 บาท",
      "เบี้ยประกันที่ต้องชำระ",
      "- รายปี: 15,112.50 บาท",
      "- ราย 6 เดือน: 7,858.50 บาท",
      "- รายเดือน: 1,360.12 บาท",
      "(ตารางเบี้ย A2026-1)",
    ].join("\n"));
  });

  it("marks the mode a bundle cannot be paid in", () => {
    const bundle = getBundle("LEGACY_FAMILY")!;
    const who = { age: 20, sex: "M" as const, mode: "annual" as const };
    const text = summaryText(
      bundleQuoteInput(bundle, 1, who)!,
      quoteBundle(bundle, 1, who, new Date("2026-09-04"))!,
      { name: bundle.name, tier: describeTier(bundle, 1)!, modes: bundleModePremiums(bundle, 1, { age: 20, sex: "M" }, new Date("2026-09-04"))! },
    );
    expect(text).toContain("- รายเดือน: 321.52 บาท (ต่ำกว่าขั้นต่ำ 1,000 บาท)");
  });
});
