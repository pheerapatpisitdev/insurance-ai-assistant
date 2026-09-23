import { chat, parseJsonReply } from "@/lib/ai/client";

/**
 * The second check: a cheap model reads the finished post for Thai that is wrong or stiff.
 *
 * It suggests and never rewrites. Each suggestion names the exact words to change, so the page
 * can offer it as one click — and a suggestion quoting words the post does not contain is
 * dropped, because it could not be applied and would only be one more thing to read.
 */

export interface Fix {
  find: string;
  replace: string;
  why: string;
}

const SYSTEM = [
  "คุณคือบรรณาธิการภาษาไทย ตรวจโพสต์โฆษณาประกันที่ได้รับ",
  "หาเฉพาะ: คำสะกดผิด วรรณยุกต์ผิด การเว้นวรรคผิด คำซ้ำ และประโยคที่อ่านแล้วแข็งหรือไม่เป็นธรรมชาติ",
  "ห้ามแก้ตัวเลข ชื่อแบบประกัน แฮชแท็ก หรือความหมายของเนื้อหา ห้ามเขียนใหม่ทั้งย่อหน้า",
  "find ต้องคัดลอกข้อความจากโพสต์ตรงตัวทุกตัวอักษร และสั้นที่สุดที่ยังชัดเจน",
  "ถ้าไม่มีอะไรต้องแก้ ให้ตอบ fixes เป็นอาร์เรย์ว่าง",
  'ตอบเป็น JSON อย่างเดียว: {"fixes":[{"find":"…","replace":"…","why":"…"}]} ไม่เกิน 8 จุด',
].join("\n");

export function parseProof(reply: string, post: string): Fix[] {
  const raw = parseJsonReply<{ fixes?: unknown }>(reply);
  if (!raw || !Array.isArray(raw.fixes)) return [];
  const out: Fix[] = [];
  for (const f of raw.fixes as Record<string, unknown>[]) {
    const find = typeof f?.find === "string" ? f.find : "";
    const replace = typeof f?.replace === "string" ? f.replace : "";
    const why = typeof f?.why === "string" ? f.why.trim() : "";
    if (!find || find === replace || !post.includes(find)) continue;
    out.push({ find, replace, why });
  }
  return out.slice(0, 8);
}

export async function proofread(post: string): Promise<{ fixes: Fix[]; costThb: number }> {
  const r = await chat({
    tier: "small",
    task: "content-proofread",
    messages: [{ role: "system", content: SYSTEM }, { role: "user", content: post }],
    maxTokens: 900,
    json: true,
  });
  return { fixes: parseProof(r.text, post), costThb: r.costThb };
}
