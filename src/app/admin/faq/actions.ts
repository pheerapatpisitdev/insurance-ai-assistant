"use server";

import { isSignedIn } from "@/lib/admin/session";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { embedQuestion, searchFaq } from "@/lib/assistant/faq";

export interface FaqRow {
  id: string;
  question: string;
  answer: string;
  enabled: boolean;
  updatedAt: string;
  /** false while the question has no embedding yet, so it cannot be found */
  indexed: boolean;
}

async function requireAdmin() {
  if (!(await isSignedIn())) throw new Error("ต้องเข้าสู่ระบบก่อน");
}

export async function listFaq(): Promise<FaqRow[]> {
  await requireAdmin();
  const { data } = await supabaseAdmin()
    .from("ins_faq")
    .select("id, question, answer, enabled, updated_at, embedding")
    .order("updated_at", { ascending: false });
  return (data ?? []).map((r) => ({
    id: r.id as string,
    question: r.question as string,
    answer: r.answer as string,
    enabled: r.enabled as boolean,
    updatedAt: r.updated_at as string,
    indexed: r.embedding !== null,
  }));
}

export async function saveFaq(
  input: { id?: string; question: string; answer: string },
): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin();
  const question = input.question.trim();
  const answer = input.answer.trim();
  if (!question) return { ok: false, error: "ใส่คำถามด้วยครับ" };
  if (!answer) return { ok: false, error: "ใส่คำตอบด้วยครับ" };
  if (question.length > 500) return { ok: false, error: "คำถามยาวเกินไป" };
  if (answer.length > 3000) return { ok: false, error: "คำตอบยาวเกินไป" };

  const db = supabaseAdmin();
  const row = { question, answer, updated_at: new Date().toISOString() };
  const { data, error } = input.id
    ? await db.from("ins_faq").update(row).eq("id", input.id).select("id").single()
    : await db.from("ins_faq").insert(row).select("id").single();
  if (error || !data) return { ok: false, error: error?.message ?? "บันทึกไม่สำเร็จ" };

  try {
    // the wording may have changed, so the stored question is indexed again either way
    await embedQuestion(data.id as string, question);
  } catch (e) {
    return { ok: false, error: `บันทึกแล้วแต่ยังค้นหาไม่เจอ: ${e instanceof Error ? e.message : e}` };
  }
  return { ok: true };
}

export async function setFaqEnabled(id: string, enabled: boolean): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin();
  const { error } = await supabaseAdmin()
    .from("ins_faq")
    .update({ enabled, updated_at: new Date().toISOString() })
    .eq("id", id);
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function deleteFaq(id: string): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin();
  const { error } = await supabaseAdmin().from("ins_faq").delete().eq("id", id);
  return error ? { ok: false, error: error.message } : { ok: true };
}

export interface FaqProbe {
  question: string;
  score: number;
  willUse: boolean;
}

/** What the store would match for a question, and whether it is close enough to be used. */
export async function probeFaq(question: string): Promise<{ hits: FaqProbe[]; error?: string }> {
  await requireAdmin();
  const q = question.trim();
  if (!q) return { hits: [], error: "พิมพ์คำถามก่อนครับ" };
  try {
    const { MATCH_THRESHOLD } = await import("@/lib/assistant/faq");
    const hits = await searchFaq(q, 3);
    return { hits: hits.map((h) => ({ question: h.question, score: h.score, willUse: h.score >= MATCH_THRESHOLD })) };
  } catch (e) {
    return { hits: [], error: e instanceof Error ? e.message : "ค้นไม่สำเร็จ" };
  }
}
