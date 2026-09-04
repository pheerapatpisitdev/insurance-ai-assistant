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
const PER: Record<PayMode, string> = { annual: "/ปี", semi: "/6 เดือน", monthly: "/เดือน" };

const SEX_WORD: Record<Sex, string> = { M: "ชาย", F: "หญิง" };

export interface LegacyFacts {
  /** the tier, as the round number of millions the family receives */
  millions: number;
  age: number | "";
  sex: Sex;
  /** whether the bundle will take this age at all */
  inRange: boolean;
  /** the instalment on the card, or undefined when no price is being shown */
  premium: ModePremium | undefined;
}

/**
 * What the customer's chat opens with. The same sentence goes to LINE, to Messenger and to
 * the assistant, so whoever answers starts from the figures already on screen instead of
 * asking for them again.
 *
 * Each shortfall says what it wants instead of falling silent: no age yet asks about the
 * sum, an age the bundle refuses asks for a plan that fits it, and a withheld price asks
 * for the current one.
 */
export function legacyMessage(facts: LegacyFacts): string {
  const head = `สนใจมรดกเพื่อครอบครัว ${facts.millions} ล้าน`;
  if (facts.age === "") return head;
  const who = `${head} อายุ ${facts.age} ${SEX_WORD[facts.sex]}`;
  if (!facts.inRange) return `${who} ขอแบบที่เหมาะกับอายุนี้`;
  if (!facts.premium) return `${who} ขอราคาปัจจุบัน`;
  return `${who} เบี้ยประมาณ ${formatBaht(facts.premium.total)} บาท${PER[facts.premium.mode]}`;
}

/**
 * Every channel is opened with the message waiting in the input box, never sent for the
 * customer: the first thing they do in the chat should still be their own doing.
 */
export function lineUrl(oaId: string, text: string): string {
  return `https://line.me/R/oaMessage/${encodeURIComponent(oaId)}/?${encodeURIComponent(text)}`;
}

export function messengerUrl(page: string, text: string): string {
  return `https://m.me/${encodeURIComponent(page)}?text=${encodeURIComponent(text)}`;
}

export function chatUrl(text: string): string {
  return `/chat?q=${encodeURIComponent(text)}`;
}
