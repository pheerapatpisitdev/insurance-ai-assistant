import { chat, parseJsonReply } from "@/lib/ai/client";
import type { ChatMessage } from "@/lib/ai/types";
import { getPlan } from "@/calc/plans/registry";
import { planCatalogue } from "./catalogue";

export type Intent = "quote" | "plan_info" | "doc_qa" | "other";

export interface Routed {
  intent: Intent;
  planCode?: string;
  variant?: string;
  age?: number;
  sex?: "M" | "F";
  sumAssured?: number;
  mode?: "annual" | "semi" | "monthly";
  /** a stand-alone rewrite of the question, with pronouns from earlier turns filled in */
  question?: string;
}

const SYSTEM = `คุณเป็นตัวช่วยของตัวแทนประกันชีวิต หน้าที่ของคุณคืออ่านข้อความล่าสุดแล้วบอกว่าผู้ใช้ต้องการอะไร ตอบเป็น JSON เท่านั้น

intent มี 4 แบบ
- "quote" = ขอเบี้ยประกัน ต้องคำนวณเป็นตัวเลข
- "plan_info" = ถามว่าแบบประกันมีอะไรบ้าง เงื่อนไข อายุที่รับ ทุนขั้นต่ำ สัญญาเพิ่มเติม
- "doc_qa" = ถามเรื่องทั่วไปในเอกสาร เช่น การเคลม ระยะรอคอย ข้อยกเว้น
- "other" = ทักทายหรือเรื่องอื่น

ฟิลด์ที่ต้องเติมถ้ามีในข้อความ
- planCode, variant ใช้รหัสจากรายการข้างล่างเท่านั้น
- age เป็นตัวเลขปี
- sex เป็น "M" (ชาย) หรือ "F" (หญิง)
- sumAssured ทุนประกันเป็นบาท ("1 ล้าน" = 1000000)
- mode เป็น "annual" (รายปี) "semi" (ราย 6 เดือน) หรือ "monthly" (รายเดือน)
- question เขียนคำถามใหม่ให้เข้าใจได้ด้วยตัวเอง โดยเติมสิ่งที่อ้างถึงจากบทสนทนาก่อนหน้า

ถ้าไม่มีข้อมูลให้ละฟิลด์นั้นไป ห้ามเดา

รายการแบบประกัน
`;

/** Reads the conversation and returns what the user is asking for. Cheap model, strict JSON. */
export async function routeMessage(history: ChatMessage[]): Promise<Routed> {
  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM + planCatalogue() },
    ...history.slice(-6),
  ];
  const r = await chat({ tier: "small", task: "route", messages, maxTokens: 300, json: true });
  const parsed = parseJsonReply<Routed>(r.text);
  if (!parsed) return { intent: "other" };
  return clean(parsed, history);
}

/**
 * How people actually write each plan's name. The model is asked for a plan code too, but
 * it sometimes leaves it out, and a quote on the wrong plan is the one mistake a customer
 * would not forgive — so the name written in the message wins over whatever the model said.
 */
const PLAN_ALIASES: [string, RegExp][] = [
  ["LIFEPROTECT", /ไลฟ์\s*โพรเทค|life\s*protect|โพรเทค\s*\+|lpp/i],
  ["ISHIELD", /i\s*shield|ไอ\s*ชิลด์|ไอ\s*ชิว|ไอ\s*ชีลด์/i],
  ["ISMART", /i\s*smart|ไอ\s*สมาร์ท|ไอ\s*สมาท|80\s*\/\s*6/i],
  ["LIFETREASURE", /ไลฟ์\s*เทรเชอร์|life\s*treasure|เทรเชอร์/i],
  ["PLB", /\bplb\b|protection\s*life|โพรเทคชั่น\s*ไลฟ์|โปรเทคชั่น\s*ไลฟ์/i],
];

/** The plan named in a message, or undefined when none is. */
export function planNamedIn(text: string): string | undefined {
  return PLAN_ALIASES.find(([, re]) => re.test(text))?.[0];
}

/** Anything the model returns is checked here, so a hallucinated plan code never reaches the engine. */
function clean(raw: Routed, history: ChatMessage[]): Routed {
  const out: Routed = { intent: ["quote", "plan_info", "doc_qa", "other"].includes(raw.intent) ? raw.intent : "other" };
  const last = [...history].reverse().find((m) => m.role === "user")?.content ?? "";
  const planCode = planNamedIn(last) ?? raw.planCode;
  const plan = planCode ? getPlan(planCode) : undefined;
  if (plan && planCode) {
    out.planCode = planCode;
    // a variant only makes sense on the plan it belongs to
    if (raw.variant && raw.variant in plan.variantLabels) out.variant = raw.variant;
  }
  if (typeof raw.age === "number" && raw.age >= 0 && raw.age <= 99) out.age = Math.trunc(raw.age);
  if (raw.sex === "M" || raw.sex === "F") out.sex = raw.sex;
  if (typeof raw.sumAssured === "number" && raw.sumAssured > 0) out.sumAssured = Math.trunc(raw.sumAssured);
  if (raw.mode === "annual" || raw.mode === "semi" || raw.mode === "monthly") out.mode = raw.mode;
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
  if (merged.planCode === undefined) merged.planCode = previous.planCode;
  // a variant belongs to its plan, so it only carries over when the plan did not change
  if (merged.variant === undefined && merged.planCode === previous.planCode) merged.variant = previous.variant;
  if (merged.age === undefined) merged.age = previous.age;
  if (merged.sex === undefined) merged.sex = previous.sex;
  if (merged.sumAssured === undefined) merged.sumAssured = previous.sumAssured;
  if (merged.mode === undefined) merged.mode = previous.mode;
  return merged;
}
