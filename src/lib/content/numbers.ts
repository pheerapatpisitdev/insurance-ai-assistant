import type { PosterSpec } from "./poster";

/**
 * The ตัวเลขชัดๆ angle (owner, 2026-09-24): a post that sells on figures alone.
 *
 * Every figure on it is written here from an engine's answer, never by a model — a model
 * writes only the headline above them, and a headline with a digit in it is thrown away for a
 * fixed one. The claim lines come from a list per plan the owner approved, so a "เบี้ยไม่เพิ่ม"
 * never reaches a plan whose premium rises. Design: docs/superpowers/specs/2026-09-24-numbers-angle-design.md
 */

export interface NumberSheet {
  product: string;
  /** "ประกันชีวิตทุน 1,000,000 บาท" */
  sumLine: string;
  /** "เบี้ย 1,548 บาท ต่อเดือน", or ต่อปี under the monthly floor, or เบี้ยปีแรก … for a rising premium */
  premiumLine: string;
  /** "ตกวันละ 48 บาท": the yearly premium ÷ 365, rounded up, as the sales pages say it */
  perDayLine: string;
  claims: string[];
  /** "ชาย 35 ปี จ่ายถึงอายุ 99", shown in brackets: the premium is this person's */
  who: string;
  poster: { big: string; small: string };
}

export const NUMBERS_CLOSING = "ทักแชทเช็กเบี้ยตามอายุคุณ";

export function numbersBody(s: NumberSheet): string {
  return [s.sumLine, s.premiumLine, s.perDayLine, ...s.claims, `(${s.who})`].join("\n");
}

/** Everything the code wrote, as the number check's yardstick: it wrote them, so they are allowed. */
export function numbersYardstick(sheets: NumberSheet[]): string {
  return sheets.flatMap((s) => [numbersBody(s), s.poster.big, s.poster.small]).join("\n");
}

export function numbersPoster(s: NumberSheet): PosterSpec {
  return {
    layout: "bottom",
    theme: "navy",
    blocks: [
      { kind: "badge", text: s.product },
      { kind: "headline", text: s.poster.big },
      { kind: "sub", text: s.poster.small },
      { kind: "footer", text: s.who },
    ],
  };
}

/** Arabic or Thai digits: a headline carrying any is not the model's to write. */
const DIGIT = /[0-9๐-๙]/;

export function safeHeadline(text: string, fallback: string): string {
  const t = text.trim();
  return t && !DIGIT.test(t) ? t : fallback;
}
