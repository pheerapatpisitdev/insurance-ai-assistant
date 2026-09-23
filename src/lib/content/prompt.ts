import type { ChatMessage } from "@/lib/ai/types";
import type { PiecePlan } from "./plan";
import { POLICY_RULES_TH } from "./policy";

/**
 * What the content generator asks of the model.
 *
 * The rules that matter most are the ones about numbers and claims, and they are stated as
 * prohibitions the checks after it can see broken: a number not in the brief, a word on the
 * owner's list. The model is not trusted to have followed them — it is told, and then checked.
 */

export type Format = "post" | "script";
export type Length = "30" | "60" | "180";

export const ANGLES = [
  { id: "family", label: "คุ้มครองครอบครัว" },
  { id: "tax", label: "ลดหย่อนภาษี" },
  { id: "child", label: "ซื้อให้ลูก" },
  { id: "retire", label: "เกษียณ" },
  { id: "story", label: "เล่าเป็นเรื่อง (สถานการณ์สมมติ)" },
] as const;

export type AngleId = (typeof ANGLES)[number]["id"] | "custom" | "";

export const LENGTHS: { id: Length; label: string }[] = [
  { id: "30", label: "30 วินาที" },
  { id: "60", label: "60 วินาที" },
  { id: "180", label: "2–3 นาที" },
];

export interface Ask {
  brief: string;
  format: Format;
  angle: AngleId;
  /** the owner's own angle, used when `angle` is "custom" */
  custom: string;
  length: Length | null;
  /** one per piece, from the planner; the writer writes to them and does not change their hooks */
  plans: PiecePlan[];
}

const SYSTEM = [
  "คุณคือนักเขียนคอนเทนต์ให้ตัวแทนประกันชีวิตในประเทศไทย เขียนภาษาไทยแบบที่คนทั่วไปพูดกัน อ่านง่ายบนมือถือ อบอุ่น จริงใจ ไม่ขายแรง",
  "",
  "กฎที่ห้ามละเมิด:",
  "1. ใช้เฉพาะข้อมูลในหัวข้อ “ข้อมูลผลิตภัณฑ์” ห้ามเพิ่มความคุ้มครอง เงื่อนไข หรือสิทธิประโยชน์ที่ไม่มีในนั้น",
  "2. ตัวเลขทุกตัว (เบี้ย ทุน อายุ เปอร์เซ็นต์ จำนวนโรค) ต้องคัดลอกจากข้อมูลตรงตัว ห้ามคำนวณ ห้ามปัดเศษ ห้ามแปลงรายปีเป็นรายเดือน ห้ามประมาณ ถ้าไม่มีตัวเลขที่ต้องการ ให้เขียนโดยไม่ใส่ตัวเลข",
  "3. ห้ามคำโฆษณาเกินจริง เช่น การันตี รับประกันผลตอบแทน ดีที่สุด ถูกที่สุด คุ้มที่สุด อันดับ 1 ไม่มีความเสี่ยง ได้เงินคืนแน่นอน",
  "4. ห้ามเขียนขัดกับ “ข้อควรระวัง” และถ้าข้อควรระวังบอกว่าห้ามระบุเบี้ย ห้ามใส่ราคาเลย",
  "5. ห้ามพูดถึงหรือเปรียบเทียบกับบริษัทประกันอื่น",
  "6. ห้ามแต่งว่าเป็นเรื่องของลูกค้าจริงหรือรีวิวจริง ถ้าเล่าเป็นเรื่อง ให้เขียนชัดว่าเป็นสถานการณ์สมมติ เช่น “สมมติว่า…”",
  "7. ห้ามเขียนข้อความเตือนหรือ disclaimer เอง ระบบจะต่อท้ายให้",
  "8. ผู้เขียนเป็นตัวแทนผู้ชาย ใช้คำลงท้าย “ครับ” เท่านั้น ห้ามใช้ “ค่ะ” หรือ “คะ”",
  "",
  POLICY_RULES_TH,
  "",
  "คุณจะได้รับแผนของแต่ละชิ้น (มุม + hook) มาแล้ว ให้เขียนเนื้อหาของทุกชิ้นตามแผน เรียงตามลำดับ",
  "ห้ามเปลี่ยน hook และห้ามพิมพ์ hook ซ้ำในเนื้อหา — hook จะถูกวางไว้หน้าเนื้อหาอยู่แล้ว",
  "ถ้า hook สัญญาว่าจะเล่า N ข้อ เนื้อหาต้องมีครบ N ข้อพอดี เรียงเลข 1, 2, 3…",
  "",
  "ตอบเป็น JSON อย่างเดียว ไม่มีข้อความอื่น ตามรูปแบบนี้ (จำนวนชิ้นเท่ากับแผน):",
  '{"pieces":[{"body":"…","closing":"…","hashtags":["#…"],"imagePrompt":"…","poster":{"layout":"bottom","blocks":[{"kind":"badge","text":"…"},{"kind":"headline","text":"…"},{"kind":"sub","text":"…"},{"kind":"footer","text":"…"}]}}]}',
  "- body: เนื้อหาหลัก ต่อจาก hook ไม่รวมประโยคปิด ใช้ \\n ขึ้นบรรทัดใหม่",
  "- closing: ประโยคปิดที่ชวนให้ทักแชทหรือคอมเมนต์ 1–2 บรรทัด",
  "- hashtags: 3–6 แท็กภาษาไทยหรืออังกฤษ",
  "- imagePrompt: คำบรรยายภาพประกอบเป็นภาษาอังกฤษ 1–2 ประโยค คนไทย แสงธรรมชาติ ห้ามมีตัวหนังสือในภาพ",
  "- poster: ข้อความบนภาพโพสต์ที่คนเห็นก่อนอ่านแคปชัน — สั้นกว่าแคปชันมาก อ่านจบใน 2 วินาที",
  "  · headline (บังคับ) ไม่เกิน 60 ตัวอักษร คือใจความเดียวที่อยากให้จำ ไม่ต้องซ้ำ hook คำต่อคำ",
  "  · badge (ไม่บังคับ) ป้ายเล็กไม่เกิน 20 ตัวอักษร เช่น ชื่อประเภทประกัน · sub (ไม่บังคับ) ไม่เกิน 90 ตัวอักษร · footer (ไม่บังคับ) ไม่เกิน 40 ตัวอักษร เช่น ชวนทักแชท",
  "  · ตัวเลขบนภาพต้องคัดลอกจากข้อมูลผลิตภัณฑ์ตรงตัว และกฎทุกข้อด้านบนใช้กับภาพด้วย",
  "  · layout เลือก top, center หรือ bottom ตามจังหวะของข้อความ — ห้ามกำหนดสี ระบบเลือกให้",
].join("\n");

function formatBrief(a: Ask): string {
  if (a.format === "post") {
    return [
      "งาน: โพสต์เฟซบุ๊ก",
      "- body 5–10 บรรทัดสั้นๆ เว้นบรรทัดให้อ่านง่าย ใช้อีโมจิได้ไม่เกินบรรทัดละ 1 ตัว",
      "- เล่าปัญหาของคนอ่านก่อน แล้วค่อยพาไปที่แบบประกัน",
    ].join("\n");
  }
  const secs = a.length ?? "60";
  const label = secs === "180" ? "2–3 นาที" : `${secs} วินาที`;
  return [
    `งาน: สคริปต์พูดหน้ากล้อง ความยาวรวมประมาณ ${label}`,
    "- hook คือประโยคที่พูดใน 3 วินาทีแรก [0–3 วิ] body จึงเริ่มหลังจากนั้น",
    "- body แบ่งเป็นช่วง ขึ้นต้นแต่ละช่วงด้วยเวลาในวงเล็บเหลี่ยม เช่น [3–15 วิ] เขียนเป็นภาษาพูด",
    "- ใส่ท่าทางในวงเล็บ เช่น (ชี้ไปที่กล้อง) และข้อความขึ้นจอเป็น {จอ: …} เฉพาะจุดสำคัญ",
    "- closing คือช่วงปิดท้าย ขึ้นต้นด้วยเวลาในวงเล็บเหลี่ยมเช่นกัน",
    "- hashtags ใช้สำหรับแคปชันใต้คลิป",
  ].join("\n");
}

function angleLine(a: Ask): string {
  if (a.angle === "custom") return a.custom.trim() ? `มุมที่อยากเล่า: ${a.custom.trim()}` : "";
  const found = ANGLES.find((x) => x.id === a.angle);
  return found ? `มุมที่อยากเล่า: ${found.label}` : "";
}

export function planLines(plans: PiecePlan[]): string {
  return [
    "แผนของแต่ละชิ้น:",
    ...plans.map((p, i) => `ชิ้นที่ ${i + 1}\n  มุม: ${p.angle}\n  hook: ${p.hook}`),
  ].join("\n");
}

export function buildMessages(a: Ask): ChatMessage[] {
  const user = [
    `ข้อมูลผลิตภัณฑ์:\n${a.brief}`,
    [formatBrief(a), angleLine(a)].filter(Boolean).join("\n"),
    planLines(a.plans),
  ].join("\n\n");
  return [
    { role: "system", content: SYSTEM },
    { role: "user", content: user },
  ];
}
