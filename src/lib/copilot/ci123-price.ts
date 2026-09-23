import { quote } from "@/calc/quote";
import { quoteModePremiums } from "@/calc/mode-premiums";
import { getBundle } from "@/calc/bundles/registry";
import { formatBaht } from "@/calc/money";
import type { QuoteInput } from "@/calc/types";
import { coverIn, peopleIn } from "@/lib/assistant/common";
import { cardPath } from "@/lib/card-link";
import { CI123_BUNDLE, ci123Stages } from "@/lib/ci123-table";
import { stagePays, sumWords } from "@/lib/ci123-cta";
import type { GuideItem } from "./guide";
import type { PriceReply } from "./price";

/**
 * CI 123 in the chat, from one message.
 *
 * It is a rider, so it cannot be priced on its own: the agency sells it as a set on the
 * smallest Life Protect+ 100 the company issues, and that set is what /ci123 prices. This
 * prices the same set through the same engine, so the chat and the page cannot disagree —
 * at any sum the rider takes, not only the seven the page offers, because a customer who
 * asks for a million and a half should be answered rather than steered.
 *
 * Nothing is assumed: without an age, a sex and a sum there is no premium, only the
 * question for whichever is missing.
 */

export const CI123_LABEL = "CI 123";

const NAMED = /\bci\s*-?\s*123\b|ซีไอ\s*123/i;

export function ci123NamedIn(text: string): boolean {
  return NAMED.test(text);
}

/**
 * The message with the product's name taken out.
 *
 * "CI123 ชาย 35" otherwise hands the person reader a 123 beside a sex word, and "ci 123 1 ล้าน"
 * a number beside a sum.
 */
function withoutName(text: string): string {
  return text.replace(new RegExp(NAMED.source, "gi"), " ");
}

/** Whether the message asks for a figure, rather than about the rider's rules. */
export function asksCi123Price(text: string): boolean {
  const said = withoutName(text);
  return /เบี้ย|ราคา|กี่บาท|ค่างวด|คิดให้|premium|เดือนละ|ปีละ/i.test(said)
    || peopleIn(said).length > 0
    || coverIn(said) !== undefined;
}

/** A whole question for a button, with the rider named so it arrives here again. */
function ask(parts: string[]): string {
  return [CI123_LABEL, ...parts].join(" ");
}

const SEX_WORD = { M: "ชาย", F: "หญิง" } as const;

export function priceCi123(text: string, today: Date = new Date()): PriceReply {
  const bundle = getBundle(CI123_BUNDLE)!;
  const tierSums = bundle.tiers.map((t) => t.riders[0].sumAssured!);
  const said = withoutName(text);
  const who = peopleIn(said)[0];
  const sum = coverIn(said);
  const person = who ? `${SEX_WORD[who.sex]} ${who.age}` : undefined;

  if (!who || sum === undefined) {
    const missing: string[] = [];
    if (!who) missing.push("อายุกับเพศ (เช่น “ชาย 35”)");
    if (sum === undefined) missing.push("ทุน CI 123 (5 แสน – 10 ล้าน เช่น “ทุน 1 ล้าน”)");
    // a button can only finish the question when the person is known: a sum is a choice,
    // an age is not, so the buttons offer sums and never invent somebody to price
    const guide: GuideItem[] = who
      ? [500_000, 1_000_000, 2_000_000].map((n) => ({ label: `ทุน ${sumWords(n)}`, ask: ask([person!, `ทุน ${sumWords(n)}`]) }))
      : [];
    return {
      priced: false,
      text: `คิดเบี้ย **${CI123_LABEL}** ให้ได้ครับ ขอเพิ่มอีกนิด:\n\n${missing.map((m) => `- ${m}`).join("\n")}`,
      ...(guide.length ? { guide } : {}),
    };
  }

  const input: QuoteInput = {
    planCode: bundle.planCode, variant: bundle.variant, age: who.age, sex: who.sex, mode: "annual",
    sumAssured: bundle.tiers[0].sumAssured, riders: [{ code: "CI123", sumAssured: sum }],
  };
  const result = quote(input, today);
  const blocking = result.warnings.filter((w) => w.level === "error" && w.code !== "MIN_MONTHLY");
  const refused = result.items.filter((i) => !i.eligible && !i.code.includes(":"));
  if (blocking.length || refused.length || result.totalAnnual <= 0) {
    const reasons = [...blocking.map((w) => w.message), ...refused.map((i) => `${i.name}: ${i.message ?? "ซื้อไม่ได้"}`)];
    return {
      priced: false,
      text: `**${CI123_LABEL}** ${person} ทุน ${sum.toLocaleString("en-US")} ยังคิดให้ไม่ได้ครับ\n\n`
        + (reasons.length ? reasons.map((r) => `- ${r}`).join("\n") : "- อยู่นอกช่วงที่รับประกัน")
        + `\n\nรับอายุแรกเกิด–75 ปี ทุน CI 123 ตั้งแต่ 100,000 ถึง 10 ล้านบาท`,
    };
  }

  const modes = quoteModePremiums(input, today) ?? [];
  const per = (m: string) => modes.find((x) => x.mode === m);
  const base = result.items.find((i) => i.code === bundle.variant)!;
  const rider = result.totalAnnual - base.annual;

  const lines = [
    `**${CI123_LABEL}** ทุน ${sum.toLocaleString("en-US")} บาท · ${SEX_WORD[who.sex]} อายุ ${who.age} ปี`,
    "",
    `💰 เบี้ย**ปีแรก** **${formatBaht(result.totalAnnual)} บาท/ปี**`,
  ];
  const half = per("semi");
  const monthly = per("monthly");
  if (half && !half.belowMinimum) lines.push(`ราย 6 เดือน ${formatBaht(half.total)} บาท`);
  if (monthly && !monthly.belowMinimum) lines.push(`รายเดือน ${formatBaht(monthly.total)} บาท`);
  lines.push(
    `(CI 123 ${formatBaht(rider)} + Life Protect+ 100 ทุน ${bundle.tiers[0].sumAssured.toLocaleString("en-US")} ${formatBaht(base.annual)})`,
    "",
    "🏥 ตรวจพบโรคร้ายแรง รับเงินก้อนตามระยะ",
    ...ci123Stages().map((s) => `- ${s.label} ${stagePays(s, sum).toLocaleString("en-US")} บาท`),
    "",
    "เบี้ยส่วน CI 123 คิดตามอายุจริง ปีถัดไปจะขยับขึ้นตามอายุครับ",
  );
  if (result.meta.expired) {
    lines.push(`⚠️ ตารางเบี้ยชุดนี้ (${result.meta.version}) หมดอายุ ${result.meta.expiresOn} แล้ว — ขอราคาปัจจุบันจากบริษัทก่อนใช้`);
  }
  lines.push(`ดูรายชื่อโรคและเบี้ยทุกทุนได้ที่ [หน้า CI 123](/ci123)`);

  // the picture exists for the seven sums the set is sold at; any other sum is answered in words
  const tier = tierSums.indexOf(sum) + 1;
  const cards = tier > 0
    ? [cardPath({ kind: "bundle", bundleCode: CI123_BUNDLE, tier, age: who.age, sex: who.sex, mode: "annual" })]
    : undefined;

  const guide: GuideItem[] = tierSums
    .filter((n) => n !== sum && [500_000, 1_000_000, 2_000_000, 5_000_000].includes(n))
    .slice(0, 3)
    .map((n) => ({ label: `ทุน ${sumWords(n)}`, ask: ask([person!, `ทุน ${sumWords(n)}`]) }));

  return { priced: true, text: lines.join("\n"), ...(cards ? { cards } : {}), guide };
}
