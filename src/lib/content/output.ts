/**
 * A generated piece as data, and as the text that gets pasted.
 *
 * Kept apart from write.ts so the page's browser code can build the pasted text without
 * importing the AI client, which holds the keys and must never reach a browser bundle.
 */

import type { PosterSpec } from "./poster";

/** The regulator's line, the same words the sales pages end on. Added here, never by the model. */
export const DISCLAIMER = "ผู้ซื้อควรทำความเข้าใจรายละเอียดความคุ้มครองและเงื่อนไขก่อนตัดสินใจทำประกันภัยทุกครั้ง";
export const TAX_LINE = "สิทธิประโยชน์ทางภาษีเป็นไปตามเงื่อนไขที่กรมสรรพากรกำหนด";

export interface ContentOutput {
  /** one hook per piece since pieces are planned; older pieces carry three to choose from */
  hooks: string[];
  /** the planner's one-line angle; absent on pieces written before there was a planner */
  angle?: string;
  body: string;
  closing: string;
  hashtags: string[];
  imagePrompt: string;
  disclaimer: string;
  /** the poster the writer designed; absent on pieces written before posters */
  poster?: PosterSpec;
}

/** The piece as it will be pasted: one hook, the body, the closing, the tags, the disclaimer. */
export function fullText(out: ContentOutput, hook = 0): string {
  return [
    out.hooks[hook] ?? out.hooks[0],
    out.body,
    out.closing,
    out.hashtags.join(" "),
    out.disclaimer,
  ].filter(Boolean).join("\n\n");
}

/** What Facebook shows of a post before "ดูเพิ่มเติม", roughly — the figure Meta gives for ads. */
export const FOLD = 125;

/**
 * The piece split where the reader's screen folds it. Counted in code points, as Maryjane's
 * thai-text.ts counts: a Thai vowel or tone mark is a character of its own, so "ผู้" is three,
 * which is closer to how the fold falls than counting letters a reader would.
 */
export function atFold(text: string, limit = FOLD): { shown: string; hidden: string; length: number } {
  const chars = [...text];
  return { shown: chars.slice(0, limit).join(""), hidden: chars.slice(limit).join(""), length: chars.length };
}
