"use server";
import { headers } from "next/headers";
import { BudgetExceeded, chat, drawImage } from "@/lib/ai/client";
import { backgroundPrompt, stripThai } from "@/lib/content/background";
import { limiter } from "@/lib/assistant/rate-limit";
import { briefFor } from "@/lib/content/brief";
import { findWords, strayNumbers, type ContentWord } from "@/lib/content/check";
import { parseTemplatize, templatizeMessages } from "@/lib/content/hooks";
import type { ContentOutput } from "@/lib/content/output";
import { defaultPoster, parsePoster, posterText, THEMES, type Theme } from "@/lib/content/poster";
import { contentProduct } from "@/lib/content/products";
import { MAX_PIECES } from "@/lib/content/plan";
import { checkPolicy } from "@/lib/content/policy";
import { proofread, type Fix } from "@/lib/content/proofread";
import { ANGLES, GOALS, LENGTHS, angleText, MAX_FACT, MAX_READER, type AngleId, type Format, type GoalId, type Length } from "@/lib/content/prompt";
import {
  DEFAULT_CONTENT_CAP_THB, addHookTemplate, contentCap, contentSpentThisMonth, countByStatus, countHookUse, deleteContent, getContent,
  getHookTemplate, isContentStatus, listContent, listWords, saveBackground, saveContent, saveOutput, setFixes, setStatus,
  usedHooks, type ContentItem, type ContentStatus, type Flags,
} from "@/lib/content/store";
import { DISCLAIMER, UnreadableReply, headlines, plan, write, writeAds } from "@/lib/content/write";
import { NUMBERS_CLOSING, numbersBody, numbersPoster, numbersYardstick } from "@/lib/content/numbers";
import { numberSheets } from "@/lib/content/numbers-plans";
import { MAX_ANGLES, MAX_TONES } from "@/lib/content/ads";
import { PAINTERS, painterOf, writerOf } from "@/lib/content/models";

/**
 * The content workbench's doors, open to anyone who finds the page — the owner put it in the
 * main menu knowing that. What stands in for a gate is three limits: ten rounds an hour from
 * one address, a monthly ceiling for content alone, and the whole system's budget behind it.
 */

const MAX_CUSTOM = 120;
const perHour = limiter(10, 60 * 60_000);
const proofPerHour = limiter(40, 60 * 60_000);
/** a picture is about ฿0.4 and takes half a minute; every new post orders one, so forty an hour */
const drawPerHour = limiter(40, 60 * 60_000);

async function caller(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}

/** every line the checks read — all the hooks, since any may be posted, and the poster's words */
function checkedText(o: Pick<ContentOutput, "hooks" | "body" | "closing" | "poster">): string {
  return [...o.hooks, o.body, o.closing, posterText(o.poster)].join("\n");
}

function flagsFor(o: ContentOutput, brief: string, words: ContentWord[], fixes: Fix[] | null): Flags {
  const text = checkedText(o);
  return {
    numbers: strayNumbers(text, brief),
    words: findWords(text, words),
    policy: checkPolicy(text),
    // a suggestion whose words were edited away cannot be applied any more
    fixes: fixes ? fixes.filter((f) => text.includes(f.find)) : null,
  };
}

export interface GenerateInput {
  href: string;
  format: Format;
  angle: AngleId;
  custom: string;
  length: Length | null;
  count: number;
  hookTemplateId: string | null;
  /** for ads: how many selling angles, and how many tones each is written in */
  adAngles?: number;
  adTones?: number;
  /** an id from WRITERS; anything else is the default */
  writer?: string;
  /** who the piece talks to, what it is for, and something true the owner knows; all optional */
  reader?: string;
  goal?: GoalId;
  fact?: string;
  /** the poster colour the owner picked for the round; unknown or absent keeps each poster's own */
  theme?: string;
}

export type GenerateResult =
  | { ok: true; items: ContentItem[]; costThb: number; /** planned pieces whose writing failed */ missing: number }
  | { ok: false; error: string };

export async function generateContent(input: GenerateInput): Promise<GenerateResult> {
  const brief = briefFor(input.href);
  if (!brief) return { ok: false, error: "ไม่พบผลิตภัณฑ์นี้" };
  if (!["post", "script", "ad"].includes(input.format)) return { ok: false, error: "เลือกประเภทงานก่อนนะครับ" };
  const angle: AngleId = input.angle === "custom" || ANGLES.some((a) => a.id === input.angle) ? input.angle : "";
  const length = input.format === "script" && LENGTHS.some((l) => l.id === input.length) ? input.length : null;
  const custom = (input.custom ?? "").trim().slice(0, MAX_CUSTOM);
  const count = Math.min(MAX_PIECES, Math.max(1, Math.round(Number(input.count) || 1)));
  const reader = (input.reader ?? "").trim().slice(0, MAX_READER);
  const goal: GoalId = GOALS.some((g) => g.id === input.goal) ? input.goal! : "";
  // an ad is a stranger's first sight of the page: no true story in it, and no goal but a chat
  const fact = input.format === "ad" ? "" : (input.fact ?? "").trim().slice(0, MAX_FACT);
  // the owner's story is the one other place a number may come from
  const yardstick = fact ? `${brief.text}\n${fact}` : brief.text;
  const theme = (THEMES as readonly string[]).includes(input.theme ?? "") ? (input.theme as Theme) : null;
  // the round's colour on every poster, the writer's own poster or the one drawn from its hook
  const dressed = (o: ContentOutput): ContentOutput =>
    theme ? { ...o, poster: { ...(o.poster ?? defaultPoster(o.hooks[0], brief.product.name)), theme } } : o;

  if (!perHour(`content:${await caller()}`)) {
    return { ok: false, error: "สร้างครบ 10 รอบในชั่วโมงนี้แล้ว รอสักพักแล้วลองใหม่นะครับ" };
  }

  try {
    const [spent, cap] = await Promise.all([contentSpentThisMonth(), contentCap()]);
    if (spent >= cap) {
      return { ok: false, error: `เดือนนี้ใช้งบสร้างคอนเทนต์ครบ ${cap} บาทแล้ว (กันไว้ให้บอทตอบลูกค้า) — เพิ่มงบได้ที่หน้า /admin/ai` };
    }
    // อัตโนมัติ decides on the money actually left, not on what the page last saw
    const writeWith = writerOf(input.writer, cap - spent).model;
    const [avoid, template, words] = await Promise.all([
      usedHooks(),
      input.hookTemplateId ? getHookTemplate(input.hookTemplateId) : Promise.resolve(null),
      listWords(),
    ]);
    const told = angleText(angle, custom);

    // ตัวเลขชัดๆ: every figure from the engine, only the headline from a model (spec 2026-09-24)
    if (angle === "numbers") {
      if (input.format !== "post") return { ok: false, error: "มุมตัวเลขชัดๆ ใช้ได้กับโพสต์เฟซบุ๊กเท่านั้น" };
      const sheets = numberSheets(brief.product.href, count);
      if (sheets.length === 0) return { ok: false, error: "แบบนี้ยังคำนวณตัวเลขไม่ได้ในตอนนี้ (ตารางเบี้ยอาจหมดอายุ) ลองมุมอื่นก่อนนะครับ" };
      const heads = await headlines(sheets);
      const yard = `${brief.text}\n${numbersYardstick(sheets)}`;
      const items: ContentItem[] = [];
      for (const [i, s] of sheets.entries()) {
        const output: ContentOutput = {
          hooks: [heads.lines[i].headline],
          angle: `ตัวเลขชัดๆ · ${s.who}`,
          body: numbersBody(s),
          closing: NUMBERS_CLOSING,
          hashtags: [],
          imagePrompt: heads.lines[i].imagePrompt,
          disclaimer: DISCLAIMER,
          poster: numbersPoster(s, theme ?? "navy"),
        };
        items.push(await saveContent({
          planHref: brief.product.href, format: "post", angle, length: null, output,
          flags: flagsFor(output, yard, words, null),
          rateVersion: brief.rateVersion, model: heads.model, costThb: heads.costThb / sheets.length, hookTemplateId: null,
        }));
      }
      return { ok: true, items, costThb: heads.costThb, missing: count - items.length };
    }

    if (input.format === "ad") {
      const angles = Math.min(MAX_ANGLES, Math.max(1, Math.round(Number(input.adAngles) || 2)));
      const tones = Math.min(MAX_TONES, Math.max(1, Math.round(Number(input.adTones) || 2)));
      const hint = [told, reader ? `คนอ่านคือ ${reader}` : ""].filter(Boolean).join(" · ");
      const round = await writeAds({ brief: brief.text, angles, tones, hint, prefer: writeWith });
      const planShare = round.planThb / round.pieces.length;
      const items: ContentItem[] = [];
      for (const w of round.pieces) {
        items.push(await saveContent({
          planHref: brief.product.href, format: "ad", angle, length: null, output: dressed(w.output),
          flags: flagsFor(w.output, brief.text, words, null),
          rateVersion: brief.rateVersion, model: w.model, costThb: w.costThb + planShare, hookTemplateId: null,
        }));
      }
      const costThb = items.reduce((s, i) => s + i.costThb, 0);
      return { ok: true, items, costThb, missing: round.planned - items.length };
    }

    const planned = await plan({ brief: brief.text, count, angle: told, avoid, template, reader, goal, fact });
    const written = await write({ brief: brief.text, format: input.format, angle, custom, length, plans: planned.plans, reader, goal, fact }, { prefer: writeWith });

    // each piece carries its own writing cost and an equal share of the planner's
    const planShare = planned.costThb / written.length;
    const items: ContentItem[] = [];
    for (const w of written) {
      items.push(await saveContent({
        planHref: brief.product.href, format: input.format, angle, length,
        output: input.format === "script" ? (fact ? { ...w.output, fact } : w.output) : dressed(fact ? { ...w.output, fact } : w.output),
        flags: flagsFor(w.output, yardstick, words, null),
        rateVersion: brief.rateVersion, model: w.model, costThb: w.costThb + planShare,
        hookTemplateId: template?.id ?? null,
      }));
    }
    if (template) await countHookUse(template, items.length).catch((e) => console.error("hook count failed:", e));
    const costThb = items.reduce((s, i) => s + i.costThb, 0);
    // against the count asked for: a planner reply repaired short gives fewer plans, and the
    // owner is told rather than handed two posts for three
    return { ok: true, items, costThb, missing: Math.max(0, count - items.length) };
  } catch (e) {
    if (e instanceof BudgetExceeded) return { ok: false, error: "ถึงงบค่า AI ของเดือนนี้แล้ว" };
    if (e instanceof UnreadableReply) return { ok: false, error: e.message };
    console.error("content generate failed:", e);
    return { ok: false, error: "สร้างไม่สำเร็จ ระบบขัดข้องชั่วคราว ลองใหม่อีกครั้งนะครับ" };
  }
}

/** Runs after the piece is on screen; a failure here only means no suggestions. */
export async function proofreadContent(id: string): Promise<Fix[]> {
  if (!proofPerHour(`proof:${await caller()}`)) return [];
  try {
    const item = await getContent(id);
    if (!item) return [];
    if (item.flags.fixes) return item.flags.fixes;
    const { fixes } = await proofread(checkedText(item.output));
    await setFixes(item, fixes);
    return fixes;
  } catch (e) {
    console.error("content proofread failed:", e);
    return [];
  }
}

/**
 * Draw a formula out of a used piece's hook, for the library.
 *
 * Skipped when the piece was written to a formula already: its hook would give that formula
 * back, and the call would buy nothing. Failure is silent — the piece is still marked used.
 */
async function learnFormula(item: ContentItem): Promise<void> {
  const hook = item.output.hooks[0];
  if (item.hookTemplateId || !hook) return;
  try {
    const r = await chat({ tier: "small", task: "content-hook-template", messages: templatizeMessages(hook), maxTokens: 300, json: true });
    const formula = parseTemplatize(r.text);
    if (formula) await addHookTemplate({ ...formula, exampleHook: hook, sourceId: item.id });
  } catch (e) {
    console.error("hook formula failed:", e);
  }
}

export async function setContentStatus(id: string, status: ContentStatus): Promise<{ ok: boolean }> {
  if (!isContentStatus(status)) return { ok: false };
  try {
    const item = await getContent(id);
    if (!item) return { ok: false };
    await setStatus(id, status);
    if (status === "used" && item.status !== "used") await learnFormula(item);
    return { ok: true };
  } catch (e) {
    console.error("content status failed:", e);
    return { ok: false };
  }
}

/** Deletes a piece outright — the owner asked for no bin. The page confirms before calling. */
export async function removeContent(id: string): Promise<{ ok: boolean }> {
  try {
    await deleteContent(id);
    return { ok: true };
  } catch (e) {
    console.error("content delete failed:", e);
    return { ok: false };
  }
}

export type EditResult = { ok: true; item: ContentItem } | { ok: false; error: string };

/** The owner's edits, kept — and checked again, because an edit can add a number too. */
export async function saveContentEdits(
  id: string,
  edits: Pick<ContentOutput, "hooks" | "body" | "closing" | "hashtags" | "poster">,
  opts: { plain?: boolean } = {},
): Promise<EditResult> {
  try {
    const item = await getContent(id);
    if (!item) return { ok: false, error: "ไม่พบชิ้นงานนี้" };
    const brief = briefFor(item.planHref);
    const output: ContentOutput = {
      ...item.output,
      hooks: edits.hooks.map((h) => h.slice(0, 400)),
      body: edits.body.slice(0, 6000),
      closing: edits.closing.slice(0, 600),
      hashtags: edits.hashtags.slice(0, 12).map((h) => h.slice(0, 60)),
      // the poster the browser sent is parsed like one from the model: nothing reaches the
      // table that the drawing route could not draw
      ...(edits.poster && parsePoster(edits.poster) ? { poster: parsePoster(edits.poster)! } : {}),
    };
    // a poster sent without its photograph keeps the one on file, unless the owner chose the
    // plain colour: an editor opened before the photograph landed does not know it exists
    const kept = item.output.poster?.background;
    if (output.poster && !output.poster.background && kept && !opts.plain) output.poster = { ...output.poster, background: kept };
    // back to the plain colour: nobody drew it any more
    if (opts.plain && !output.poster?.background) delete output.pictureBy;
    const flags = flagsFor(output, [brief?.text ?? "", item.output.fact ?? ""].join("\n"), await listWords(), item.flags.fixes);
    return { ok: true, item: await saveOutput(id, output, flags) };
  } catch (e) {
    console.error("content save failed:", e);
    return { ok: false, error: "บันทึกไม่สำเร็จ ลองใหม่อีกครั้งนะครับ" };
  }
}

export interface Workbench {
  items: ContentItem[];
  counts: Record<ContentStatus, number>;
}

export async function contentWorkbench(filter: { status: ContentStatus; planHref?: string }): Promise<Workbench> {
  try {
    const [items, counts] = await Promise.all([listContent(filter), countByStatus(filter.planHref)]);
    return { items, counts };
  } catch (e) {
    console.error("content workbench failed:", e);
    return { items: [], counts: { draft: 0, used: 0 } };
  }
}

export async function contentSpend(): Promise<{ spent: number; cap: number }> {
  try {
    const [spent, cap] = await Promise.all([contentSpentThisMonth(), contentCap()]);
    return { spent, cap };
  } catch {
    return { spent: 0, cap: DEFAULT_CONTENT_CAP_THB };
  }
}

/**
 * The owner's picture request in English. Image models read Thai badly and try to draw it, so
 * a request typed in Thai is translated first by the cheap model — once, a fraction of a baht.
 */
async function inEnglish(request: string): Promise<string> {
  const text = request.trim().slice(0, 300);
  if (!text || !/[\u0E00-\u0E7F]/.test(text)) return text;
  const r = await chat({
    tier: "small", task: "content-image-brief", maxTokens: 200,
    messages: [
      { role: "system", content: "Translate the Thai photo direction into one short English sentence for an image model. Describe only what should be seen. Reply with the sentence only." },
      { role: "user", content: text },
    ],
  });
  return stripThai(r.text).slice(0, 300);
}

export type DrawBackgroundResult = { ok: true; item: ContentItem } | { ok: false; error: string };

/**
 * A photograph behind a piece's poster, drawn by an image model and kept with the piece.
 *
 * The words on the poster are not the model's business: it is asked for a picture with no
 * lettering at all, calm on the side the words will sit, and the drawing route sets the Thai
 * over it. Counted against the content ceiling like every other content call.
 */
export async function drawBackground(id: string, request = "", painter?: string): Promise<DrawBackgroundResult> {
  if (!drawPerHour(`draw:${await caller()}`)) {
    return { ok: false, error: "วาดรูปครบ 40 รูปในชั่วโมงนี้แล้ว รอสักพักนะครับ" };
  }
  try {
    const [spent, cap] = await Promise.all([contentSpentThisMonth(), contentCap()]);
    if (spent >= cap) {
      return { ok: false, error: `เดือนนี้ใช้งบสร้างคอนเทนต์ครบ ${cap} บาทแล้ว — เพิ่มงบได้ที่หน้า /admin/ai` };
    }
    // only an id from the list, อัตโนมัติ settled on the money left; "none" draws nothing
    const chosen = painterOf(painter, cap - spent);
    if (!chosen.modelId) return { ok: false, error: "งบคอนเทนต์เหลือน้อย อัตโนมัติจึงไม่วาดภาพ เลือกโมเดลวาดเองได้ครับ" };
    const item = await getContent(id);
    if (!item) return { ok: false, error: "ไม่พบชิ้นงานนี้" };
    const poster = item.output.poster ?? defaultPoster(item.output.hooks[0], contentProduct(item.planHref)?.name ?? "");
    const prompt = backgroundPrompt({
      scene: item.output.imagePrompt, layout: poster.layout, theme: poster.theme,
      request: await inEnglish(request),
    });
    const img = await drawImage({ task: "content-image", prompt, prefer: chosen.modelId });
    // the fallback may have drawn it; name what actually did
    const by = PAINTERS.find((p) => p.modelId === img.id)?.short ?? (img.id === "gemini-image-lite" ? "Gemini Lite Image" : img.model);
    const background = await saveBackground(item.id, img.bytes, img.mimeType);
    // the drawing takes half a minute; an edit saved meanwhile is read again, not written over
    const latest = (await getContent(id)) ?? item;
    const words = latest.output.poster ?? poster;
    const saved = await saveOutput(item.id, { ...latest.output, poster: { ...words, background }, pictureBy: by }, latest.flags);
    return { ok: true, item: saved };
  } catch (e) {
    if (e instanceof BudgetExceeded) return { ok: false, error: "ถึงงบค่า AI ของเดือนนี้แล้ว" };
    console.error("content background failed:", e);
    return { ok: false, error: "วาดรูปไม่สำเร็จ ลองใหม่อีกครั้งนะครับ" };
  }
}
