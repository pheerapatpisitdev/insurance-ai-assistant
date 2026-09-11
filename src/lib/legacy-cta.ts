import type { ModePremium } from "@/calc/mode-premiums";
import type { PayMode, Sex } from "@/calc/types";
import { formatBaht } from "@/calc/money";

/**
 * The instalment to put in the largest type. A customer reads a monthly figure as what the
 * plan costs, so it is preferred — but only while the company will actually take it. Under
 * its monthly floor the instalment is not a price anyone can pay, so the yearly premium
 * takes the headline rather than a number the application would be refused for.
 *
 * Undefined means no price may be shown: the rate table has expired, or the arrangement
 * could not be priced at all.
 */
export function displayPremium(
  modes: ModePremium[] | undefined, expired: boolean,
): ModePremium | undefined {
  if (!modes || expired) return undefined;
  const monthly = modes.find((m) => m.mode === "monthly");
  if (monthly && !monthly.belowMinimum) return monthly;
  return modes.find((m) => m.mode === "annual");
}

/**
 * The yearly premium as whole baht a day — the figure that makes a five-digit number feel
 * like something. Rounded up rather than down: a day rate the premium does not actually
 * reach would be an understatement of the price.
 */
export function perDay(annualSatang: number): number {
  return Math.ceil(annualSatang / 100 / 365);
}

/** How each instalment reads after a figure, where the customer says it out loud. */
export const PER: Record<PayMode, string> = { annual: "/ปี", semi: "/6 เดือน", monthly: "/เดือน" };

const SEX_WORD: Record<Sex, string> = { M: "ชาย", F: "หญิง" };

export interface LegacyFacts {
  /** the tier, as the round number of millions the family receives */
  millions: number;
  /** an age the bundle takes, "other" for everyone outside it, "" before one is picked */
  age: LegacyAge;
  sex: Sex;
  /** the ages the bundle issues at, named in the message an outsider sends */
  range: { min: number; max: number };
  /** the instalment on the card, or undefined when no price is being shown */
  premium: ModePremium | undefined;
}

/**
 * The age picker's value. Whether the bundle can take the age is the shape of this value
 * rather than a flag beside it, so the two cannot disagree.
 */
export type LegacyAge = number | "other" | "";

/**
 * What the customer's chat opens with, so whoever answers starts from the figures already
 * on screen instead of asking for them again.
 *
 * Each shortfall says what it wants instead of falling silent: no age yet asks about the
 * sum, an age the bundle refuses asks for a plan that fits it, and a withheld price asks
 * for the current one.
 */
export function legacyMessage(facts: LegacyFacts): string {
  const head = `สนใจมรดกเพื่อครอบครัว ${facts.millions} ล้าน`;
  if (facts.age === "") return head;
  if (facts.age === "other") {
    return `${head} อายุนอกช่วง ${facts.range.min}–${facts.range.max} ปี ขอแบบที่เหมาะกับอายุนี้`;
  }
  const who = `${head} อายุ ${facts.age} ${SEX_WORD[facts.sex]}`;
  if (!facts.premium) return `${who} ขอราคาปัจจุบัน`;
  return `${who} เบี้ยประมาณ ${formatBaht(facts.premium.total)} บาท${PER[facts.premium.mode]}`;
}

/** The agency's Facebook Page, LuckyPlanner โชคดีที่มีแพลน — the one place a customer is sent to talk to a person. */
export const FACEBOOK_PAGE = "105982528649026";

/**
 * The chat is opened with the message waiting in the input box, never sent for the
 * customer: the first thing they do in the chat should still be their own doing.
 */
export function messengerUrl(text: string): string {
  return `https://m.me/${FACEBOOK_PAGE}?text=${encodeURIComponent(text)}`;
}
