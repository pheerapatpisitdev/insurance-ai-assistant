import { BudgetExceeded, chat } from "@/lib/ai/client";
import type { ChatImage } from "@/lib/ai/types";
import type { GenerateResult } from "@/app/content/actions";
import { findWords, strayNumbers } from "./check";
import {
  CLAIM_HREF, MAX_CLAIM_PIECES, MAX_DOCS, claimAngleLines, claimMessages, cleanFacts, factsBlock, parseClaimPiece, parseRead,
  readMessages, type ClaimFacts, type ClaimRead,
} from "./claim";
import { OVERHEAD_THB, writerOf } from "./models";
import type { ContentOutput } from "./output";
import { checkPolicy } from "./policy";
import { posterText } from "./poster";
import { LENGTHS, MAX_READER, type Format, type Length } from "./prompt";
import {
  backgroundDataUri, contentCap, contentSpentThisMonth, getContent, holdContentBudget, listWords, releaseContentBudget,
  removeBackground, saveBackground, saveContent, saveOutputIf, type ContentItem,
} from "./store";
import { fallbackWriters, UnreadableReply } from "./write";

/**
 * รีวิวเคลม on the server: reading the papers, and writing the pieces. Called by
 * /api/content-claim only, which checks the consent tick and the files first.
 */

/** Gemini draws the tightest boxes of the three; the others read the words well enough if it is down */
const READER = "gemini-3.7-flash";
const READ_FALLBACK = ["gpt-5", "claude-sonnet-5"];
/** reading six photographs is about ฿0.1 on Gemini Flash; held at this so a fallback fits */
export const READ_HOLD_THB = 0.5;
/** six photographs and a long reply of boxes; a thinking model needs the room */
const READ_TIMEOUT_MS = 120_000;
const WRITE_TIMEOUT_MS = 60_000;

const capReached = (cap: number) => `เดือนนี้ใช้งบสร้างคอนเทนต์ครบ ${cap} บาทแล้ว — เพิ่มงบได้ที่หน้า /admin/ai`;
const BUDGET_OUT = "ถึงงบค่า AI ของเดือนนี้แล้ว";

export type ReadResult = ({ ok: true; costThb: number } & ClaimRead) | { ok: false; error: string };

export async function readClaim(images: ChatImage[]): Promise<ReadResult> {
  if (images.length === 0 || images.length > MAX_DOCS) return { ok: false, error: `เลือกรูปเอกสาร 1–${MAX_DOCS} รูปนะครับ` };
  let hold: string | null = null;
  try {
    const [spent, cap] = await Promise.all([contentSpentThisMonth(), contentCap()]);
    if (spent >= cap) return { ok: false, error: capReached(cap) };
    const held = await holdContentBudget(READ_HOLD_THB, cap);
    if (!held.ok) return { ok: false, error: `งบสร้างคอนเทนต์เดือนนี้เหลือ ${held.left.toFixed(2)} บาท ไม่พออ่านเอกสาร` };
    hold = held.id;
    const [system, user] = readMessages(images.length);
    const r = await chat({
      tier: "large", task: "content-claim-read", messages: [system, { ...user, images }],
      maxTokens: 8000, json: true, timeoutMs: READ_TIMEOUT_MS, prefer: READER, within: READ_FALLBACK,
    });
    const read = parseRead(r.text, images.length);
    if (!read) {
      console.error(`claim read unreadable (${r.model}, ${r.outputTokens} tokens):`, r.text.slice(0, 600));
      return { ok: false, error: "AI อ่านเอกสารไม่สำเร็จ ลองใหม่อีกครั้ง หรือถ่ายรูปให้ชัดขึ้นนะครับ" };
    }
    return { ok: true, costThb: r.costThb, ...read };
  } catch (e) {
    if (e instanceof BudgetExceeded) return { ok: false, error: BUDGET_OUT };
    console.error("claim read failed:", e);
    return { ok: false, error: "อ่านเอกสารไม่สำเร็จ ระบบขัดข้องชั่วคราว ลองใหม่อีกครั้งนะครับ" };
  } finally {
    if (hold) await releaseContentBudget(hold);
  }
}

export interface ClaimWriteInput {
  facts: unknown;
  count: number;
  /** โพสต์, สคริปต์วิดีโอ or โฆษณา, as on the plan form; a script has a length and no poster */
  format?: string;
  length?: string;
  writer?: string;
  /** an angle id, "custom" with the owner's words, or "" for the AI's turn-taking */
  angle?: string;
  custom?: string;
  /** who the posts talk to, as on the plan form */
  reader?: string;
  /** the paper for the poster, blacked out in the browser and ticked ตรวจแล้ว; none draws the plain poster */
  paper: { bytes: Buffer; mimeType: string; ratio: number } | null;
}

/** every line the checks read, as the workbench's own checks read them */
function checkedText(o: ContentOutput): string {
  return [...o.hooks, o.body, o.closing, o.hashtags.join(" "), posterText(o.poster)].join("\n");
}

/** Facts with nothing to tell: no illness, no amount and nothing from the owner is no story. */
export function tooThin(f: ClaimFacts): boolean {
  return !f.illness && !f.paid && !f.billTotal && !f.note;
}

export async function writeClaim(input: ClaimWriteInput): Promise<GenerateResult> {
  const facts = cleanFacts(input.facts);
  if (tooThin(facts)) return { ok: false, error: "AI อ่านโรคหรือยอดเงินจากเอกสารไม่ได้ — ลองรูปที่ชัดขึ้น หรือเล่าในช่อง “เล่าเพิ่ม” นะครับ" };
  const count = Math.min(MAX_CLAIM_PIECES, Math.max(1, Math.round(Number(input.count) || 1)));
  const format: Format = input.format === "script" || input.format === "ad" ? input.format : "post";
  const length: Length | null = format === "script" ? (LENGTHS.find((l) => l.id === input.length)?.id ?? "60") : null;
  const yardstick = factsBlock(facts);
  let hold: string | null = null;
  try {
    const [spent, cap] = await Promise.all([contentSpentThisMonth(), contentCap()]);
    if (spent >= cap) return { ok: false, error: capReached(cap) };
    const writer = writerOf(input.writer, cap - spent);
    const held = await holdContentBudget(count * (writer.thb + OVERHEAD_THB), cap);
    if (!held.ok) return { ok: false, error: `งบสร้างคอนเทนต์เดือนนี้เหลือ ${held.left.toFixed(2)} บาท ไม่พอรอบนี้ — ลดจำนวนชิ้นหรือเลือกโมเดลประหยัด` };
    hold = held.id;
    const words = await listWords();

    const angles = claimAngleLines({ angle: input.angle, custom: input.custom }, count);
    const reader = (input.reader ?? "").trim().slice(0, MAX_READER);
    const settled = await Promise.allSettled(angles.map(async (a) => {
      const r = await chat({
        tier: "large", task: "content", messages: claimMessages(facts, a, reader, format, length),
        maxTokens: 4000, json: true, timeoutMs: WRITE_TIMEOUT_MS, effort: "low",
        prefer: writer.model, within: fallbackWriters(writer.model),
      });
      const output = parseClaimPiece(r.text, facts, a.label, format);
      if (!output) {
        console.error(`claim piece unreadable (${r.model}, ${r.outputTokens} tokens):`, r.text.slice(0, 600));
        throw new UnreadableReply();
      }
      return { output, model: r.model, costThb: r.costThb };
    }));
    const written = settled.flatMap((s) => (s.status === "fulfilled" ? [s.value] : []));
    const reasons = settled.flatMap((s) => (s.status === "rejected" ? [s.reason as unknown] : []));
    if (written.length === 0) {
      const why = reasons.find((r) => r instanceof BudgetExceeded) ?? reasons[0];
      if (why instanceof BudgetExceeded) return { ok: false, error: BUDGET_OUT };
      if (why instanceof UnreadableReply) return { ok: false, error: why.message };
      throw why;
    }

    const items: ContentItem[] = [];
    for (const w of written) {
      let item: ContentItem;
      try {
        item = await saveContent({
          planHref: CLAIM_HREF, format, angle: "", length, output: w.output,
          flags: {
            numbers: strayNumbers(checkedText(w.output), yardstick),
            words: findWords(checkedText(w.output), words),
            policy: checkPolicy(checkedText(w.output)),
            fixes: null,
          },
          rateVersion: null, model: w.model, costThb: w.costThb, hookTemplateId: null,
        });
      } catch (e) {
        console.error("claim save failed mid-round:", e);
        return items.length
          ? { ok: false, error: `บันทึกได้ ${items.length} จาก ${written.length} ชิ้น — ดูชิ้นที่ได้ในรอตรวจ`, saved: items.length, items }
          : { ok: false, error: "บันทึกไม่สำเร็จ ลองใหม่อีกครั้งนะครับ", saved: 0 };
      }
      // a script is spoken to camera: no poster, so no paper on one
      items.push(input.paper && format !== "script" ? await withPaper(item, input.paper) : item);
    }
    return { ok: true, items, costThb: items.reduce((s, i) => s + i.costThb, 0), missing: count - items.length };
  } catch (e) {
    if (e instanceof BudgetExceeded) return { ok: false, error: BUDGET_OUT };
    console.error("claim write failed:", e);
    return { ok: false, error: "สร้างไม่สำเร็จ ระบบขัดข้องชั่วคราว ลองใหม่อีกครั้งนะครับ" };
  } finally {
    if (hold) await releaseContentBudget(hold);
  }
}

/**
 * The paper filed under the piece — deleting the piece deletes it — and put on its poster.
 * A failure leaves the piece with its plain poster: the words are the work, and the owner
 * is shown them rather than an error.
 */
async function withPaper(item: ContentItem, paper: NonNullable<ClaimWriteInput["paper"]>): Promise<ContentItem> {
  let path: string | null = null;
  try {
    path = await saveBackground(item.id, paper.bytes, paper.mimeType);
    const poster = item.output.poster;
    if (!poster) return item;
    // the stickers are the AI's until the owner ticks them in the editor
    const saved = await saveOutputIf(item.id, { ...item.output, poster: { ...poster, document: { path, ratio: paper.ratio } }, paperChecked: false }, undefined, item.output.rev ?? null);
    if (saved) return saved;
    await removeBackground(item.id, path);
    return item;
  } catch (e) {
    console.error("claim paper not put on the poster:", e);
    if (path) await removeBackground(item.id, path);
    return item;
  }
}

/** A claim piece's paper, for the editor to show and add stickers to; null when it has none. */
export async function claimPaper(id: string): Promise<{ bytes: Buffer; mimeType: string } | null> {
  const item = await getContent(id);
  const path = item?.planHref === CLAIM_HREF ? item.output.poster?.document?.path : null;
  if (!path) return null;
  const uri = await backgroundDataUri(path);
  const m = uri && /^data:([^;]+);base64,(.*)$/.exec(uri);
  return m ? { mimeType: m[1], bytes: Buffer.from(m[2], "base64") } : null;
}

export type CheckResult = { ok: true; item: ContentItem } | { ok: false; error: string };

/**
 * ตรวจแล้ว on a claim paper: the owner looked, and perhaps laid more stickers — then `paper`
 * is the new picture, stickers burnt in, and it replaces the old one. Either way the piece may
 * now go to a Page. Stickers can be added this way, never lifted: the picture on file is
 * already covered, and nothing uncovered is kept to lift them from.
 */
export async function checkPaper(id: string, paper: NonNullable<ClaimWriteInput["paper"]> | null): Promise<CheckResult> {
  let added: string | null = null;
  try {
    for (let attempt = 0; attempt < 3; attempt++) {
      const item = await getContent(id);
      const doc = item?.output.poster?.document;
      if (!item || item.planHref !== CLAIM_HREF || !doc || !item.output.poster) return { ok: false, error: "ไม่พบรูปเอกสารของชิ้นนี้" };
      if (paper && !added) added = await saveBackground(item.id, paper.bytes, paper.mimeType);
      const document = added ? { path: added, ratio: paper!.ratio } : doc;
      const saved = await saveOutputIf(item.id, { ...item.output, poster: { ...item.output.poster, document }, paperChecked: true }, undefined, item.output.rev ?? null);
      if (!saved) continue;
      if (added) await removeBackground(item.id, doc.path);
      return { ok: true, item: saved };
    }
    if (added) await removeBackground(id, added);
    return { ok: false, error: "ชิ้นนี้ถูกแก้ระหว่างบันทึก ลองกดอีกครั้งนะครับ" };
  } catch (e) {
    console.error("claim paper check failed:", e);
    if (added) await removeBackground(id, added);
    return { ok: false, error: "บันทึกไม่สำเร็จ ลองใหม่อีกครั้งนะครับ" };
  }
}

