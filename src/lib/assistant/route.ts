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
   * Everyone the message named, in the order it named them.
   *
   * "ผญ 32 ผช33ค่ะ" is one message asking for two quotes — a couple pricing themselves
   * together, which is the larger sale. The first of them also fills `age` and `sex`, so a
   * conversation about one person is unchanged.
   */
  people?: { age: number; sex: "M" | "F" }[];
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
  /**
   * A cheaper arrangement the bot has put on the table and not yet priced in full.
   *
   * Carried by sum assured as well as by cover, because the halved cover can land on the one
   * figure that is read as a sum assured — a customer who then says "1 ล้าน" would otherwise
   * be quoted the arrangement they just called too expensive.
   */
  offer?: { coverWanted: number; sumAssured: number; variant: string };
  /** the sum assured behind a taken offer, so a follow-up on the same cover keeps it */
  takenSum?: number;
  /** the application form has been handed over; "กรอกแล้ว" after this is about that form */
  formSent?: true;
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

/**
 * Asking how long the premium has to be paid — "ต้องจ่ายถึงกี่ปี" — rather than asking what a
 * named term costs. The difference matters: the first wants one line, and was answered with
 * the whole quotation again, card and all, one message after the customer had received it.
 *
 * A message that names a term is the second kind and is left to the quote.
 */
const PAY_TERM_QUESTION =
  /(?:จ่าย|ส่ง|ชำระ)[^0-9]{0,12}(?:กี่ปี|นานไหม|นานแค่ไหน|นานเท่าไ|ถึงเมื่อไ|เมื่อไหร่|อีกกี่)|กี่ปี(?:ถึง)?(?:จะ)?(?:หมด|ครบ|จบ)/;

/** Whether a message is asking how long the premium runs for. */
export function asksPayTerm(text: string): boolean {
  return PAY_TERM_QUESTION.test(text) && lifeProtectVariantIn(text) === undefined;
}

/**
 * The premium is too much. Answered by pointing at what is actually cheaper — the pay-to-99
 * term, a smaller cover — rather than by the shorter terms the bot offered on its first
 * attempt, which cost more a year, not less.
 */
const TOO_EXPENSIVE = /แพง|ถูกกว่า|ถูกลง|ลดได้|ลดหน่อย|ลดทุน|ส่วนลด|ต่อราคา|โปรโมชั่น|มีโปร|เกินงบ|งบไม่ถึง|ไม่มีตังค์|ไม่มีเงิน/;

/** Whether a message is saying the price is too high. */
export function asksCheaper(text: string): boolean {
  return TOO_EXPENSIVE.test(text);
}

/** A short yes, with nothing else in it — taking whatever was last offered. */
const AFFIRMS = /^\s*(?:เอา|ตกลง|โอเค|โอเช|ok|okay|ได้|สนใจ|ครับ|ค่ะ|คะ|ขอ)(?:เลย|ครับ|ค่ะ|คะ|แบบนี้|อันนี้|แบบลดทุน|แบบนั้น|นี้)*\s*(?:ครับ|ค่ะ|คะ)?\s*$/i;

/** Whether a message is a bare acceptance of what the bot last put on the table. */
export function affirms(text: string): boolean {
  return text.length <= 30 && !/\d/.test(text) && AFFIRMS.test(text);
}

/**
 * Stepping back — "เดี๋ยวคิดดูก่อน", "ขอปรึกษาแฟนก่อน", "ไว้จะติดต่อกลับ". Not a question, not
 * a refusal: a person who has what they came for and is leaving to think.
 */
const STALLS = /คิดดูก่อน|ขอคิดดู|คิดก่อน|ไว้ก่อน|ไว้ค่อย|ติดต่อกลับ|เดี๋ยวติดต่อ|ทักกลับ|ขอปรึกษา|ปรึกษาก่อน|ปรึกษาที่บ้าน|ยังไม่ตัดสินใจ|ขอเวลา|เดี๋ยวมาใหม่|ขอดูก่อน/;
/** A stall that is really a question stays a question. */
const ASKS = /\?|ไหม|มั้ย|ยังไง|อย่างไร|อะไร|เท่าไ|กี่|ไหน|เมื่อไ/;

/** Whether the customer is leaving to think it over. */
export function stalls(text: string): boolean {
  return STALLS.test(text) && !ASKS.test(text);
}

/**
 * Deciding to buy — "เอาแผนนี้", "สมัครยังไง", "ต้องทำยังไงต่อ", "ใช้เอกสารอะไรบ้าง". The one
 * message the whole campaign is for, and the one a model was wording on its own: it asked for
 * a name and a phone number the privacy page says are never asked for, and once promised to
 * "เตรียมเอกสาร". The agency's answer is a form, so the answer is written out and the words
 * that mean it are listed here.
 */
const BUYS =
  /สมัคร|ทำ(?:ยังไง|อย่างไร|ไง)|ขั้นตอน|ต้องทำอะไร|เอา(?:แผน|แบบ|แผ่น|อัน|ตัว)นี้|ตกลงทำ|สนใจทำ|ทำเลย|เอาเลย|เริ่ม(?:ยังไง|อย่างไร|ได้เลย)|เตรียม(?:อะไร|เอกสาร)|ใช้เอกสาร|เอกสารอะไร|ซื้อ(?:ยังไง|ได้ที่ไหน|ได้เลย|เลย)|ดำเนินการ/;
/** "ทำยังไง" about a claim, a cancellation or a surrender is a service question, not a purchase */
const NOT_BUYING = /เคลม|ยกเลิก|เวนคืน|กู้|ต่ออายุ|เปลี่ยนแปลง/;
/** a bare ตกลง or เอา — a decision once a premium is on the table, and only then */
const COMMITS = /^\s*(?:ตกลง|เอา)(?:\s*(?:ครับ|ค่ะ|คะ|เลย|นะ))*\s*$/;

/**
 * Whether the customer is asking to go ahead. `quoted` says a premium has been given, which
 * is what lets a one-word ตกลง count; a one-word โอเค never does — it is an acknowledgement.
 */
export function wantsToBuy(text: string, quoted: boolean): boolean {
  if (asksCheaper(text) || NOT_BUYING.test(text) || peopleIn(text).length > 0) return false;
  return BUYS.test(text) || (quoted && COMMITS.test(text));
}

/** Whether the customer says the form has been filled in and sent. */
const FORM_DONE = /กรอก(?:แล้ว|เสร็จ|เรียบร้อย)|ส่ง(?:ฟอร์ม|ข้อมูล)?แล้ว|เรียบร้อยแล้ว|ทำแล้ว/;
export function saysFormDone(text: string): boolean {
  return FORM_DONE.test(text);
}

/** Whether a message is asking who stands behind the policy. */
export function asksAboutCompany(text: string): boolean {
  return INSURER_QUESTION.test(text) || TRUST_QUESTION.test(text);
}

/** Whether that question is one only a person should answer. */
export function asksAboutTrust(text: string): boolean {
  return TRUST_QUESTION.test(text);
}

/**
 * A sex and an age standing next to each other, in either order and in any of the forms
 * customers actually use: "ผญ 32", "42 ญ", "ชายอายุ 35", "เพศหญิง อายุ 36".
 *
 * Read here rather than asked of the model, because the model returns one person and a
 * message often names two. Two of six conversations from the campaign's first day were a
 * couple in one line.
 */
const SEX_WORD = "ผู้หญิง|ผู้ชาย|ผญ|ผช|หญิง|ชาย|ญ|ช";
const PERSON_RE = new RegExp(
  `(${SEX_WORD})\\s*(?:เพศ\\s*)?(?:อายุ\\s*)?(\\d{1,2})(?!\\d)`
  + `|(\\d{1,2})(?!\\d)\\s*(?:ปี)?\\s*(${SEX_WORD})`,
  "g",
);

/** Everyone a message names, in the order it names them. */
export function peopleIn(text: string): { age: number; sex: "M" | "F" }[] {
  const out: { age: number; sex: "M" | "F" }[] = [];
  for (const m of text.matchAll(PERSON_RE)) {
    const word = m[1] ?? m[4] ?? "";
    const age = Number(m[2] ?? m[3]);
    if (!Number.isInteger(age) || age < 0 || age > 99) continue;
    const sex = word.includes("ญ") ? "F" : "M";
    // the same person written twice is still one person
    if (!out.some((p) => p.age === age && p.sex === sex)) out.push({ age, sex });
  }
  return out;
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

  // everyone the message itself names, which the model cannot be relied on to count
  const namedPeople = peopleIn(last);
  if (namedPeople.length > 1) out.people = namedPeople;

  // a birthdate in the message beats whatever age the model worked out from it
  const born = ageFromBirthdate(last);
  if (born !== undefined) out.age = born;
  else if (namedPeople.length) out.age = namedPeople[0].age;
  else if (typeof raw.age === "number" && raw.age >= 0 && raw.age <= 99) out.age = Math.trunc(raw.age);

  if (namedPeople.length) out.sex = namedPeople[0].sex;
  else if (raw.sex === "M" || raw.sex === "F") out.sex = raw.sex;
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
  // a turn that names its own people replaces the earlier ones rather than adding to them
  if (merged.people === undefined && current.age === undefined && current.sex === undefined) {
    merged.people = previous.people;
  }
  if (merged.variant === undefined) merged.variant = previous.variant;
  if (merged.coverWanted === undefined) merged.coverWanted = previous.coverWanted;
  if (merged.age === undefined) merged.age = previous.age;
  if (merged.sex === undefined) merged.sex = previous.sex;
  if (merged.mode === undefined) merged.mode = previous.mode;
  if (merged.offer === undefined) merged.offer = previous.offer;
  if (merged.takenSum === undefined && merged.coverWanted === previous.coverWanted) merged.takenSum = previous.takenSum;
  if (merged.formSent === undefined) merged.formSent = previous.formSent;
  return merged;
}
