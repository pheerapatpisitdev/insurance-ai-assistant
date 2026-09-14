import { iHealthyFacts } from "@/lib/ihealthy-facts";
import { HEALTH_DECLARATION, HEALTH_QUESTION } from "../common";

/**
 * The answers the agent types by hand about the health contract.
 *
 * A separate list from Life Protect's rather than a shared one with exceptions, because the
 * two contracts disagree about the two questions customers ask most: the life plan's premium
 * is level for the whole paying term and relieves tax up to a hundred thousand; this one
 * re-prices at every birthday and relieves twenty-five. A bot answering a health customer out
 * of the life list would be wrong about both, in writing, on the page's own letterhead.
 */
export interface HealthFaqEntry {
  key: string;
  match: RegExp;
  /** a function, because two of them are read off the contract sheet rather than typed */
  answer: () => string;
}

/**
 * Order matters: the declaration is first because a message that mentions a condition and
 * asks a price is, above everything else, a message that must not be told it will be accepted.
 */
const FAQ: HealthFaqEntry[] = [
  { key: "health", match: HEALTH_QUESTION, answer: () => HEALTH_DECLARATION },
  {
    key: "tax",
    match: /ลดหย่อน|ภาษี|\btax\b/i,
    answer: () =>
      "เบี้ยสัญญาเพิ่มเติมสุขภาพใช้ลดหย่อนภาษีได้ตามที่จ่ายจริง สูงสุด 25,000 บาทต่อปีครับ\n"
      + "และเมื่อรวมกับเบี้ยประกันชีวิตแล้วต้องไม่เกิน 100,000 บาทต่อปี ตามหลักเกณฑ์ของกรมสรรพากร",
  },
  {
    key: "rises",
    match: /เบี้ยขึ้น|เบี้ยเพิ่ม|เบี้ยคงที่|ขึ้นตามอายุ|ปรับขึ้น|ปีหน้า[^\n]{0,10}เบี้ย|เบี้ย[^\n]{0,10}ปีหน้า/i,
    answer: () =>
      "เบี้ยส่วนค่ารักษาพยาบาลปรับตามอายุที่เพิ่มขึ้นทุกปีครับ ตัวเลขที่คิดให้เป็นเบี้ยปีแรก\n"
      + "ส่วนเบี้ยของสัญญาหลักคงที่ตลอดระยะเวลาชำระ",
  },
  {
    key: "waiting",
    match: /รอคอย|ระยะรอ|เริ่มคุ้มครอง|คุ้มครองเมื่อไ|ซื้อแล้ว[^\n]{0,8}(?:ใช้|เคลม)|เคลมได้เลย/i,
    answer: () => {
      const { terms } = iHealthyFacts();
      return `สัญญาเพิ่มเติมนี้มีระยะเวลารอคอย ${terms.waitingDays} วันนับจากวันเริ่มคุ้มครองครับ\n`
        + `ส่วนโรคเหล่านี้รอ ${terms.specialWaitingDays} วัน — ${terms.specialWaitingDiseases.join(" · ")}\n`
        + "อุบัติเหตุคุ้มครองทันที ไม่มีระยะรอคอย";
    },
  },
  {
    key: "monthly",
    match: /รายเดือน|จ่ายยังไง|ชำระยังไง|ผ่อน|ตัดบัตร|หักบัญชี|เป็นงวด|งวดแรก/i,
    answer: () =>
      "จ่ายรายเดือนได้ครับ งวดแรกชำระ 2 งวด แล้วระบบจะตัดอัตโนมัติอีกครั้งในงวดที่ 3\n"
      + "จะเลือกจ่ายราย 6 เดือน หรือรายปีก็ได้เหมือนกันครับ",
  },
];

/** The entry a message asks for, or undefined when it asks none of these. */
export function healthFaqMatch(text: string): HealthFaqEntry | undefined {
  return FAQ.find((e) => e.match.test(text));
}

/** The written answer for a message, or undefined when it asks none of these. */
export function healthFaqAnswer(text: string): string | undefined {
  return healthFaqMatch(text)?.answer();
}
