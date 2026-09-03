/**
 * Some Thai PDFs embed a font whose ToUnicode map sends the combining marks into the C1
 * control range instead of the Thai block, so "ได้" arrives as "ได\u008c". The mapping below
 * was read off real company documents and checked against the surrounding words; every entry
 * is one a human verified, not a guess.
 *
 * pdf.js reports the glyphs it cannot map at all as U+FFFD. Those stand for several different
 * Thai vowels depending on the glyph, so they cannot be repaired and are counted instead.
 */
const C1_TO_THAI: Record<number, string> = {
  0x82: "\u0E35", // sara ii     ("2 ป\u0082" -> "2 ปี")
  0x8b: "\u0E48", // mai ek      ("อย\u008bาง" -> "อย่าง")
  0x8c: "\u0E49", // mai tho     ("ได\u008c" -> "ได้")
  0x8f: "\u0E4C", // thanthakhat ("กรมธรรม\u008f" -> "กรมธรรม์")
  0x9a: "\u0E47", // mai taikhu  ("เป\u009an" -> "เป็น")
};

export interface RepairResult {
  text: string;
  repaired: number;
  /** glyphs the extractor could not identify at all; these stay in the text */
  unreadable: number;
}

export function repairThaiText(input: string): RepairResult {
  let repaired = 0;
  let unreadable = 0;
  const text = [...input].map((ch) => {
    const code = ch.codePointAt(0) ?? 0;
    if (code === 0xfffd) {
      unreadable++;
      return ch;
    }
    const fixed = C1_TO_THAI[code];
    if (fixed) {
      repaired++;
      return fixed;
    }
    return ch;
  }).join("");
  return { text, repaired, unreadable };
}
