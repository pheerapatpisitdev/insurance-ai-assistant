import { peopleIn, coverIn } from "@/lib/assistant/common";
import {
  availablePensionAges, MODE_FACTOR, PENSION_AGES, quotePension,
  type PensionBasis, type PensionMode, type PensionPay,
} from "@/calc/pension/engine";
import type { GuideItem } from "./guide";
import type { PriceReply } from "./price";

/**
 * บำนาญ สมาร์ท 95 in the chat, from one message.
 *
 * It cannot go through ./price, because that file asks every plan for a sum and this one is
 * mostly asked for an income: "อยากได้เดือนละ 10,000 ตอน 60". So it reads three things the
 * others never need — which age the pension starts, whether the premiums run six years or
 * until then, and whether the figure given is a pension, a premium or a sum — and prices
 * through the same engine as the /bumnan95 page, so the two cannot disagree.
 *
 * Nothing is assumed. The paying term alone moves the premium several times over, and a
 * figure quoted on a guessed term arrives looking exactly like a right one.
 */

export const PENSION_LABEL = "บำนาญ สมาร์ท 95";

/** "บำนาญ", "บำนาญ สมาร์ท 95", "smart 95", "pension". */
const NAMED = /บำนาญ|pension|สมาร์ท\s*95|smart\s*95/i;

export function pensionNamedIn(text: string): boolean {
  return NAMED.test(text);
}

/**
 * The message with the product's name taken out.
 *
 * "บำนาญ 95 ชาย 40" otherwise reads as a ninety-five-year-old man — the person reader pairs a
 * number with the sex word beside it and the product's own number is the nearer one.
 */
function withoutName(text: string): string {
  return text
    .replace(/(?:บำนาญ\s*)?(?:สมาร์ท|smart)\s*95(?:\s*\/\s*\d{1,2})?(?:\s*A\d{2})?/gi, " ")
    .replace(/บำนาญ\s*95(?:\s*\/\s*\d{1,2})?/g, "บำนาญ ");
}

/** 10,000 · 10000 · 1 หมื่น · 1.5 หมื่น · 5 พัน · 2 แสน */
const AMOUNT = String.raw`(\d+(?:\.\d+)?)\s*(หมื่น|พัน|แสน|ล้าน)|(\d[\d,]*)`;
const UNIT: Record<string, number> = { พัน: 1_000, หมื่น: 10_000, แสน: 100_000, ล้าน: 1_000_000 };

function amountOf(m: RegExpMatchArray, at: number): number {
  return m[at] ? Number(m[at]) * UNIT[m[at + 1]] : Number(m[at + 2].replace(/,/g, ""));
}

interface Asked { basis: PensionBasis; amount: number; mode: PensionMode }

/**
 * Which of the three figures the message gave.
 *
 * A premium first, because it is the only one of them written with จ่าย in front: "จ่ายเดือน
 * ละ 5,000" is an instalment, "ได้เดือนละ 10,000" is a pension. After that a bare "เดือนละ"
 * is a pension, since that is what this plan is bought for; and a sum is last.
 */
function figureIn(said: string): Asked | undefined {
  const premium = said.match(new RegExp(String.raw`(?:จ่าย|ชำระ|ผ่อน)(?:ได้)?\s*(?:เบี้ย)?\s*(เดือน|ปี)ละ\s*(?:${AMOUNT})`))
    ?? said.match(new RegExp(String.raw`เบี้ย\s*(ปี|เดือน)ละ\s*(?:${AMOUNT})`));
  if (premium) {
    return { basis: "premium", amount: amountOf(premium, 2), mode: premium[1] === "เดือน" ? "monthly" : "annual" };
  }
  const pension = said.match(new RegExp(String.raw`เดือนละ\s*(?:${AMOUNT})`))
    ?? said.match(new RegExp(String.raw`(?:${AMOUNT})\s*(?:บาท)?\s*(?:ต่อ|\/)\s*เดือน`));
  if (pension) return { basis: "monthlyPension", amount: amountOf(pension, 1), mode: "annual" };
  const sum = coverIn(said);
  return sum === undefined ? undefined : { basis: "sumAssured", amount: sum, mode: "annual" };
}

/** "รับบำนาญ 60", "เริ่มรับตอนอายุ 65", "เกษียณ 55", "95/60". */
function pensionAgeIn(text: string): { age: number; rest: string } | undefined {
  const res = [
    // "ตอนนี้อายุ 55" is the person's age, not the pension's
    /(?:รับ|เริ่ม|เกษียณ|ตอน(?!นี้))[^\d]{0,20}?(55|60|65|70)(?!\d)/,
    /95\s*\/\s*(?:6\s*A)?(55|60|65|70)(?!\d)/,
    /(?:A|a)(55|60|65|70)(?!\d)/,
  ];
  for (const re of res) {
    const m = text.match(re);
    if (m) return { age: Number(m[1]), rest: text.replace(m[0], " ") };
  }
  return undefined;
}

function payIn(text: string): PensionPay | undefined {
  if (/(?:จ่าย|ชำระ|ผ่อน)\s*(?:เบี้ย)?\s*6\s*ปี|95\s*\/\s*6/.test(text)) return "6";
  if (/จน(?:ถึง)?(?:อายุ)?\s*(?:รับ|เกษียณ)|ถึงอายุรับบำนาญ|ตลอด|ทุกปีจน/.test(text)) return "untilAnnuity";
  return undefined;
}

const floorBaht = (n: number) => Math.floor(n).toLocaleString("en-US");
const rdown2 = (x: number) => Math.floor(x * 100 + 1e-9) / 100;

/** A whole question for a button, with the plan named so it arrives here again. */
function ask(parts: string[]): string {
  return [PENSION_LABEL, ...parts].join(" ");
}

/** Whether the message is a pricing question at all, rather than one about the plan's rules. */
export function asksPensionPrice(text: string): boolean {
  const said = withoutName(text);
  return /เบี้ย|ราคา|กี่บาท|คิดให้|premium|เดือนละ|ปีละ/i.test(said)
    || peopleIn(said).length > 0
    || figureIn(said) !== undefined;
}

export function pricePension(text: string): PriceReply {
  const cleaned = withoutName(text);
  const at = pensionAgeIn(cleaned);
  const said = at?.rest ?? cleaned;
  const who = peopleIn(said)[0];
  const figure = figureIn(said);
  const pay = payIn(cleaned);

  // what was given, carried on every button so pressing one does not lose the rest
  const given = [
    ...(who ? [`${who.sex === "F" ? "หญิง" : "ชาย"} ${who.age}`] : []),
    ...(at ? [`รับบำนาญ ${at.age}`] : []),
    ...(pay === "6" ? ["จ่าย 6 ปี"] : pay ? ["จ่ายจนรับบำนาญ"] : []),
    ...(figure ? [figure.basis === "monthlyPension" ? `เดือนละ ${figure.amount.toLocaleString("en-US")}`
      : figure.basis === "premium" ? `จ่าย${figure.mode === "monthly" ? "เดือน" : "ปี"}ละ ${figure.amount.toLocaleString("en-US")}`
        : `ทุน ${figure.amount.toLocaleString("en-US")}`] : []),
  ];

  const missing: string[] = [];
  const guide: GuideItem[] = [];
  if (!who) missing.push("อายุกับเพศ (เช่น “ชาย 40”)");
  if (!figure) {
    missing.push("อยากได้บำนาญเดือนละเท่าไหร่ (เช่น “เดือนละ 10,000”) หรือจ่ายเบี้ยได้ปีละเท่าไหร่ หรือทุนประกัน");
    if (who) for (const n of [10_000, 20_000]) guide.push({ label: `เดือนละ ${n.toLocaleString("en-US")}`, ask: ask([...given, `เดือนละ ${n.toLocaleString("en-US")}`]) });
  }
  const ages = who ? availablePensionAges(who.age, pay ?? "untilAnnuity") : PENSION_AGES;
  if (!at) {
    missing.push(`เริ่มรับบำนาญอายุเท่าไหร่ — เลือกได้ ${ages.join(" · ")}`);
    if (who && figure) for (const a of ages) guide.push({ label: `รับบำนาญอายุ ${a}`, ask: ask([...given, `รับบำนาญ ${a}`]) });
  }
  if (!pay) {
    missing.push("จ่ายเบี้ยแบบไหน — 6 ปี หรือ จ่ายทุกปีจนถึงอายุรับบำนาญ");
    if (who && figure && at) {
      guide.push({ label: "จ่ายเบี้ย 6 ปี", ask: ask([...given, "จ่าย 6 ปี"]) });
      guide.push({ label: "จ่ายจนรับบำนาญ", ask: ask([...given, "จ่ายจนรับบำนาญ"]) });
    }
  }
  if (missing.length) {
    return {
      priced: false,
      text: `คิดเบี้ย **${PENSION_LABEL}** ให้ได้ครับ ขอเพิ่มอีกนิด:\n\n${missing.map((m) => `- ${m}`).join("\n")}`,
      ...(guide.length ? { guide } : {}),
    };
  }

  const result = quotePension({
    age: who!.age, sex: who!.sex, annuityAge: at!.age, pay: pay!, mode: figure!.mode, basis: figure!.basis, amount: figure!.amount,
  });
  if (!result.ok) {
    return {
      priced: false,
      text: `แบบ **${PENSION_LABEL}** ยังคิดให้ไม่ได้ด้วยเงื่อนไขนี้ครับ\n\n- ${result.error}\n\nลองปรับดู หรือใช้ [เครื่องคิดบำนาญ](/bumnan95)`,
    };
  }
  const q = result.quote;
  const first = q.bands[0];
  const lastBand = q.bands[q.bands.length - 1];
  const payWords = pay === "6" ? "ชำระเบี้ย 6 ปี" : `ชำระเบี้ยจนถึงอายุ ${q.plan.annuityStartAge} (${q.payYears} ปี)`;
  const lines = [
    `**${PENSION_LABEL}** · รับบำนาญอายุ ${q.plan.annuityStartAge}–95 · ${payWords}`,
    `${who!.sex === "F" ? "หญิง" : "ชาย"} อายุ ${who!.age} ปี · ทุน ${q.sumAssured.toLocaleString("en-US")} บาท`,
    "",
    `💰 เบี้ยปีละ **${floorBaht(q.annualPremium)} บาท**`,
    `ราย 6 เดือน ${floorBaht(rdown2(q.annualPremium * MODE_FACTOR.semi))} บาท`,
    `รายเดือน ${floorBaht(rdown2(q.annualPremium * MODE_FACTOR.monthly))} บาท`,
    "",
    `🎁 บำนาญช่วงแรก เดือนละ **${q.monthlyPension.toLocaleString("en-US")} บาท** (หรือปีละ ${first.annual.toLocaleString("en-US")}) อายุ ${first.fromAge}–${first.toAge}`,
    `เพิ่มเป็นปีละ ${lastBand.annual.toLocaleString("en-US")} บาท ตั้งแต่อายุ ${lastBand.fromAge} · รับประกันจ่าย 15 ปีแรก`,
    `รวมรับบำนาญถึงอายุ 95 ประมาณ ${q.totalPension.toLocaleString("en-US")} บาท จากเบี้ยรวม ${floorBaht(q.totalPremium)} บาท`,
    "",
    "เบี้ยใช้ลดหย่อนภาษีได้ตามเกณฑ์สรรพากร · ดูตารางรายปีและคำนวณภาษีได้ที่ [เครื่องคิดบำนาญ](/bumnan95)",
    "เบี้ยมาตรฐาน ตารางเวอร์ชัน A2026-1 · อาจต่างไปตามผลพิจารณารับประกัน · ยังไม่รวมสัญญาเพิ่มเติม",
  ];
  const others = availablePensionAges(who!.age, pay!).filter((a) => a !== q.plan.annuityStartAge);
  const keep = given.filter((g) => !g.startsWith("รับบำนาญ"));
  return {
    priced: true,
    text: lines.join("\n"),
    guide: [
      ...others.map((a) => ({ label: `ถ้ารับบำนาญอายุ ${a}`, ask: ask([...keep, `รับบำนาญ ${a}`]) })),
      pay === "6"
        ? { label: "ถ้าจ่ายจนรับบำนาญ", ask: ask([...given.filter((g) => g !== "จ่าย 6 ปี"), "จ่ายจนรับบำนาญ"]) }
        : { label: "ถ้าจ่ายเบี้ย 6 ปี", ask: ask([...given.filter((g) => g !== "จ่ายจนรับบำนาญ"), "จ่าย 6 ปี"]) },
    ],
  };
}
