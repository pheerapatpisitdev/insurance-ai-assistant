import { chat, parseJsonReply } from "@/lib/ai/client";
import type { ChatMessage } from "@/lib/ai/types";
import { iHealthyFacts } from "@/lib/ihealthy-facts";
import { ageFromBirthdate, peopleIn, recentTurns } from "../common";

/**
 * What the bot knows about a customer buying health cover.
 *
 * A different set of fields from the life plan's, not a superset of it: this contract is
 * chosen by plan and territory, where that one is chosen by a sum assured and a paying term.
 * `product` is what tells them apart in a session row that holds either.
 */
export interface HealthSlots {
  product: "ihealthy";
  intent: "quote" | "plan_info" | "other";
  age?: number;
  sex?: "M" | "F";
  /** a plan code the rate table sells, e.g. "GOLD" */
  plan?: string;
  /** a territory label the rate table spells; absent means ประเทศไทย, which is what it opens on */
  territory?: string;
  /** a stand-alone rewrite of the question, with pronouns from earlier turns filled in */
  question?: string;
  /** the application form has been handed over; "กรอกแล้ว" after this is about that form */
  formSent?: true;
}

/**
 * How the six plans are asked for, in both scripts.
 *
 * Read here rather than left to the model for the same reason the paying term is on the life
 * plan: the plan is the price. A customer who taps Gold and is quoted Silver has been shown a
 * figure ten thousand baht from the one they asked for, and the picture under it would
 * disagree with the words over it.
 *
 * Both scripts because the page sells these under their English names and the company's sheet
 * writes them in Thai — a customer reads one and types the other.
 */
const PLAN_WORDS: [string, RegExp][] = [
  ["PLATINUM", /แพลทินั่ม|แพลตตินั่ม|แพลทินัม|platinum/i],
  ["DIAMOND", /ไดมอนด์|ไดม่อน|diamond/i],
  ["GOLD", /โกลด์|โกล์ด|\bgold\b/i],
  ["SILVER", /ซิลเวอร์|silver/i],
  ["BRONZE", /บรอนซ์|บรอนซ|bronze/i],
  ["SMART", /สมาร์ท|สมาร์ต|\bsmart\b/i],
];

/** The plan a message asks for by name, or nothing where it names none. */
export function planNamedIn(text: string): string | undefined {
  return PLAN_WORDS.find(([, re]) => re.test(text))?.[0];
}

/**
 * The territory a message asks for, as the rate table spells it.
 *
 * "ต่างประเทศ" reads as ทั่วโลก rather than as เอเชีย: it is the wider of the two, and a
 * customer quoted the narrower one would find that out at a hospital.
 */
const TERRITORY_WORDS: [string, RegExp][] = [
  ["ทั่วโลก", /ทั่วโลก|ทั้งโลก|ต่างประเทศ|เมืองนอก|worldwide|global/i],
  ["เอเชีย", /เอเชีย|asia/i],
  ["ประเทศไทย", /ในไทย|ในประเทศไทย|เฉพาะไทย|แค่ไทย/i],
];

export function territoryNamedIn(text: string): string | undefined {
  return TERRITORY_WORDS.find(([, re]) => re.test(text))?.[0];
}

/**
 * Asking to carry part of the bill in exchange for a smaller premium. Both arrangements are
 * real and both are sold in Thailand only — and neither is priced in this chat, so the
 * question is answered in words and handed on rather than routed to a quote.
 */
const SHARE_OF_BILL = /รับผิดส่วนแรก|ส่วนแรก|ร่วมจ่าย|มีส่วนร่วม|deductible|co\s*-?\s*pay/i;
export function asksShareOfBill(text: string): boolean {
  return SHARE_OF_BILL.test(text);
}

/** Asking for the whole benefit sheet, which is a web page and not a picture. */
const FULL_TABLE = /ตาราง(?:ผลประโยชน์)?(?:เต็ม|ทั้งหมด|ครบ)|เต็มๆ|ทุกหมวด|ครบทุกหมวด|ผลประโยชน์ทั้งหมด|ดูรายละเอียดทั้งหมด/;
export function asksFullTable(text: string): boolean {
  return FULL_TABLE.test(text);
}

/** Asking what else there is besides the ones already on the table. */
const OTHER_PLANS = /แผนอื่น|แบบอื่น|อันอื่น|มีอีกไหม|ตัวอื่น|ที่เหลือ/;
export function asksOtherPlans(text: string): boolean {
  return OTHER_PLANS.test(text);
}

const SYSTEM = `คุณเป็นตัวช่วยของตัวแทนประกัน อ่านข้อความล่าสุดแล้วบอกว่าลูกค้าต้องการอะไร ตอบเป็น JSON เท่านั้น

ตอนนี้กำลังคุยเรื่อง "ประกันสุขภาพ ไอเฮลท์ตี้ อัลตร้า" (iHealthy Ultra) สัญญาเพิ่มเติมค่ารักษาพยาบาลแบบเหมาจ่าย

intent มี 3 แบบ
- "quote" = ขอเบี้ยประกัน อยากรู้ราคา เลือกแผน
- "plan_info" = ถามว่าคุ้มครองอะไร ค่าห้องเท่าไหร่ OPD ได้ไหม รอคอยกี่วัน ต่ออายุถึงอายุเท่าไหร่ แผนไหนต่างกันยังไง
- "other" = ทักทาย หรือเรื่องอื่นที่ไม่ใช่สองข้อบน

ฟิลด์ที่ต้องเติมถ้ามีในข้อความ
- age เป็นตัวเลขปี
- sex เป็น "M" (ชาย) หรือ "F" (หญิง)
- plan เป็นรหัสแผน "SMART" "BRONZE" "SILVER" "GOLD" "DIAMOND" "PLATINUM"
- territory เป็น "ประเทศไทย" "เอเชีย" หรือ "ทั่วโลก"
- question เขียนคำถามใหม่ให้เข้าใจได้ด้วยตัวเอง โดยเติมสิ่งที่อ้างถึงจากบทสนทนาก่อนหน้า

ถ้าไม่มีข้อมูลให้ละฟิลด์นั้นไป ห้ามเดา`;

/** Reads the conversation and returns what the customer is asking for. Cheap model, strict JSON. */
export async function routeHealth(
  history: ChatMessage[], previous: HealthSlots | null,
): Promise<HealthSlots> {
  const messages: ChatMessage[] = [{ role: "system", content: SYSTEM }, ...recentTurns(history, 6)];
  const r = await chat({ tier: "small", task: "route_health", messages, maxTokens: 250, json: true });
  const parsed = parseJsonReply<Partial<HealthSlots>>(r.text) ?? {};
  return merge(previous, clean(parsed, history));
}

/** Anything the model returns is checked here, so an invented plan never reaches the engine. */
function clean(raw: Partial<HealthSlots>, history: ChatMessage[]): HealthSlots {
  const last = [...history].reverse().find((m) => m.role === "user")?.content ?? "";
  const out: HealthSlots = {
    product: "ihealthy",
    intent: raw.intent && ["quote", "plan_info", "other"].includes(raw.intent) ? raw.intent : "other",
  };

  // the plan written in the message wins over the model's: it is the one the customer tapped
  const codes = new Set(iHealthyFacts().plans.map((p) => p.code));
  const plan = planNamedIn(last) ?? raw.plan;
  if (plan && codes.has(plan)) out.plan = plan;

  const territory = territoryNamedIn(last) ?? raw.territory;
  if (territory && TERRITORY_WORDS.some(([label]) => label === territory)) out.territory = territory;

  // a birthdate in the message beats whatever age the model worked out from it, and a sex and
  // an age standing next to each other beat both
  const named = peopleIn(last);
  const born = ageFromBirthdate(last);
  if (born !== undefined) out.age = born;
  else if (named.length) out.age = named[0].age;
  else if (typeof raw.age === "number" && raw.age >= 0 && raw.age <= 99) out.age = Math.trunc(raw.age);

  if (named.length) out.sex = named[0].sex;
  else if (raw.sex === "M" || raw.sex === "F") out.sex = raw.sex;

  // a message that names a plan is asking what it costs, whatever the model called it
  if (out.plan !== undefined && out.intent === "other") out.intent = "quote";
  out.question = typeof raw.question === "string" && raw.question.trim() ? raw.question.trim() : last;
  return out;
}

/**
 * Slots carry over between turns: someone who gave an age and a sex and then taps a plan is
 * still the same customer. The newer turn always wins.
 */
function merge(previous: HealthSlots | null, current: HealthSlots): HealthSlots {
  if (!previous) return current;
  const merged: HealthSlots = { ...current };
  // filling in what the quote was waiting for is still asking for the quote
  if (previous.intent === "quote"
      && (current.age !== undefined || current.sex !== undefined || current.plan !== undefined)) {
    merged.intent = "quote";
  }
  if (merged.age === undefined) merged.age = previous.age;
  if (merged.sex === undefined) merged.sex = previous.sex;
  if (merged.plan === undefined) merged.plan = previous.plan;
  if (merged.territory === undefined) merged.territory = previous.territory;
  if (merged.formSent === undefined) merged.formSent = previous.formSent;
  return merged;
}
