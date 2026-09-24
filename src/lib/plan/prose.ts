import { chat, parseJsonReply } from "@/lib/ai/client";
import type { ChatMessage } from "@/lib/ai/types";
import { HOSPITAL_LABEL, LIFE_WANT_LABEL } from "./assumptions";
import type { PlanInput } from "./needs";
import type { AreaKey, PlanResult, Status } from "./recommend";

/**
 * The planner's words. The page lays down every figure; the model writes only why each area
 * matters to this person, and may carry no digit — a field that does is replaced by a fixed
 * sentence, the rule the ตัวเลขชัดๆ angle keeps (content/numbers.ts).
 */

export type ProseKey = "intro" | AreaKey;
export type Prose = Record<ProseKey, string>;

const KEYS: ProseKey[] = ["intro", "life", "health", "ci", "retire"];
const DIGIT = /[0-9๐-๙]/;
const MAX_CHARS = 600;

export const FALLBACK_PROSE: Prose = {
  intro: "แผนนี้เริ่มจากสิ่งที่ครอบครัวของคุณต้องใช้จริง แล้วค่อยเลือกแบบประกันให้พอดีกับงบที่คุณตั้งไว้",
  life: "ถ้าวันหนึ่งคุณไม่อยู่ รายได้ของคุณหายไปทันที แต่หนี้และค่าใช้จ่ายของครอบครัวยังเดินต่อ ทุนประกันชีวิตคือเงินที่มาทำหน้าที่แทนคุณ",
  health: "ค่ารักษาในโรงพยาบาลเอกชนสูงขึ้นทุกปี ประกันสุขภาพช่วยให้คุณเลือกโรงพยาบาลได้ โดยไม่ต้องดึงเงินออมมาจ่าย",
  ci: "โรคร้ายแรงไม่ได้มีแค่ค่ารักษา แต่ยังทำให้ต้องหยุดงานนาน เงินก้อนจากประกันโรคร้ายแรงช่วยให้ครอบครัวมีรายได้ระหว่างรักษาตัว",
  retire: "เงินบำนาญคือรายได้ที่ยังเข้ามาทุกเดือนหลังเกษียณ และเบี้ยที่จ่ายยังนำไปลดหย่อนภาษีได้ตามเงื่อนไขสรรพากร",
};

const STATUS_WORD: Record<Status, string> = {
  fits: "เสนอเต็มตามที่ควรมี",
  reduced: "งบไม่พอ เสนอน้อยกว่าที่ควรมี",
  short: "งบที่เหลือไม่พอสำหรับด้านนี้",
  covered: "มีพอแล้ว ไม่ต้องเพิ่ม",
  unavailable: "อายุเกินเกณฑ์ของแบบที่มี",
};

const AREA_WORD: Record<AreaKey, string> = {
  life: "ครอบครัวถ้าลูกค้าเสียชีวิต",
  health: "ค่ารักษาพยาบาล",
  ci: "โรคร้ายแรง/มะเร็ง",
  retire: "เกษียณและภาษี",
};

export const HEALTH_NOW_WORD: Record<PlanInput["healthNow"], string> = {
  none: "ไม่มีสิทธิ์ค่ารักษา",
  public: "ใช้ประกันสังคมหรือบัตรทอง",
  employer: "มีสวัสดิการบริษัท (หมดเมื่อออกจากงาน)",
  private: "มีประกันสุขภาพส่วนตัว",
};

/** The facts, for the model only; figures may appear here but must not come back. */
export function planBrief(p: PlanInput, r: PlanResult): string {
  const kids = p.children.length ? `ลูก ${p.children.length} คน อายุ ${p.children.join(", ")} ปี` : "ไม่มีลูก";
  const lines = [
    `ลูกค้า: ${p.sex === "F" ? "หญิง" : "ชาย"} อายุ ${p.age} ปี เงินเดือน ${p.income} บาท ค่าใช้จ่ายครอบครัว ${p.expense} บาท/เดือน`,
    `${kids}; ${p.otherDependants ? "มีพ่อแม่/คู่สมรสที่ต้องดูแล" : "ไม่มีคนอื่นที่ต้องดูแล"}; หนี้ ${p.debts} บาท; เงินออม ${p.savings} บาท`,
    `ค่ารักษา: ${HEALTH_NOW_WORD[p.healthNow]}; อยากใช้${HOSPITAL_LABEL[p.hospital]}`,
    `ประกันชีวิตที่อยากได้: ${LIFE_WANT_LABEL[p.lifeWant].title} (${LIFE_WANT_LABEL[p.lifeWant].note})`,
    `เกษียณ: อยากเกษียณอายุ ${p.retireAge} อยากมีใช้เดือนละ ${p.retireMonthly} มีบำนาญแล้ว ${p.pensionHave}/เดือน เงินก้อนเพื่อเกษียณ ${p.retireLump}`,
    `ลำดับที่แผนนี้ใช้งบ: ${r.order.map((k) => AREA_WORD[k]).join(" → ")}`,
    ...r.areas.map((a) => `ด้าน${AREA_WORD[a.key]}: ${STATUS_WORD[a.status]}${a.offer ? ` (${a.offer.product})` : ""}`),
  ];
  return lines.join("\n");
}

export function proseMessages(p: PlanInput, r: PlanResult): ChatMessage[] {
  return [
    {
      role: "system",
      content: [
        "คุณคือนักวางแผนการเงินที่อบอุ่นและตรงไปตรงมา เขียนภาษาไทยคุยกับลูกค้าโดยตรง ใช้คำว่า \"คุณ\"",
        "ตอบเป็น JSON เท่านั้น: {\"intro\":\"...\",\"life\":\"...\",\"health\":\"...\",\"ci\":\"...\",\"retire\":\"...\"}",
        "แต่ละช่อง 2–3 ประโยค อธิบายว่าด้านนั้นสำคัญกับชีวิตของลูกค้าคนนี้อย่างไร",
        "ห้ามมีตัวเลข จำนวนเงิน อายุ หรือเปอร์เซ็นต์ใดๆ เด็ดขาด หน้าเว็บแสดงตัวเลขเอง",
        "ห้ามพูดถึงผลประโยชน์ที่ไม่มีในข้อมูล ห้ามรับประกันผลตอบแทน ห้ามกดดันให้ซื้อ",
        "ด้านที่มีพอแล้ว ให้ชมว่าเตรียมไว้ดี ด้านที่งบไม่พอ ให้อธิบายอย่างให้กำลังใจว่าเริ่มจากเท่าที่ทำได้ก่อน",
        "ด้านที่อายุเกินเกณฑ์ ให้บอกสั้นๆ ว่าแบบที่มีรับไม่ได้ และแนะนำให้ปรึกษาตัวแทน",
      ].join("\n"),
    },
    { role: "user", content: planBrief(p, r) },
  ];
}

export function parseProse(reply: string): Prose {
  const got = parseJsonReply<Partial<Record<ProseKey, unknown>>>(reply) ?? {};
  const out = { ...FALLBACK_PROSE };
  for (const k of KEYS) {
    const v = got[k];
    if (typeof v === "string" && v.trim() && !DIGIT.test(v) && v.length <= MAX_CHARS) out[k] = v.trim();
  }
  return out;
}

export async function explain(p: PlanInput, r: PlanResult): Promise<Prose> {
  try {
    const res = await chat({ tier: "small", task: "plan-advice", messages: proseMessages(p, r), maxTokens: 1200, json: true });
    return parseProse(res.text);
  } catch {
    return FALLBACK_PROSE;
  }
}
