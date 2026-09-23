"use server";
import { headers } from "next/headers";
import { BudgetExceeded, chat } from "@/lib/ai/client";
import { limiter } from "@/lib/assistant/rate-limit";
import { briefFor } from "@/lib/content/brief";
import { findWords, strayNumbers, type ContentWord } from "@/lib/content/check";
import { parseTemplatize, templatizeMessages } from "@/lib/content/hooks";
import type { ContentOutput } from "@/lib/content/output";
import { MAX_PIECES } from "@/lib/content/plan";
import { checkPolicy } from "@/lib/content/policy";
import { proofread, type Fix } from "@/lib/content/proofread";
import { ANGLES, LENGTHS, type AngleId, type Format, type Length } from "@/lib/content/prompt";
import {
  CONTENT_MONTH_CAP_THB, addHookTemplate, contentSpentThisMonth, countByStatus, countHookUse, getContent,
  getHookTemplate, isContentStatus, listContent, listWords, saveContent, saveOutput, setFixes, setStatus,
  usedHooks, type ContentItem, type ContentStatus, type Flags,
} from "@/lib/content/store";
import { UnreadableReply, plan, write } from "@/lib/content/write";

/**
 * The content workbench's doors, open to anyone who finds the page — the owner put it in the
 * main menu knowing that. What stands in for a gate is three limits: ten rounds an hour from
 * one address, a monthly ceiling for content alone, and the whole system's budget behind it.
 */

const MAX_CUSTOM = 120;
const perHour = limiter(10, 60 * 60_000);
const proofPerHour = limiter(40, 60 * 60_000);

async function caller(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}

/** every line the checks read — all the hooks, since any of them may be the one posted */
function checkedText(o: Pick<ContentOutput, "hooks" | "body" | "closing">): string {
  return [...o.hooks, o.body, o.closing].join("\n");
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
}

export type GenerateResult =
  | { ok: true; items: ContentItem[]; costThb: number; /** planned pieces whose writing failed */ missing: number }
  | { ok: false; error: string };

export async function generateContent(input: GenerateInput): Promise<GenerateResult> {
  const brief = briefFor(input.href);
  if (!brief) return { ok: false, error: "ไม่พบผลิตภัณฑ์นี้" };
  if (input.format !== "post" && input.format !== "script") return { ok: false, error: "เลือกประเภทงานก่อนนะครับ" };
  const angle: AngleId = input.angle === "custom" || ANGLES.some((a) => a.id === input.angle) ? input.angle : "";
  const length = input.format === "script" && LENGTHS.some((l) => l.id === input.length) ? input.length : null;
  const custom = (input.custom ?? "").trim().slice(0, MAX_CUSTOM);
  const count = Math.min(MAX_PIECES, Math.max(1, Math.round(Number(input.count) || 1)));

  if (!perHour(`content:${await caller()}`)) {
    return { ok: false, error: "สร้างครบ 10 รอบในชั่วโมงนี้แล้ว รอสักพักแล้วลองใหม่นะครับ" };
  }

  try {
    if (await contentSpentThisMonth() >= CONTENT_MONTH_CAP_THB) {
      return { ok: false, error: `เดือนนี้ใช้งบสร้างคอนเทนต์ครบ ${CONTENT_MONTH_CAP_THB} บาทแล้ว (กันไว้ให้บอทตอบลูกค้า)` };
    }
    const [avoid, template, words] = await Promise.all([
      usedHooks(),
      input.hookTemplateId ? getHookTemplate(input.hookTemplateId) : Promise.resolve(null),
      listWords(),
    ]);
    const angleText = angle === "custom" ? custom : (ANGLES.find((a) => a.id === angle)?.label ?? "");

    const planned = await plan({ brief: brief.text, count, angle: angleText, avoid, template });
    const written = await write({ brief: brief.text, format: input.format, angle, custom, length, plans: planned.plans });

    // each piece carries its own writing cost and an equal share of the planner's
    const planShare = planned.costThb / written.length;
    const items: ContentItem[] = [];
    for (const w of written) {
      items.push(await saveContent({
        planHref: brief.product.href, format: input.format, angle, length, output: w.output,
        flags: flagsFor(w.output, brief.text, words, null),
        rateVersion: brief.rateVersion, model: w.model, costThb: w.costThb + planShare,
        hookTemplateId: template?.id ?? null,
      }));
    }
    if (template) await countHookUse(template, items.length).catch((e) => console.error("hook count failed:", e));
    const costThb = items.reduce((s, i) => s + i.costThb, 0);
    return { ok: true, items, costThb, missing: planned.plans.length - items.length };
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

export type EditResult = { ok: true; item: ContentItem } | { ok: false; error: string };

/** The owner's edits, kept — and checked again, because an edit can add a number too. */
export async function saveContentEdits(id: string, edits: Pick<ContentOutput, "hooks" | "body" | "closing" | "hashtags">): Promise<EditResult> {
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
    };
    const flags = flagsFor(output, brief?.text ?? "", await listWords(), item.flags.fixes);
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
    return { items: [], counts: { draft: 0, used: 0, trashed: 0 } };
  }
}

export async function contentSpend(): Promise<{ spent: number; cap: number }> {
  try {
    return { spent: await contentSpentThisMonth(), cap: CONTENT_MONTH_CAP_THB };
  } catch {
    return { spent: 0, cap: CONTENT_MONTH_CAP_THB };
  }
}
