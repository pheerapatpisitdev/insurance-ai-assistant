import { chat, parseJsonReply } from "@/lib/ai/client";
import type { ChatMessage } from "@/lib/ai/types";
import { getPlan } from "@/calc/plans/registry";

export type Intent = "quote" | "plan_info" | "other";

/** The plan this assistant sells. The adverts point at it and nothing else. */
export const PLAN_CODE = "LIFEPROTECT";

export interface Routed {
  intent: Intent;
  /** a package of the plan, e.g. "WLF19H"; the answer decides whether it is one it may quote */
  variant?: string;
  age?: number;
  sex?: "M" | "F";
  /**
   * What the customer wants the family to receive, in baht — not the sum assured.
   *
   * "ทุน 3 ล้าน" in a customer's message means three million to the family, which on this
   * plan is a sum assured of one and a half before the booster age. Reading it as the sum
   * assured doubles both the cover and the premium, so the two are kept apart by name.
   */
  coverWanted?: number;
  mode?: "annual" | "semi" | "monthly";
  /** a stand-alone rewrite of the question, with pronouns from earlier turns filled in */
  question?: string;
}

const SYSTEM = `คุณเป็นตัวช่วยของตัวแทนประกันชีวิต อ่านข้อความล่าสุดแล้วบอกว่าลูกค้าต้องการอะไร ตอบเป็น JSON เท่านั้น

ตอนนี้เอเจนซี่ขายแบบเดียวคือ "Life Protect x 2" (ไลฟ์ โพรเทค+ 100 แบบจ่ายสองเท่าเมื่อเสียชีวิตก่อนอายุ 60)

intent มี 3 แบบ
- "quote" = ขอเบี้ยประกัน ต้องคำนวณเป็นตัวเลข
- "plan_info" = ถามว่าคุ้มครองอะไร เสียชีวิตแล้วได้เท่าไหร่ รับอายุเท่าไหร่ ทุนขั้นต่ำ จ่ายกี่ปี เวนคืนได้เท่าไหร่
- "other" = ทักทาย หรือเรื่องอื่นที่ไม่ใช่สองข้อบน

ฟิลด์ที่ต้องเติมถ้ามีในข้อความ
- age เป็นตัวเลขปี
- sex เป็น "M" (ชาย) หรือ "F" (หญิง)
- coverWanted จำนวนเงินที่ลูกค้าอยากให้ครอบครัวได้รับเมื่อเสียชีวิต เป็นบาท ("ทุน 1 ล้าน" = 1000000, "ทุน 5 แสน" = 500000)
- variant เป็น "WLF09H" (จ่าย 9 ปี) "WLF19H" (จ่าย 19 ปี) หรือ "WLF99H" (จ่ายถึงอายุ 99)
- mode เป็น "annual" (รายปี) "semi" (ราย 6 เดือน) หรือ "monthly" (รายเดือน)
- question เขียนคำถามใหม่ให้เข้าใจได้ด้วยตัวเอง โดยเติมสิ่งที่อ้างถึงจากบทสนทนาก่อนหน้า

ถ้าไม่มีข้อมูลให้ละฟิลด์นั้นไป ห้ามเดา`;

/**
 * The last few turns, always beginning with something the customer said. Cutting a
 * conversation to a fixed length can land on an assistant turn, and providers differ on
 * whether they accept a reply with nothing to reply to — one refuses outright. Starting on
 * a user turn keeps every provider in the failover chain usable.
 */
export function recentTurns(history: ChatMessage[], count: number): ChatMessage[] {
  const recent = history.slice(-count);
  const first = recent.findIndex((m) => m.role === "user");
  return first < 0 ? [] : recent.slice(first);
}

/** Reads the conversation and returns what the customer is asking for. Cheap model, strict JSON. */
export async function routeMessage(history: ChatMessage[]): Promise<Routed> {
  const messages: ChatMessage[] = [{ role: "system", content: SYSTEM }, ...recentTurns(history, 6)];
  const r = await chat({ tier: "small", task: "route", messages, maxTokens: 300, json: true });
  const parsed = parseJsonReply<Routed>(r.text);
  return parsed ? clean(parsed, history) : { intent: "other" };
}

/**
 * How ไลฟ์ โพรเทค+ names its payment terms, in the customer's words and in the workbook's.
 *
 * The plan sells six packages: three terms under two products that differ only in how much
 * they pay on early death. That is two decisions the model has to make from prose, and it
 * was making neither — a customer arriving from /lifeprotect having chosen "จ่าย 19 ปี" was
 * quoted the pay-to-99 term instead, at nearly half the premium the page had just shown.
 * A price that changes between the page and the chat is the one thing neither will forgive,
 * so both halves are read off the text here rather than left to the model.
 *
 * A term counts only where the customer is paying — "จ่าย 19 ปี", "ชำระเบี้ย 19 ปี" — never
 * from a bare number of years, because "อายุ 19 ปี" is an insured, not a term.
 */
const LIFEPROTECT_TERMS: [string, RegExp][] = [
  ["99", /(?:ถึง|ครบ)\s*อายุ\s*99|จนอายุ\s*99|to\s*99/i],
  ["19", /(?:จ่าย|ชำระ)(?:เบี้ย)?\s*19\s*ปี|19\s*ปีจบ/i],
  ["09", /(?:จ่าย|ชำระ)(?:เบี้ย)?\s*9\s*ปี|(?:^|[^\d])9\s*ปีจบ/i],
];

/** The x1.5 product; anything else on this plan is the x2 one the adverts point at. */
const LIFEPROTECT_HALF = /\+\s*50|x\s*1\.5|โพรเทค\s*\+?\s*50/i;

/**
 * The package a message asks for, when it names a payment term. Undefined when no term is
 * named, which leaves the choice to the model and then to the answer's own default.
 *
 * An x1.5 term is returned as itself rather than quietly turned into its x2 sibling: the
 * answer turns that request down in words, and it can only do that if it can see it.
 */
export function lifeProtectVariantIn(text: string): string | undefined {
  const term = LIFEPROTECT_TERMS.find(([, re]) => re.test(text))?.[0];
  if (!term) return undefined;
  return `WLF${term}${LIFEPROTECT_HALF.test(text) ? "L" : "H"}`;
}

/**
 * How people ask what the plan pays out — nearly always as a multiple of the sum, because
 * that is how the adverts word it. "ทำทุน 1 ล้าน ครอบครัวได้ 2 ล้านจริงไหม" is the campaign's
 * own headline being checked, and it is answered from the rate tables, so it must not be
 * left in the small-talk route where the model would answer it out of its own head.
 */
const DEATH_BENEFIT_QUESTION =
  /กี่เท่า|\d+(?:\.\d+)?\s*เท่า|สองเท่า|คูณ\s*(?:สอง|2)|\bx\s*2\b|ครอบครัวได้|ได้(?:รับ)?\s*เท่า(?:ไหร่|ไร)/i;

/** Whether a message is asking what the plan pays on death. */
export function asksAboutDeathBenefit(text: string): boolean {
  return DEATH_BENEFIT_QUESTION.test(text);
}

/**
 * How someone asks for a price. It exists because the adverts ask for them on the
 * customer's behalf: every click-to-Messenger ad opens with buttons reading
 * "สนใจประกันมรดก ทุน 1,000,000", and the model called the identical phrasing plan_info on
 * one button and quote on the next two. That is the first message of nearly every
 * conversation the campaign pays for, so it is settled here rather than left to a coin flip.
 */
const ASKS_FOR_PRICE =
  /สนใจ|ขอ\s*เบี้ย|เบี้ย\s*เท่า|ราคา|คิดเบี้ย|เช็[กค]\s*เบี้ย|ทำทุน|อยากทำ|รายละเอียด|ขอทราบ|สอบถาม/i;

/** Whether a message asks for a premium on a sum it names. */
export function asksForPrice(text: string): boolean {
  return ASKS_FOR_PRICE.test(text) && !asksAboutDeathBenefit(text);
}

/**
 * Asking which company stands behind the policy — by name, by "ของบริษัทอะไร", or by
 * proposing a rival and waiting to be agreed with.
 *
 * Answered from a constant rather than by a model. Nothing in this project records the
 * insurer: asked "กรุงไทยแอกซ่าใช่ไหม", the model said "ใช่ครับ", which was agreement with
 * whatever name the customer happened to type, about the company that would be insuring
 * their life. A rival's name is matched too, so that guess is corrected rather than confirmed.
 */
const INSURER_QUESTION =
  /บริษัท\s*(อะไร|ไหน|อะไรคะ|ไรครับ)|ของบริษัท|ผู้รับประกัน|รับประกันโดย|ค่ายไหน|แบรนด์|กรุงไทย|แอกซ่า|axa|เมืองไทย|เอไอเอ|\baia\b|ไทยประกัน|พรูเด็นเชียล|prudential|allianz|อลิอันซ์|\bfwd\b|โตเกียว|กรุงเทพประกัน|ไทยพาณิชย์|\bscb\b/i;

/**
 * Asking about the people rather than the company: a licence, a brokerage, whether any of
 * them can be trusted. The insurer can be named from a constant; none of this can, so it
 * goes to a person.
 */
const TRUST_QUESTION = /ใบอนุญาต|นายหน้า|ตัวแทนของ|เชื่อถือ|มั่นคง|โกง|หลอก|จดทะเบียน|ตัวจริง/i;

/** Whether a message is asking who stands behind the policy. */
export function asksAboutCompany(text: string): boolean {
  return INSURER_QUESTION.test(text) || TRUST_QUESTION.test(text);
}

/** Whether that question is one only a person should answer. */
export function asksAboutTrust(text: string): boolean {
  return TRUST_QUESTION.test(text);
}

/**
 * The age a date of birth in the message works out to, or undefined when it names none.
 *
 * Customers answer "อายุเท่าไหร่" with a birthdate as readily as with a number — "เกิด
 * 14/12/2523 ผู้หญิง" — and the model read that one as 43 when it is 45. Two years is a
 * different premium. An age is arithmetic on a calendar, so it is done here, and only from a
 * whole date: a bare year cannot say whether the birthday has passed, and guessing it wrong
 * is the same mistake one year smaller.
 */
export function ageFromBirthdate(text: string, today: Date = new Date()): number | undefined {
  const m = text.match(/(\d{1,2})\s*[/\-.]\s*(\d{1,2})\s*[/\-.]\s*(\d{4})/);
  if (!m) return undefined;
  const day = Number(m[1]);
  const month = Number(m[2]);
  const named = Number(m[3]);
  if (day < 1 || day > 31 || month < 1 || month > 12) return undefined;
  // a year in the 2500s is พ.ศ.; anything else is read as ค.ศ.
  const year = named >= 2400 ? named - 543 : named;
  const passed = today.getMonth() + 1 > month
    || (today.getMonth() + 1 === month && today.getDate() >= day);
  const age = today.getFullYear() - year - (passed ? 0 : 1);
  return age >= 0 && age <= 99 ? age : undefined;
}

/** Anything the model returns is checked here, so an invented package never reaches the engine. */
function clean(raw: Routed, history: ChatMessage[]): Routed {
  const out: Routed = { intent: ["quote", "plan_info", "other"].includes(raw.intent) ? raw.intent : "other" };
  const last = [...history].reverse().find((m) => m.role === "user")?.content ?? "";
  if (out.intent === "other" && asksAboutDeathBenefit(last)) out.intent = "plan_info";

  // the term written in the message wins over the model's: it is what the customer chose,
  // and on a visitor from /lifeprotect it is what is on their screen
  const named = lifeProtectVariantIn(last);
  const variant = named ?? raw.variant;
  if (variant && variant in getPlan(PLAN_CODE)!.variantLabels) out.variant = variant;

  // a birthdate in the message beats whatever age the model worked out from it
  const born = ageFromBirthdate(last);
  if (born !== undefined) out.age = born;
  else if (typeof raw.age === "number" && raw.age >= 0 && raw.age <= 99) out.age = Math.trunc(raw.age);
  if (raw.sex === "M" || raw.sex === "F") out.sex = raw.sex;
  if (typeof raw.coverWanted === "number" && raw.coverWanted > 0) out.coverWanted = Math.trunc(raw.coverWanted);
  if (raw.mode === "annual" || raw.mode === "semi" || raw.mode === "monthly") out.mode = raw.mode;
  // a sum the customer named, in a message asking for a price, is a request for a price
  if (out.intent !== "quote" && out.coverWanted !== undefined && asksForPrice(last)) out.intent = "quote";
  out.question = typeof raw.question === "string" && raw.question.trim() ? raw.question.trim() : last;
  return out;
}

/**
 * Slots carry over between turns: "อายุ 35 ชาย" then "แล้วทุน 2 ล้านล่ะ" should still know
 * the age and sex. The newer turn always wins.
 */
export function mergeSlots(previous: Routed | null, current: Routed): Routed {
  if (!previous) return current;
  const merged: Routed = { ...current };
  /**
   * Someone filling in what the quote was waiting for is still asking for the quote.
   *
   * The bot asks for a sex and an age; the customer sends "เกิด 14/12/2523 ผู้หญิง", which
   * names no price and reads to the model like a plan question. It was answered with a
   * paragraph and no premium, one message after the bot had promised one.
   */
  if (previous.intent === "quote" && (current.age !== undefined || current.sex !== undefined || current.coverWanted !== undefined)) {
    merged.intent = "quote";
  }
  if (merged.variant === undefined) merged.variant = previous.variant;
  if (merged.coverWanted === undefined) merged.coverWanted = previous.coverWanted;
  if (merged.age === undefined) merged.age = previous.age;
  if (merged.sex === undefined) merged.sex = previous.sex;
  if (merged.mode === undefined) merged.mode = previous.mode;
  return merged;
}
