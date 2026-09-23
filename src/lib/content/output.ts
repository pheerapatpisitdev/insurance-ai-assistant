/**
 * A generated piece as data, and as the text that gets pasted.
 *
 * Kept apart from write.ts so the page's browser code can build the pasted text without
 * importing the AI client, which holds the keys and must never reach a browser bundle.
 */

/** The regulator's line, the same words the sales pages end on. Added here, never by the model. */
export const DISCLAIMER = "ผู้ซื้อควรทำความเข้าใจรายละเอียดความคุ้มครองและเงื่อนไขก่อนตัดสินใจทำประกันภัยทุกครั้ง";
export const TAX_LINE = "สิทธิประโยชน์ทางภาษีเป็นไปตามเงื่อนไขที่กรมสรรพากรกำหนด";

export interface ContentOutput {
  hooks: string[];
  body: string;
  closing: string;
  hashtags: string[];
  imagePrompt: string;
  disclaimer: string;
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
