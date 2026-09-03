import type { QuoteInput, QuoteResult } from "@/calc/types";
import { PAY_MODE_LABEL } from "@/calc/types";
import { formatBaht } from "@/calc/money";

const sexTh = (s: "M" | "F") => (s === "M" ? "ชาย" : "หญิง");

export function summaryText(input: QuoteInput, result: QuoteResult): string {
  const lines: string[] = [];
  lines.push(result.items[0]?.name ?? `${result.meta.planName} ${input.variant}`);
  lines.push(`เพศ${sexTh(input.sex)} อายุ ${input.age} ปี ชำระ${PAY_MODE_LABEL[input.mode]}`);
  if (input.basis === "premium") {
    lines.push(`เบี้ยที่ต้องการ ${(input.targetPremium ?? 0).toLocaleString("en-US")} บาท → ทุนประกัน ${result.sumAssured.toLocaleString("en-US")} บาท`);
  }
  for (const it of result.items) {
    const amount = it.amountLabel
      ? it.amountLabel
      : it.code === "MEB" || it.code === "MEX"
        ? `แผน ${it.amount.toLocaleString("en-US")}`
        : `ทุน ${it.amount.toLocaleString("en-US")} บาท`;
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
  lines.push(`รวมเบี้ยต่องวด (${PAY_MODE_LABEL[input.mode]}): ${formatBaht(result.totalModal)} บาท`);
  lines.push(`รวมเบี้ยรายปี: ${formatBaht(result.totalAnnual)} บาท`);
  for (const w of result.warnings) lines.push(`⚠ ${w.message}`);
  return lines.join("\n");
}
