import { chat, parseJsonReply } from "@/lib/ai/client";
import type { ChatMessage } from "@/lib/ai/types";
import { HOSPITAL_LABEL, LIFE_WANT_LABEL } from "./assumptions";
import { ciNeed, healthNeed, lifeNeed, retireNeed, type PlanInput } from "./needs";
import { HEALTH_NOW_WORD } from "./prose";
import type { AreaKey } from "./recommend";

/**
 * Which area the budget serves first, for this person — the one planning call the model makes.
 * Figures go in; none may come out. Anything off (a missing or repeated area, a digit in the
 * summary, a slow or failed model) falls back to the owner's fixed order.
 */

export type OrderedBy = "ai" | "fixed";
export interface OrderPick {
  order: AreaKey[];
  by: OrderedBy;
  /** the card's opening lines, digit-free */
  summary: string;
}

export const AREA_KEYS: AreaKey[] = ["life", "health", "ci", "retire"];
const AREA_NAME: Record<AreaKey, string> = { life: "ประกันชีวิต", health: "ค่ารักษาพยาบาล", ci: "โรคร้ายแรง", retire: "เกษียณ" };
const DIGIT = /[0-9๐-๙]/;
/** the model is asked for about 200; a little over still reads fine on the card */
const MAX_SUMMARY = 450;
/** the figures wait for this call, so it gets this long in all, fallbacks included */
export const ORDER_TIMEOUT_MS = 8_000;

export function fixedSummary(first: AreaKey): string {
  return `แผนนี้เริ่มจากด้าน${AREA_NAME[first]}ก่อน เพราะเป็นจุดที่คุณยังเสี่ยงที่สุดตอนนี้`;
}

export const FIXED_PICK: OrderPick = { order: AREA_KEYS, by: "fixed", summary: fixedSummary("life") };

/** exactly the four areas, each once */
export function isOrder(v: unknown): v is AreaKey[] {
  return Array.isArray(v) && v.length === AREA_KEYS.length && AREA_KEYS.every((k) => v.includes(k));
}

export function parseOrder(reply: string): OrderPick {
  const got = parseJsonReply<{ order?: unknown; summary?: unknown }>(reply) ?? {};
  if (!isOrder(got.order)) return FIXED_PICK;
  const order = [...got.order];
  const s = typeof got.summary === "string" ? got.summary.trim() : "";
  const summary = s && s.length <= MAX_SUMMARY && !DIGIT.test(s) ? s : fixedSummary(order[0]);
  return { order, by: "ai", summary };
}

/** The facts, with figures, for the model only. */
export function orderBrief(p: PlanInput): string {
  const life = lifeNeed(p);
  const health = healthNeed(p);
  const ci = ciNeed(p);
  const retire = retireNeed(p);
  const kids = p.children.length ? `ลูก ${p.children.length} คน อายุ ${p.children.join(", ")} ปี` : "ไม่มีลูก";
  return [
    `ลูกค้า: ${p.sex === "F" ? "หญิง" : "ชาย"} อายุ ${p.age} ปี เงินเดือน ${p.income} ค่าใช้จ่ายครอบครัว ${p.expense}/เดือน งบเบี้ยเพิ่ม ${p.budget}/เดือน`,
    `${kids}; ${p.otherDependants ? "มีพ่อแม่/คู่สมรสที่ต้องดูแล" : "ไม่มีคนอื่นที่ต้องดูแล"}; หนี้ ${p.debts}; เงินออม ${p.savings}`,
    `life: ควรมีทุน ${life.need} มีอยู่ ${life.have} ขาด ${life.gap}; อยากได้แบบ${LIFE_WANT_LABEL[p.lifeWant].title}`,
    `health: ${HEALTH_NOW_WORD[p.healthNow]}; อยากใช้${HOSPITAL_LABEL[p.hospital]}; ${
      health.covered ? "มีพอแล้ว" : `ควรมีค่าห้อง ${health.room}/วัน มีอยู่ ${health.haveRoom}`
    }`,
    `ci: ควรมีทุน ${ci.need} มีอยู่ ${ci.have} ขาด ${ci.gap}`,
    `retire: อยากเกษียณอายุ ${p.retireAge} (อีก ${Math.max(0, p.retireAge - p.age)} ปี) อยากมีใช้ ${retire.should}/เดือน มีแล้ว ${retire.have}/เดือน ขาด ${retire.gap}/เดือน`,
    `รายได้สามปี ${p.income * 36}`,
  ].join("\n");
}

export function orderMessages(p: PlanInput): ChatMessage[] {
  return [
    {
      role: "system",
      content: [
        "คุณคือนักวางแผนการเงิน จัดลำดับว่าลูกค้าคนนี้ควรเอางบเบี้ยไปใส่ด้านไหนก่อน จากสี่ด้าน:",
        "life (ครอบครัวถ้าลูกค้าเสียชีวิต), health (ค่ารักษาพยาบาล), ci (โรคร้ายแรง/มะเร็ง), retire (เงินใช้หลังเกษียณ)",
        "เลือกอันดับหนึ่งตามข้อนี้ ไล่จากข้อบน ข้อแรกที่ตรงชนะ:",
        "1. มีลูกที่ยังเรียน มีพ่อแม่หรือคู่สมรสที่ต้องดูแล หรือหนี้มากกว่ารายได้สามปี และ life ยังขาด → life",
        "2. เหลือไม่ถึงสิบห้าปีจะถึงอายุที่อยากเกษียณ และ retire ยังขาดเกินครึ่งของที่อยากมี → retire",
        "3. health ยังขาด → health",
        "4. นอกนั้น ด้านที่ขาดมากที่สุดเทียบกับที่ควรมี",
        "อันดับที่เหลือ: health ก่อน ci ถ้ายังขาดทั้งคู่ แล้วตามด้วยด้านที่ขาดมากกว่า ด้านที่ไม่ขาดแล้วไว้ท้ายสุดเสมอ",
        "ตอบเป็น JSON เท่านั้น: {\"order\":[\"...\",\"...\",\"...\",\"...\"],\"summary\":\"...\"}",
        "order ต้องมี life, health, ci, retire ครบ คนละครั้ง",
        "summary สองประโยคสั้นๆ รวมไม่เกิน 200 ตัวอักษร คุยกับลูกค้าโดยตรงด้วยคำว่า \"คุณ\" บอกว่าควรเริ่มจากด้านไหนและเพราะอะไรในชีวิตของเขา",
        "ห้ามมีตัวเลข จำนวนเงิน อายุ หรือเปอร์เซ็นต์ใดๆ ใน summary เด็ดขาด ห้ามรับประกันผลตอบแทน ห้ามกดดันให้ซื้อ",
      ].join("\n"),
    },
    { role: "user", content: orderBrief(p) },
  ];
}

export async function pickOrder(p: PlanInput): Promise<OrderPick> {
  const ask = chat({ tier: "small", task: "plan-order", messages: orderMessages(p), maxTokens: 600, json: true, timeoutMs: 6_000 })
    .then((res) => parseOrder(res.text))
    .catch(() => FIXED_PICK);
  const late = new Promise<OrderPick>((resolve) => setTimeout(() => resolve(FIXED_PICK), ORDER_TIMEOUT_MS));
  return Promise.race([ask, late]);
}
