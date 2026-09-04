import type { QuoteInput, QuoteResult } from "@/calc/types";
import { PAY_MODE_LABEL } from "@/calc/types";
import type { ModePremium } from "@/calc/mode-premiums";
import { formatBaht } from "@/calc/money";

const sexTh = (s: "M" | "F") => (s === "M" ? "ชาย" : "หญิง");

/** Names the ready-made arrangement a quote came from, e.g. `{ name: "มรดกเพื่อครอบครัว", tier: "มรดก 3 ล้าน" }`. */
export interface SummaryBundle {
  name: string;
  tier: string;
}

export interface SummaryOptions {
  bundle?: SummaryBundle;
  /**
   * Every payment mode priced. The customer asks what it costs a year and what it costs a
   * month in the same breath, so all three are quoted rather than only the one on screen.
   */
  modes?: ModePremium[];
}

export function summaryText(input: QuoteInput, result: QuoteResult, options: SummaryOptions = {}): string {
  const { bundle, modes } = options;
  const lines: string[] = [];
  if (bundle) lines.push(`ชุด${bundle.name} — ${bundle.tier}`);
  lines.push(result.items[0]?.name ?? `${result.meta.planName} ${input.variant}`);
  lines.push(bundle
    ? `เพศ${sexTh(input.sex)} อายุ ${input.age} ปี`
    : `เพศ${sexTh(input.sex)} อายุ ${input.age} ปี ชำระ${PAY_MODE_LABEL[input.mode]}`);
  if (input.basis === "premium") {
    lines.push(`เบี้ยที่ต้องการ ${(input.targetPremium ?? 0).toLocaleString("en-US")} บาท → ทุนประกัน ${result.sumAssured.toLocaleString("en-US")} บาท`);
  }
  for (const it of result.items) {
    const amount = it.amountLabel
      ? it.amountLabel
      : it.code === "MEB" || it.code === "MEX"
        ? `แผน ${it.amount.toLocaleString("en-US")}`
        : `ทุน ${it.amount.toLocaleString("en-US")} บาท`;
    // A bundle is priced as a whole, so its lines carry cover only — the totals follow below.
    if (bundle && it.eligible) {
      lines.push(`- ${it.name} ${amount}`);
      continue;
    }
    const value = it.eligible ? `${formatBaht(it.modal)} บาท` : (it.message ?? "-");
    lines.push(`- ${it.name} ${amount}: ${value}`);
  }
  const db = result.deathBenefit;
  if (db) {
    lines.push("ผลประโยชน์กรณีเสียชีวิต");
    if (db.alreadyPastAge) {
      lines.push(`- ทุกช่วงอายุ: ${db.sumFrom.toLocaleString("en-US")} บาท`);
    } else {
      lines.push(`- ก่อนอายุ ${db.beforeAge} ปี: ${db.sumBefore.toLocaleString("en-US")} บาท`);
      lines.push(`- อายุ ${db.beforeAge} ปีขึ้นไป: ${db.sumFrom.toLocaleString("en-US")} บาท`);
    }
  }
  const maturity = result.maturityBenefit;
  if (maturity) {
    lines.push("ผลประโยชน์ครบสัญญา");
    lines.push(`- ครบสัญญาอายุ ${maturity.age} ปี: ${maturity.amount.toLocaleString("en-US")} บาท`);
    if (maturity.survivalTotal !== undefined) {
      lines.push(`- เงินจ่ายคืนระหว่างสัญญา รวม: ${maturity.survivalTotal.toLocaleString("en-US")} บาท`);
      lines.push(`- รวมรับทั้งสิ้น: ${(maturity.total ?? 0).toLocaleString("en-US")} บาท`);
    }
  }
  if (modes) {
    lines.push("เบี้ยประกันที่ต้องชำระ");
    for (const m of modes) {
      const note = m.belowMinimum ? ` (ต่ำกว่าขั้นต่ำ ${result.meta.minMonthlyTotal.toLocaleString("en-US")} บาท)` : "";
      lines.push(`- ${PAY_MODE_LABEL[m.mode]}: ${formatBaht(m.total)} บาท${note}`);
    }
  } else {
    lines.push(`รวมเบี้ยต่องวด (${PAY_MODE_LABEL[input.mode]}): ${formatBaht(result.totalModal)} บาท`);
    lines.push(`รวมเบี้ยรายปี: ${formatBaht(result.totalAnnual)} บาท`);
  }
  // The mode list marks the monthly minimum beside the figure it belongs to, so the warning would repeat it.
  for (const w of result.warnings) {
    if (modes && w.code === "MIN_MONTHLY") continue;
    lines.push(`⚠ ${w.message}`);
  }
  return lines.join("\n");
}
