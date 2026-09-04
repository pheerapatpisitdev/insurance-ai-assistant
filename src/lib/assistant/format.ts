import type { PayMode, QuoteInput, QuoteResult } from "@/calc/types";
import type { ModePremium } from "@/calc/mode-premiums";
import { cashValueHighlights, cashValueSchedule, maturityValue } from "@/calc/cash-value";

const SEX_TH = { M: "ชาย", F: "หญิง" } as const;
const MODE_NOUN = { annual: "รายปี", semi: "ราย 6 เดือน", monthly: "รายเดือน" } as const;

/** Satang to baht, dropping the decimals when there are none to show. */
export function baht(satang: number): string {
  const whole = Math.trunc(satang / 100);
  const cents = satang % 100;
  const head = whole.toLocaleString("en-US");
  return cents === 0 ? head : `${head}.${String(cents).padStart(2, "0")}`;
}

/**
 * A chat answer is read on a phone, so it says the premium once and drops everything the
 * reader can already see. The calculator's copy button keeps its own fuller wording, which
 * is meant to be pasted into a proposal.
 */
export function quoteReply(input: QuoteInput, result: QuoteResult): string {
  const blocks: string[] = [];
  const planName = result.items[0]?.name ?? result.meta.planName;

  const head = [planName, `${SEX_TH[input.sex]} ${input.age} ปี · ทุน ${result.sumAssured.toLocaleString("en-US")} บาท`];
  blocks.push(head.join("\n"));

  // annual is both the premium per instalment and the year's total, so it is said once
  const total = input.mode === "annual"
    ? `เบี้ยรายปี ${baht(result.totalModal)} บาท`
    : `เบี้ย${MODE_NOUN[input.mode]} ${baht(result.totalModal)} บาท (รวมทั้งปี ${baht(result.totalAnnual)} บาท)`;
  blocks.push(total);

  // the breakdown only earns its space when more than one contract makes up that number
  const priced = result.items.filter((it) => it.eligible && it.annual > 0);
  if (priced.length > 1) {
    blocks.push(priced.map((it) => `- ${it.name} ${baht(it.modal)} บาท`).join("\n"));
  }

  const db = result.deathBenefit;
  if (db) {
    blocks.push(db.alreadyPastAge
      ? `กรณีเสียชีวิต (ขั้นต่ำ) ${db.sumFrom.toLocaleString("en-US")} บาท`
      : `กรณีเสียชีวิต (ขั้นต่ำ)\n- ก่อนอายุ ${db.beforeAge} ปี ${db.sumBefore.toLocaleString("en-US")} บาท\n- อายุ ${db.beforeAge} ปีขึ้นไป ${db.sumFrom.toLocaleString("en-US")} บาท`);
  }

  const schedule = cashValueSchedule(input.planCode, input.variant, input.sex, input.age, result.sumAssured);
  const highlights = cashValueHighlights(schedule);
  if (highlights.length) {
    blocks.push(["มูลค่าเวนคืน (ณ สิ้นปีกรมธรรม์)",
      ...highlights.map((r) => `- อายุ ${r.age} ปี ${r.amount.toLocaleString("en-US")} บาท`)].join("\n"));
  }
  const maturity = maturityValue(schedule);
  if (maturity) blocks.push(`อยู่ครบสัญญา อายุ ${maturity.age} ปี รับ ${maturity.amount.toLocaleString("en-US")} บาท`);

  const notes = result.warnings.map((w) => `⚠ ${w.message}`);
  if (notes.length) blocks.push(notes.join("\n"));

  return blocks.join("\n\n");
}

/**
 * The footer carries the disclaimer and at most one invitation, because a phone screen full
 * of "you could also ask for..." buries the number the customer wanted. An amount nobody
 * asked for outranks the others: quoting the plan's minimum without saying so lets a
 * customer read a ten-million figure as the one they requested.
 */
export function quoteFooter(assumedTerm: boolean, assumedAmount: boolean, mode: QuoteInput["mode"]): string {
  const hint = assumedAmount
    ? "คิดจากทุนประกันขั้นต่ำของแบบนี้ ถ้าต้องการทุนอื่น บอกได้ครับ"
    : assumedTerm
      ? "อยากได้ระยะเวลาชำระเบี้ยแบบอื่น บอกได้ครับ"
      : mode === "annual"
        ? "อยากดูแบบราย 6 เดือน หรือรายเดือน บอกได้ครับ"
        : null;
  return ["เบี้ยประมาณการจากตารางเบี้ยบริษัท ไม่ใช่ใบเสนอราคา", hint]
    .filter(Boolean)
    .map((l) => `· ${l}`)
    .join("\n");
}

/** One line per document, with each page mentioned once however many passages came from it. */
export function citationLine(sources: { title: string; page: number | null }[]): string {
  const byDoc = new Map<string, Set<number>>();
  for (const s of sources) {
    const pages = byDoc.get(s.title) ?? new Set<number>();
    if (s.page) pages.add(s.page);
    byDoc.set(s.title, pages);
  }
  const parts = [...byDoc].map(([title, pages]) =>
    pages.size ? `${title} หน้า ${[...pages].sort((a, b) => a - b).join(", ")}` : title);
  return `ที่มา: ${parts.join(" · ")}`;
}

const MODE_LINE: Record<PayMode, string> = { annual: "รายปี", semi: "ราย 6 เดือน", monthly: "รายเดือน" };

/**
 * A bundle is quoted whole and in all three payment modes at once, because someone choosing
 * a legacy plan asks what it costs a year and what it costs a month in the same breath. The
 * cover is itemised by sum assured rather than by premium: the parts are not sold separately,
 * so a price per line would invite picking the arrangement apart.
 */
export function bundleReply(
  bundleName: string, tierName: string, insured: { age: number; sex: QuoteInput["sex"] },
  result: QuoteResult, modes: ModePremium[] | undefined,
): string {
  const blocks: string[] = [
    `ชุด${bundleName} — ${tierName}\n${SEX_TH[insured.sex]} ${insured.age} ปี`,
  ];

  if (modes) {
    blocks.push(modes.map((m) => {
      const note = m.belowMinimum ? " (ต่ำกว่าขั้นต่ำที่ชำระรายเดือนได้)" : "";
      return `${MODE_LINE[m.mode]} ${baht(m.total)} บาท${note}`;
    }).join("\n"));
  } else {
    blocks.push(`เบี้ยรายปี ${baht(result.totalAnnual)} บาท`);
  }

  const covered = result.items.filter((it) => it.eligible);
  if (covered.length) {
    blocks.push(["ความคุ้มครอง",
      ...covered.map((it) => `- ${it.name} ทุน ${it.amount.toLocaleString("en-US")} บาท`)].join("\n"));
  }

  const db = result.deathBenefit;
  if (db) {
    blocks.push(db.alreadyPastAge
      ? `กรณีเสียชีวิต (ขั้นต่ำ) ${db.sumFrom.toLocaleString("en-US")} บาท`
      : `กรณีเสียชีวิต (ขั้นต่ำ)\n- ก่อนอายุ ${db.beforeAge} ปี ${db.sumBefore.toLocaleString("en-US")} บาท\n- อายุ ${db.beforeAge} ปีขึ้นไป ${db.sumFrom.toLocaleString("en-US")} บาท`);
  }

  // a bundle that cannot be issued whole carries its refusal here rather than a premium
  for (const w of result.warnings.filter((x) => x.level === "error" && x.code !== "MIN_MONTHLY")) {
    blocks.push(`⚠ ${w.message}`);
  }

  blocks.push("· เบี้ยประมาณการจากตารางเบี้ยบริษัท ไม่ใช่ใบเสนอราคา");
  return blocks.join("\n\n");
}
