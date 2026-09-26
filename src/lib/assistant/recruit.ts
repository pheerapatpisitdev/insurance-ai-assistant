import type { Reply } from "./common";

/**
 * Someone who wants to join the team, not to buy (owner, 2026-09-26).
 *
 * หาทีม posts on /content end by asking the reader to write "สนใจร่วมทีม" to the Page. Before
 * this, that message met the sales brains and was answered with a plan. It is the owner's to
 * answer, so the bot says two fixed things — thanks, the team manager will write — and asks
 * one question the owner can start from. No model: there is nothing here for one to decide.
 *
 * The pattern wants a verb of joining next to ตัวแทน, so a customer asking for "ตัวแทน" to
 * look after them ("ขอคุยกับตัวแทน", "อยากได้ตัวแทนดูแล") is left to the sales side. The
 * cases it does and does not catch are in tests/chat/recruit.test.ts.
 */
const JOINING =
  /(?:สมัคร|อยาก(?:จะ)?|สนใจ(?:จะ)?|รับสมัคร|เปิดรับ)\s*(?:เป็น|มาเป็น|เข้าเป็น)?\s*(?:ตัวแทน|นายหน้า)|ร่วมทีม|เข้าทีม|สมัครงาน|(?:สอบ|ขอ)\s*(?:ใบ)?\s*(?:อนุญาต|ไลเซนส์|license)/i;

export function wantsToJoin(text: string): boolean {
  return JOINING.test(text);
}

export const RECRUIT_ASK = "ระหว่างรอ เล่าสั้นๆ ได้ไหมครับ ว่าตอนนี้ทำงานอะไรอยู่";
const THANKS = "ขอบคุณที่สนใจร่วมทีมครับ 😊 เดี๋ยวผู้จัดการทีมทักกลับมาคุยรายละเอียดในแชทนี้ครับ";
const NOTED = "ขอบคุณครับ 🙏 ส่งต่อให้ผู้จัดการทีมแล้ว เดี๋ยวทักกลับในแชทนี้นะครับ";

/** A message that asks something — it goes back to the brains, whatever came before it. */
const ASKS = /ไหม|มั้ย|หรือเปล่า|รึเปล่า|อะไร|เท่าไหร่|เท่าไร|กี่|ยังไง|อย่างไร|ทำไม|ที่ไหน|\?/;

/**
 * The hand-over, or null when the message is not about joining.
 *
 * `lastSaid` is what the bot said last: the answer to RECRUIT_ASK ("ทำงานบริษัทครับ") is
 * part of the hand-over too, or it would be read as a customer and offered a plan.
 */
export function recruitReply(asked: string, lastSaid: string | undefined): (Reply & { recruit: true }) | null {
  if (wantsToJoin(asked)) return { messages: [{ text: THANKS }, { text: RECRUIT_ASK }], recruit: true };
  if (lastSaid?.trimEnd().endsWith(RECRUIT_ASK) && !ASKS.test(asked)) return { messages: [{ text: NOTED }], recruit: true };
  return null;
}
