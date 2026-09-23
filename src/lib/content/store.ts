import { monthSpend, monthStart, type SpendLine } from "@/lib/ai/ledger";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { ContentWord, WordHit, WordKind } from "./check";
import type { Fix } from "./proofread";
import type { AngleId, Format, Length } from "./prompt";
import type { ContentOutput } from "./output";

/**
 * Where generated pieces and the owner's word list are kept: ins_content, ins_content_words.
 * Both are service_role only; the public page reaches them through its server actions.
 */

export interface Flags {
  /** amounts in the piece that were not in the brief */
  numbers: string[];
  /** words from the owner's list */
  words: WordHit[];
  /** the proofreader's suggestions; null until it has run */
  fixes: Fix[] | null;
}

export interface ContentItem {
  id: string;
  createdAt: string;
  planHref: string;
  format: Format;
  angle: AngleId;
  length: Length | null;
  output: ContentOutput;
  flags: Flags;
  model: string | null;
  costThb: number;
  starred: boolean;
}

/**
 * What content may spend in a month, on its own.
 *
 * The monthly budget is one pot, and the Messenger bot answering paid advertisements draws on
 * it too. When the pot runs dry the bot goes quiet — so this page stops well before that, at
 * a ceiling of its own, and a busy afternoon of writing posts cannot cost a lead their answer.
 */
export const CONTENT_MONTH_CAP_THB = 30;

/** what the content tasks have cost in these ledger lines */
export function contentBaht(lines: SpendLine[]): number {
  return lines.filter((l) => l.task?.startsWith("content")).reduce((s, l) => s + l.baht, 0);
}

export async function contentSpentThisMonth(): Promise<number> {
  return contentBaht((await monthSpend(monthStart())).lines);
}

const COLUMNS = "id, created_at, plan_href, format, angle, length, output, flags, model, cost_thb, starred";

function toItem(r: Record<string, unknown>): ContentItem {
  const flags = (r.flags ?? {}) as Partial<Flags>;
  return {
    id: String(r.id),
    createdAt: String(r.created_at),
    planHref: String(r.plan_href),
    format: r.format as Format,
    angle: (r.angle ?? "") as AngleId,
    length: (r.length ?? null) as Length | null,
    output: r.output as ContentOutput,
    flags: { numbers: flags.numbers ?? [], words: flags.words ?? [], fixes: flags.fixes ?? null },
    model: (r.model as string | null) ?? null,
    costThb: Number(r.cost_thb ?? 0),
    starred: Boolean(r.starred),
  };
}

export async function saveContent(row: {
  planHref: string; format: Format; angle: AngleId; length: Length | null;
  output: ContentOutput; flags: Flags; rateVersion: string | null; model: string; costThb: number;
}): Promise<ContentItem> {
  const { data, error } = await supabaseAdmin().from("ins_content").insert({
    plan_href: row.planHref, format: row.format, angle: row.angle || null, length: row.length,
    output: row.output, flags: row.flags, rate_version: row.rateVersion, model: row.model, cost_thb: row.costThb,
  }).select(COLUMNS).single();
  if (error) throw new Error(`บันทึกคอนเทนต์ไม่สำเร็จ: ${error.message}`);
  return toItem(data as Record<string, unknown>);
}

export async function getContent(id: string): Promise<ContentItem | null> {
  const { data, error } = await supabaseAdmin().from("ins_content").select(COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toItem(data as Record<string, unknown>) : null;
}

export async function listContent(filter: { planHref?: string; starred?: boolean } = {}, limit = 30): Promise<ContentItem[]> {
  let q = supabaseAdmin().from("ins_content").select(COLUMNS).order("created_at", { ascending: false }).limit(limit);
  if (filter.planHref) q = q.eq("plan_href", filter.planHref);
  if (filter.starred) q = q.eq("starred", true);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map(toItem);
}

export async function setStarred(id: string, starred: boolean): Promise<void> {
  const { error } = await supabaseAdmin().from("ins_content").update({ starred }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function setFixes(item: ContentItem, fixes: Fix[]): Promise<void> {
  const { error } = await supabaseAdmin().from("ins_content")
    .update({ flags: { ...item.flags, fixes } }).eq("id", item.id);
  if (error) throw new Error(error.message);
}

/** The owner's word list. Fails soft: a check with no list is a check that finds nothing. */
export async function listWords(): Promise<ContentWord[]> {
  const { data, error } = await supabaseAdmin().from("ins_content_words").select("word, kind, fix").order("created_at");
  if (error) {
    console.error("อ่านรายการคำไม่ได้:", error.message);
    return [];
  }
  return ((data ?? []) as { word: string; kind: WordKind; fix: string | null }[]);
}

export async function addWord(word: string, kind: WordKind, fix: string | null): Promise<void> {
  const { error } = await supabaseAdmin().from("ins_content_words").upsert({ word, kind, fix });
  if (error) throw new Error(error.message);
}

export async function deleteWord(word: string): Promise<void> {
  const { error } = await supabaseAdmin().from("ins_content_words").delete().eq("word", word);
  if (error) throw new Error(error.message);
}
