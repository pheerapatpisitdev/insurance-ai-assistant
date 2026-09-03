/**
 * Some PDFs embed a font subset whose ToUnicode map is wrong, so every glyph decodes to the
 * same character: "เงื่อนไขทั่วไป" comes out as "เเเเเเเเเเเเเเ". The text looks like the right
 * length, so without this check the document would be indexed as convincing nonsense and the
 * bot would answer from it. Scanned pages are the other failure: almost no text at all.
 */
export interface TextQuality {
  ok: boolean;
  reason?: string;
  distinctRatio: number;
  topCharShare: number;
  length: number;
}

const MIN_CHARS = 200;
const MIN_DISTINCT = 20;
const MAX_TOP_SHARE = 0.35;

export function assessText(text: string): TextQuality {
  const stripped = text.replace(/\s/g, "");
  const length = stripped.length;
  if (length < MIN_CHARS) {
    return {
      ok: false,
      reason: "ไฟล์นี้แทบไม่มีข้อความให้อ่าน อาจเป็นไฟล์สแกนเป็นภาพ ต้องใช้ไฟล์ที่เป็นข้อความ",
      distinctRatio: 0, topCharShare: 0, length,
    };
  }

  const counts = new Map<string, number>();
  for (const ch of stripped) counts.set(ch, (counts.get(ch) ?? 0) + 1);
  const distinct = counts.size;
  const top = Math.max(...counts.values());
  const distinctRatio = distinct / length;
  const topCharShare = top / length;

  if (distinct < MIN_DISTINCT || topCharShare > MAX_TOP_SHARE) {
    return {
      ok: false,
      reason: "อ่านตัวอักษรจากไฟล์นี้ไม่ถูกต้อง ฟอนต์ในไฟล์ไม่มีตารางแปลงอักขระ "
        + "ลองบันทึกไฟล์ใหม่จากโปรแกรมต้นทางแล้วอัปโหลดอีกครั้ง",
      distinctRatio, topCharShare, length,
    };
  }
  return { ok: true, distinctRatio, topCharShare, length };
}
