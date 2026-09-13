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
  sumAssured?: number;
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
- sumAssured ทุนประกันเป็นบาท ("1 ล้าน" = 1000000, "5 แสน" = 500000)
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
const ASKS_FOR_PRICE = /สนใจ|ขอ\s*เบี้ย|เบี้ย\s*เท่า|ราคา|คิดเบี้ย|เช็[กค]\s*เบี้ย|ทำทุน|อยากทำ/i;

/** Whether a message asks for a premium on a sum it names. */
export function asksForPrice(text: string): boolean {
  return ASKS_FOR_PRICE.test(text) && !asksAboutDeathBenefit(text);
}

/**
 * Asking who is behind the policy: which insurer, which agency, whether they can be trusted,
 * what licence the person on the other end holds.
 *
 * Nothing in this project records any of that — the rate tables carry a plan name and
 * nothing else — so there is no honest answer for a model to compose. Asked "กรุงไทยแอกซ่า
 * ใช่ไหม", it answered "ใช่ครับ": agreeing with whatever name the customer happened to say,
 * about the company that would be underwriting their life. That is why this is matched here
 * and answered by a sentence rather than by a model.
 */
const COMPANY_QUESTION =
  /บริษัท(?!ประกันชีวิตชั้นนำ)|ผู้รับประกัน|รับประกันโดย|ค่ายไหน|แบรนด์|ใบอนุญาต|นายหน้า|ตัวแทนของ|เชื่อถือ|มั่นคง|กรุงไทย|แอกซ่า|axa|เมืองไทย|เอไอเอ|\baia\b|ไทยประกัน|พรูเด็นเชียล|prudential|allianz|อลิอันซ์|fwd|โตเกียว/i;

/** Whether a message is asking who stands behind the policy. */
export function asksAboutCompany(text: string): boolean {
  return COMPANY_QUESTION.test(text);
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

  if (typeof raw.age === "number" && raw.age >= 0 && raw.age <= 99) out.age = Math.trunc(raw.age);
  if (raw.sex === "M" || raw.sex === "F") out.sex = raw.sex;
  if (typeof raw.sumAssured === "number" && raw.sumAssured > 0) out.sumAssured = Math.trunc(raw.sumAssured);
  if (raw.mode === "annual" || raw.mode === "semi" || raw.mode === "monthly") out.mode = raw.mode;
  // a sum the customer named, in a message asking for a price, is a request for a price
  if (out.intent !== "quote" && out.sumAssured !== undefined && asksForPrice(last)) out.intent = "quote";
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
  if (merged.variant === undefined) merged.variant = previous.variant;
  if (merged.sumAssured === undefined) merged.sumAssured = previous.sumAssured;
  if (merged.age === undefined) merged.age = previous.age;
  if (merged.sex === undefined) merged.sex = previous.sex;
  if (merged.mode === undefined) merged.mode = previous.mode;
  return merged;
}
