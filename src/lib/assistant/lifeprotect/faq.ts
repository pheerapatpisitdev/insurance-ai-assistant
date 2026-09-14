import { HEALTH_DECLARATION, HEALTH_QUESTION } from "../common";

/**
 * The five answers the agent types by hand every day, taken from the campaign's own inbox.
 *
 * Constants matched by pattern and returned before any model is asked, for the same reason
 * the insurer's name is: these are claims about a contract, and the page is held to them. The
 * wording is the agency's own except where an absolute would have been wrong — a life policy
 * does carry standard exclusions, and whether a particular person can be insured is the
 * underwriter's answer and not this code's.
 */

export interface FaqEntry {
  key: string;
  match: RegExp;
  answer: string;
}

/**
 * Order matters: health is first because a message that mentions a condition and asks a
 * price is, above everything else, a message that must not be told it will be accepted.
 */
export const FAQ: FaqEntry[] = [
  {
    key: "health",
    match: HEALTH_QUESTION,
    answer: HEALTH_DECLARATION,
  },
  {
    key: "tax",
    match: /ลดหย่อน|ภาษี|\btax\b/i,
    answer:
      "ใช้ลดหย่อนภาษีได้ครับ ตามเบี้ยที่ชำระจริง สูงสุด 100,000 บาทต่อปี "
      + "(นับรวมกับประกันชีวิตฉบับอื่นที่มีอยู่) ตามหลักเกณฑ์ของกรมสรรพากร",
  },
  {
    key: "all_causes",
    match: /ทุกกรณี|ทุกสาเหตุ|กรณีไหนบ้าง|ตายแบบไหน|เสียชีวิตแบบไหน|อุบัติเหตุ|ป่วยตาย|คุ้มครองอะไรบ้าง|ข้อยกเว้น/i,
    answer:
      "คุ้มครองการเสียชีวิตทุกกรณีครับ ทั้งเจ็บป่วยและอุบัติเหตุ ตลอด 24 ชั่วโมง ทั่วโลก\n"
      + "มีเพียงข้อยกเว้นมาตรฐานที่ระบุไว้ในกรมธรรม์ เช่น ฆ่าตัวตายภายใน 1 ปีแรก "
      + "หรือถูกผู้รับประโยชน์ฆ่า",
  },
  {
    key: "monthly",
    match: /รายเดือน|จ่ายยังไง|ชำระยังไง|ผ่อน|ตัดบัตร|หักบัญชี|เป็นงวด|งวดแรก/i,
    answer:
      "จ่ายรายเดือนได้ครับ งวดแรกชำระ 2 งวด แล้วระบบจะตัดอัตโนมัติอีกครั้งในงวดที่ 3\n"
      + "จะเลือกจ่ายราย 6 เดือน หรือรายปีก็ได้เหมือนกันครับ",
  },
  {
    key: "long_pay",
    match: /ถึง\s*99|จนถึง\s*99|ส่งยาว|จ่ายยาว|ส่งไม่ไหว|จ่ายไม่ไหว|หาเงินที่ไหน|แก่แล้ว|อายุเยอะ|ส่งกี่ปี|จ่ายกี่ปี|ชำระกี่ปี/i,
    answer:
      "เบี้ยของแบบนี้คงที่ตลอดระยะเวลาชำระครับ ไม่ปรับขึ้นตามอายุ ตอนอายุมากก็จ่ายเท่าเดิมกับวันที่เริ่ม\n"
      + "ถ้าไม่อยากผูกยาว มีแบบจ่ายสั้นให้เลือก จ่าย 9 ปี หรือ 19 ปี แล้วคุ้มครองต่อถึงอายุ 99 เหมือนกันครับ\n"
      + 'อยากให้คิดเบี้ยแบบสั้นให้ดูด้วยไหมครับ บอกมาได้เลย (เช่น "จ่าย 19 ปี")',
  },
];

/** The entry a message asks for, or undefined when it asks none of these. */
export function faqMatch(text: string): FaqEntry | undefined {
  return FAQ.find((e) => e.match.test(text));
}

/** The written answer for a message, or undefined when it asks none of these. */
export function faqAnswer(text: string): string | undefined {
  return faqMatch(text)?.answer;
}
