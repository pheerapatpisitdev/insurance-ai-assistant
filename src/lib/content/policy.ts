/**
 * Facebook's advertising rules, checked by pattern and never by a model — so it costs nothing
 * and runs on every piece, including after every edit.
 *
 * Ported from the owner's Maryjane project (src/lib/ad-policy.ts), where it exists because
 * Thai finance copy writes "คุณกำลังมีหนี้อยู่ใช่ไหม" as a matter of course and Meta forbids
 * asserting or implying anything personal about the reader: health, money, debt, age, job.
 * Insurance copy is the same temptation with a different noun — "คุณป่วยอยู่ใช่ไหม" — and the
 * account that gets restricted is the owner's advertising account.
 *
 * The same rules go into the writer's prompt (POLICY_RULES_TH): stopping the sentence at the
 * source is cheaper than catching it afterwards, and catching it afterwards is still needed.
 */
export type PolicySeverity = "block" | "warn";

export interface PolicyRule {
  code: string;
  pattern: RegExp;
  severity: PolicySeverity;
  message: string;
  fix: string;
}

export const POLICY_RULES: PolicyRule[] = [
  {
    code: "health_you",
    pattern: /คุณ[^.!?\n]{0,20}?(เป็นโรค|ป่วย|เป็นมะเร็ง|เป็นเบาหวาน|ความดันสูง|อ้วน|ซึมเศร้า)/,
    severity: "block",
    message: "บอกใบ้ว่าคนอ่านมีปัญหาสุขภาพ — Facebook ห้ามในโฆษณา",
    fix: "พูดถึงความคุ้มครองแทนตัวคนอ่าน เช่น “ถ้าวันหนึ่งต้องรักษาตัว…”",
  },
  {
    code: "debt_you",
    pattern: /คุณ[^.!?\n]{0,20}?(มีหนี้|เป็นหนี้|หนี้สิน|ติดแบล็?คลิสต์|ติดเครดิตบูโร)/,
    severity: "block",
    message: "บอกใบ้ว่าคนอ่านมีหนี้ — Facebook ห้ามในโฆษณา",
    fix: "เล่าเป็นสถานการณ์ทั่วไป เช่น “บ้านที่ยังผ่อนไม่หมด”",
  },
  {
    code: "age_you",
    pattern: /คุณ[^.!?\n]{0,10}อายุ\s?\d{2}|อายุ\s?\d{2}\s?(\+|ปีขึ้นไป|ขึ้นไป)[^.!?\n]{0,15}(สมัคร|รับได้|ผ่าน)/,
    severity: "block",
    message: "ระบุอายุของคนอ่านตรงๆ — Facebook ห้ามในโฆษณา",
    fix: "ยกเป็นตัวอย่างบุคคลที่สาม เช่น “ตัวอย่าง ผู้หญิงอายุ 35…” หรือไปตั้งอายุที่กลุ่มเป้าหมายของแอด",
  },
  {
    code: "job_you",
    pattern: /คุณ[^.!?\n]{0,15}?(ตกงาน|ว่างงาน|ไม่มีงานทำ)/,
    severity: "block",
    message: "บอกใบ้สถานะงานของคนอ่าน — Facebook ห้ามในโฆษณา",
    fix: "เปลี่ยนเป็นข้อความกลางๆ ที่ไม่ระบุตัวคนอ่าน",
  },
  {
    code: "guarantee",
    pattern: /(การันตี|รับรอง)[^.!?\n]{0,12}(อนุมัติ|ผ่าน|ได้เงิน|รับประกันภัย)|อนุมัติ\s?100\s?%|รับทุกคน/,
    severity: "block",
    message: "รับประกันผลการสมัครแบบเด็ดขาด — ผิดมาตรฐานสินค้าการเงินของ Facebook และบริษัทพิจารณารับประกันทุกราย",
    fix: "บอกเงื่อนไขจริงแทน เช่น “สมัครง่าย ตัวแทนช่วยดูเงื่อนไขให้”",
  },
  {
    code: "pii_request",
    pattern: /(ส่ง|แจ้ง|พิมพ์)[^.!?\n]{0,10}(เลขบัตรประชาชน|เลขบัญชี|รหัสผ่าน)/,
    severity: "block",
    message: "ขอข้อมูลส่วนตัวในโพสต์ — Facebook ห้าม",
    fix: "ชวนทักแชทก่อน แล้วค่อยขอข้อมูลในแชท",
  },
  {
    code: "superlative",
    pattern: /(ถูกที่สุดในประเทศ|ดีที่สุดในโลก|อันดับ\s?1\s?ของประเทศ|ดีที่สุดในไทย)/,
    severity: "warn",
    message: "คำเกินจริงที่พิสูจน์ไม่ได้ — เสี่ยงโฆษณาถูกปฏิเสธ",
    fix: "ใช้ตัวเลขจริงจากตารางเบี้ยแทนคำว่าที่สุด",
  },
];

export interface PolicyFinding {
  code: string;
  severity: PolicySeverity;
  message: string;
  fix: string;
  /** the words that tripped the rule, so the owner can find them */
  match: string;
}

/**
 * "ถ้าวันหนึ่งคุณป่วยหนัก" supposes; "คุณป่วยอยู่ใช่ไหม" asserts. Insurance is sold on the
 * first kind and Meta's rule is about the second, so a match that opens on one of these words
 * is left alone. Only the rules about the reader's own attributes have this out; a guarantee
 * is a guarantee however the sentence begins.
 */
const SUPPOSING = /(ถ้า|หาก|สมมติ(ว่า)?|เมื่อ|วันที่|ในวันที่|ถ้าวันหนึ่ง)\s*$/;
const ABOUT_THE_READER = new Set(["health_you", "debt_you", "job_you"]);
// those three patterns are lazy on purpose: a greedy one swallows "ถ้าคุณป่วย… แล้วคุณป่วยอยู่"
// as a single match that opens on ถ้า, and the second, asserting half goes unread

export function checkPolicy(text: string): PolicyFinding[] {
  const out: PolicyFinding[] = [];
  for (const rule of POLICY_RULES) {
    const every = new RegExp(rule.pattern.source, "g");
    for (const m of text.matchAll(every)) {
      const before = text.slice(Math.max(0, m.index - 14), m.index);
      if (ABOUT_THE_READER.has(rule.code) && SUPPOSING.test(before)) continue;
      out.push({ code: rule.code, severity: rule.severity, message: rule.message, fix: rule.fix, match: m[0] });
      break;
    }
  }
  return out;
}

/** the same rules, as the writer is told them */
export const POLICY_RULES_TH = [
  "กฎโฆษณาของ Facebook (ห้ามฝ่าฝืน):",
  "- ห้ามชี้หรือบอกใบ้ว่าคนอ่านมีลักษณะส่วนตัว เช่น ป่วย เป็นโรค มีหนี้ อายุเท่าไร ตกงาน — ห้ามเขียน “คุณป่วยอยู่ใช่ไหม” หรือ “คุณอายุ 40 แล้ว” ให้เล่าจากมุมของความคุ้มครองหรือยกตัวอย่างบุคคลที่สามแทน",
  "- ห้ามรับประกันผลการสมัคร เช่น อนุมัติ 100% รับทุกคน",
  "- ห้ามขอเลขบัตรประชาชน เลขบัญชี หรือข้อมูลส่วนตัวในโพสต์",
  "- ห้ามคำเกินจริงที่พิสูจน์ไม่ได้ เช่น ดีที่สุดในประเทศ อันดับ 1",
].join("\n");
