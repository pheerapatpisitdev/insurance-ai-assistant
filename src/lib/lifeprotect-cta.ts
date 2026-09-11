import type { ModePremium } from "@/calc/mode-premiums";
import type { Sex } from "@/calc/types";
import { formatBaht } from "@/calc/money";
import { PER } from "@/lib/legacy-cta";

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
