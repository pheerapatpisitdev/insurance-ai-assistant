import type { ModePremium } from "@/calc/mode-premiums";
import type { DeathBenefit, PayMode, Sex } from "@/calc/types";
import { PAY_MODE_LABEL } from "@/calc/types";
import { formatBaht } from "@/calc/money";
import { PER, perDay } from "@/lib/legacy-cta";
import { deathBenefitRows } from "@/lib/death-benefit";
import type { CashRow } from "@/lib/lifeprotect-quote";

/** The age picker's value: an age the plan takes, or "over" for everyone past its last. */
export type LifeProtectAge = number | "over";

export interface LifeProtectCtaFacts {
  sumAssured: number;
  /** the term as the button words it, e.g. "จ่าย 19 ปี" */
  termLabel: string;
  age: LifeProtectAge;
  sex: Sex;
  /** the last age the plan issues at, named in the message an older customer sends */
  ageMax: number;
  /** the instalment on the card, or undefined when no price is being shown */
  premium: ModePremium | undefined;
}

const SEX_WORD: Record<Sex, string> = { M: "ชาย", F: "หญิง" };

/** Age zero is a newborn, not "0 ปี", everywhere a person reads it. */
export function ageWord(age: number): string {
  return age === 0 ? "แรกเกิด" : String(age);
}

/**
 * What the customer's chat opens with, so whoever answers starts from the figures already
 * on screen.
 */
export function lifeProtectMessage(f: LifeProtectCtaFacts): string {
  const head = `สนใจ Life Protect+ 100 ทุน ${f.sumAssured.toLocaleString("en-US")}`;
  if (f.age === "over") return `${head} อายุเกิน ${f.ageMax} ปี ขอแบบที่เหมาะกับอายุนี้`;
  const who = `${head} ${f.termLabel} อายุ${f.age === 0 ? "" : " "}${ageWord(f.age)} ${SEX_WORD[f.sex]}`;
  if (!f.premium) return `${who} ขอราคาปัจจุบัน`;
  return `${who} เบี้ยประมาณ ${formatBaht(f.premium.total)} บาท${PER[f.premium.mode]}`;
}

export interface LifeProtectQuoteFacts {
  sumAssured: number;
  termLabel: string;
  age: number;
  sex: Sex;
  /** every instalment the company will take, headline first */
  modes: ModePremium[];
  death: DeathBenefit;
  cash: CashRow[];
}

/**
 * The quote as the agent pastes it into a chat: every figure the card shows, in the order
 * the card shows it, so what the customer reads in the chat is what they saw on the page.
 */
export function lifeProtectQuoteText(f: LifeProtectQuoteFacts): string {
  const [headline] = f.modes;
  const annual = f.modes.find((m) => m.mode === "annual");
  const baht = (n: number) => n.toLocaleString("en-US");
  // the doubled sum is the plan's pitch, so it sits with the sum — unless the insured is
  // already past the age it stops at, when there is no doubling to promise
  const sum = f.death.alreadyPastAge
    ? `ทุน ${baht(f.sumAssured)} บาท`
    : `ทุน ${baht(f.sumAssured)} บาท เพิ่มเป็น ${baht(f.death.sumBefore)} ถึงอายุ ${f.death.beforeAge}`;
  const lines = [
    "Life Protect+ 100",
    sum,
    "",
    `${SEX_WORD[f.sex]} อายุ ${ageWord(f.age)} · ${f.termLabel}`,
    `เบี้ยประมาณ ${formatBaht(headline.total)} บาท${PER[headline.mode]}` + (annual ? ` (ตกวันละ ${perDay(annual.total)} บาท)` : ""),
    "",
    // one instalment a line, smallest first, whichever the card headlines
    ...INSTALMENT_ORDER.flatMap((mode) => {
      const m = f.modes.find((x) => x.mode === mode);
      return m ? [`${PAY_MODE_LABEL[m.mode]} ${formatBaht(m.total)} บาท`] : [];
    }),
    "",
    "ครอบครัวได้รับเมื่อเสียชีวิต",
    ...deathBenefitRows(f.death).map((r) => `- ${r.label} ${baht(r.amount)} บาท`),
  ];
  if (f.cash.length > 0) {
    lines.push("", "มูลค่าเงินสดสะสม (หากเวนคืน)", ...f.cash.map((r) => `- อายุ ${r.age} ปี ${baht(r.amount)} บาท`));
  }
  lines.push("", "เบี้ยคงที่ตลอดระยะเวลาชำระ", "เบี้ยมาตรฐาน อาจต่างไปตามผลพิจารณารับประกัน");
  return lines.join("\n");
}

const INSTALMENT_ORDER: PayMode[] = ["monthly", "semi", "annual"];