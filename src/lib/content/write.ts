import { chat, parseJsonReply } from "@/lib/ai/client";
import { DISCLAIMER, TAX_LINE, type ContentOutput } from "./output";
import { parsePlans, planMessages, type PiecePlan } from "./plan";
import { buildMessages, type AngleId, type Ask } from "./prompt";

export { DISCLAIMER, TAX_LINE, fullText, type ContentOutput } from "./output";

/**
 * One call to the model, and what comes back made into a post.
 *
 * The large tier, and the first caller of it in this system: everything else here parses a
 * question or answers one, which the cheapest models do well, but an advertisement is read by
 * strangers deciding whether to keep scrolling, and the cheap models write Thai that reads
 * like a form. About a baht a piece at the prices on 2026-09-23.
 */

interface RawPiece {
  body?: unknown;
  closing?: unknown;
  hashtags?: unknown;
  imagePrompt?: unknown;
}

const strings = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").map((x) => x.trim()).filter(Boolean) : [];
const text = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

/**
 * One post per plan, or null.
 *
 * All or nothing, as in Maryjane's parseDraftResponse: a reply with one piece fewer than the
 * plans is a reply that lost track, and the owner would be shown three posts for four angles
 * without knowing which one went missing.
 *
 * The hooks come from the plans, not from the reply. Told to keep a hook, models reword it
 * anyway — Maryjane found this and overwrites in code, and so does this — and the hook is the
 * line the formula, the used-hooks list and the policy were all checked against.
 */
export function parsePieces(reply: string, plans: PiecePlan[], angle: AngleId): ContentOutput[] | null {
  const raw = parseJsonReply<{ pieces?: unknown }>(reply);
  if (!raw || !Array.isArray(raw.pieces)) return null;
  const pieces = (raw.pieces as RawPiece[]).slice(0, plans.length);
  if (pieces.length !== plans.length) return null;
  const out: ContentOutput[] = [];
  for (const [i, p] of pieces.entries()) {
    const body = text(p?.body);
    if (!body) return null;
    out.push({
      hooks: [plans[i].hook],
      angle: plans[i].angle,
      body,
      closing: text(p.closing),
      hashtags: [...new Set(strings(p.hashtags).map((h) => (h.startsWith("#") ? h : `#${h}`)))].slice(0, 8),
      imagePrompt: text(p.imagePrompt),
      disclaimer: angle === "tax" ? `${DISCLAIMER}\n${TAX_LINE}` : DISCLAIMER,
    });
  }
  return out;
}

export class UnreadableReply extends Error {
  constructor() {
    super("AI ตอบกลับมาไม่ครบ ลองกดสร้างใหม่อีกครั้งนะครับ");
    this.name = "UnreadableReply";
  }
}

export interface Planned {
  plans: PiecePlan[];
  model: string;
  costThb: number;
}

/** The cheap call: angles and hooks. */
export async function plan(opts: Parameters<typeof planMessages>[0]): Promise<Planned> {
  const r = await chat({ tier: "small", task: "content-plan", messages: planMessages(opts), maxTokens: 900, json: true });
  const plans = parsePlans(r.text, opts.count);
  if (!plans) throw new UnreadableReply();
  return { plans, model: r.model, costThb: r.costThb };
}

export interface WrittenPiece {
  output: ContentOutput;
  model: string;
  costThb: number;
}

/** a large model writing one post in Thai; comfortably past the 25 seconds a chat reply gets */
const WRITE_TIMEOUT_MS = 60_000;

/**
 * Every planned piece, written in parallel — one call each.
 *
 * It was one call for all of them, as Maryjane does it, and that call took long enough that the
 * provider timeout cut Sonnet off and the round was quietly written by the fallback model. One
 * call per piece finishes a round of five in about the time one piece takes, keeps each reply
 * short enough to finish, and a piece that fails costs only itself. The planner already made
 * the angles distinct, so no writer needs to see the others' plans.
 */
export async function write(ask: Ask): Promise<WrittenPiece[]> {
  const settled = await Promise.allSettled(ask.plans.map(async (p) => {
    const r = await chat({
      tier: "large", task: "content", messages: buildMessages({ ...ask, plans: [p] }),
      // low effort: ad copy from a fixed brief needs little reasoning, and the room left over
      // is for the post; 4,000 covers what thinking remains plus a long script
      maxTokens: 4000, json: true, timeoutMs: WRITE_TIMEOUT_MS, effort: "low",
    });
    const [output] = parsePieces(r.text, [p], ask.angle) ?? [];
    if (!output) throw new UnreadableReply();
    return { output, model: r.model, costThb: r.costThb };
  }));
  const written = settled.flatMap((s) => (s.status === "fulfilled" ? [s.value] : []));
  if (written.length === 0) {
    const first = settled.find((s): s is PromiseRejectedResult => s.status === "rejected");
    throw first?.reason ?? new UnreadableReply();
  }
  return written;
}
