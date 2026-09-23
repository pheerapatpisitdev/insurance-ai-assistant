import { chat, parseJsonReply } from "@/lib/ai/client";
import { buildMessages, type AngleId, type Ask } from "./prompt";

/**
 * One call to the model, and what comes back made into a post.
 *
 * The large tier, and the first caller of it in this system: everything else here parses a
 * question or answers one, which the cheapest models do well, but an advertisement is read by
 * strangers deciding whether to keep scrolling, and the cheap models write Thai that reads
 * like a form. About a baht a piece at the prices on 2026-09-23.
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

interface Raw {
  hooks?: unknown;
  body?: unknown;
  closing?: unknown;
  hashtags?: unknown;
  imagePrompt?: unknown;
}

const strings = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").map((x) => x.trim()).filter(Boolean) : [];
const text = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

/** The model's reply as a post, or null when it is not one — half a post is not shown. */
export function parseOutput(reply: string, angle: AngleId): ContentOutput | null {
  const raw = parseJsonReply<Raw>(reply);
  if (!raw) return null;
  const hooks = strings(raw.hooks).slice(0, 3);
  const body = text(raw.body);
  if (hooks.length === 0 || !body) return null;
  return {
    hooks,
    body,
    closing: text(raw.closing),
    hashtags: strings(raw.hashtags).map((h) => (h.startsWith("#") ? h : `#${h}`)),
    imagePrompt: text(raw.imagePrompt),
    disclaimer: angle === "tax" ? `${DISCLAIMER}\n${TAX_LINE}` : DISCLAIMER,
  };
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

export interface Written {
  output: ContentOutput;
  model: string;
  costThb: number;
}

export class UnreadableReply extends Error {
  constructor() {
    super("AI ตอบกลับมาไม่ครบ ลองกดสร้างใหม่อีกครั้งนะครับ");
    this.name = "UnreadableReply";
  }
}

export async function write(ask: Ask): Promise<Written> {
  const r = await chat({ tier: "large", task: "content", messages: buildMessages(ask), maxTokens: 2500, json: true });
  const output = parseOutput(r.text, ask.angle);
  if (!output) throw new UnreadableReply();
  return { output, model: r.model, costThb: r.costThb };
}
