"use server";
import { headers } from "next/headers";
import { BudgetExceeded } from "@/lib/ai/client";
import { limiter } from "@/lib/assistant/rate-limit";
import { briefFor } from "@/lib/content/brief";
import { findWords, strayNumbers } from "@/lib/content/check";
import { proofread, type Fix } from "@/lib/content/proofread";
import { ANGLES, LENGTHS, type AngleId, type Format, type Length } from "@/lib/content/prompt";
import {
  CONTENT_MONTH_CAP_THB, contentSpentThisMonth, getContent, listContent, listWords,
  saveContent, setFixes, setStarred, type ContentItem,
} from "@/lib/content/store";
import { write, UnreadableReply, type ContentOutput } from "@/lib/content/write";

/**
 * The content generator's doors, open to anyone who finds the page — the owner put it in the
 * main menu knowing that. What stands in for a gate is three limits: ten pieces an hour from
 * one address, a monthly ceiling for content alone, and the whole system's budget behind it.
 */

const MAX_CUSTOM = 120;
const perHour = limiter(10, 60 * 60_000);
const proofPerHour = limiter(20, 60 * 60_000);

async function caller(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}

export interface GenerateInput {
  href: string;
  format: Format;
  angle: AngleId;
  custom: string;
  length: Length | null;
}

export type GenerateResult = { ok: true; item: ContentItem } | { ok: false; error: string };

/** every hook and the text around them: what the checks read, since any hook may be the one used */
function checkedText(o: ContentOutput): string {
  return [...o.hooks, o.body, o.closing].join("\n");
}

export async function generateContent(input: GenerateInput): Promise<GenerateResult> {
  const brief = briefFor(input.href);
  if (!brief) return { ok: false, error: "ไม่พบผลิตภัณฑ์นี้" };
  if (input.format !== "post" && input.format !== "script") return { ok: false, error: "เลือกประเภทงานก่อนนะครับ" };
  const angle: AngleId = input.angle === "custom" || ANGLES.some((a) => a.id === input.angle) ? input.angle : "";
  const length = input.format === "script" && LENGTHS.some((l) => l.id === input.length) ? input.length : null;
  const custom = (input.custom ?? "").trim().slice(0, MAX_CUSTOM);

  if (!perHour(`content:${await caller()}`)) {
    return { ok: false, error: "สร้างครบ 10 ชิ้นในชั่วโมงนี้แล้ว รอสักพักแล้วลองใหม่นะครับ" };
  }

  try {
    if (await contentSpentThisMonth() >= CONTENT_MONTH_CAP_THB) {
      return { ok: false, error: `เดือนนี้ใช้งบสร้างคอนเทนต์ครบ ${CONTENT_MONTH_CAP_THB} บาทแล้ว (กันไว้ให้บอทตอบลูกค้า)` };
    }
    const w = await write({ brief: brief.text, format: input.format, angle, custom, length });
    const text = checkedText(w.output);
    const item = await saveContent({
      planHref: brief.product.href, format: input.format, angle, length,
      output: w.output,
      flags: { numbers: strayNumbers(text, brief.text), words: findWords(text, await listWords()), fixes: null },
      rateVersion: brief.rateVersion, model: w.model, costThb: w.costThb,
    });
    return { ok: true, item };
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

export async function starContent(id: string, starred: boolean): Promise<void> {
  try {
    await setStarred(id, starred);
  } catch (e) {
    console.error("content star failed:", e);
  }
}

export async function contentHistory(filter: { planHref?: string; starred?: boolean }): Promise<ContentItem[]> {
  try {
    return await listContent(filter);
  } catch (e) {
    console.error("content history failed:", e);
    return [];
  }
}
