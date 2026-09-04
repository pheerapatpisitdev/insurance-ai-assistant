"use server";

import { isSignedIn } from "@/lib/admin/session";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { answerQuestion, type TraceStep } from "@/lib/assistant/answer";
import { clearPromptCache, PROMPTS, type PromptKey } from "@/lib/assistant/prompts";
import { BudgetExceeded } from "@/lib/ai/client";

async function requireAdmin() {
  if (!(await isSignedIn())) throw new Error("ต้องเข้าสู่ระบบก่อน");
}

export interface TryResult {
  reply?: string;
  error?: string;
  trace: TraceStep[];
  sources: { title: string; page: number | null }[];
}

/**
 * Runs one question through the assistant exactly as a customer's message would go, and
 * returns what happened on the way. Nothing is saved: this is a rehearsal, not a conversation.
 */
export async function tryQuestion(question: string): Promise<TryResult> {
  await requireAdmin();
  const text = question.trim().slice(0, 1000);
  if (!text) return { error: "พิมพ์คำถามก่อนครับ", trace: [], sources: [] };

  const trace: TraceStep[] = [];
  try {
    const answer = await answerQuestion([{ role: "user", content: text }], null, trace);
    return { reply: answer.reply, sources: answer.sources, trace };
  } catch (e) {
    const error = e instanceof BudgetExceeded
      ? "ใช้งบ AI ของเดือนนี้ครบแล้ว"
      : e instanceof Error ? e.message : "เกิดข้อผิดพลาด";
    return { error, trace, sources: [] };
  }
}

export async function savePrompt(key: PromptKey, text: string): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin();
  if (!PROMPTS.some((p) => p.key === key)) return { ok: false, error: "ไม่รู้จักข้อความนี้" };
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, error: "ข้อความว่างไม่ได้ ถ้าจะกลับไปใช้ค่าเดิมให้กดคืนค่าเดิม" };
  if (trimmed.length > 4000) return { ok: false, error: "ยาวเกินไป" };

  const { error } = await supabaseAdmin()
    .from("ins_prompt_overrides")
    .upsert({ key, text: trimmed, updated_at: new Date().toISOString() });
  clearPromptCache();
  return error ? { ok: false, error: error.message } : { ok: true };
}

/** Deleting the row is what restores the built-in wording, so there is nothing to copy back. */
export async function resetPrompt(key: PromptKey): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin();
  const { error } = await supabaseAdmin().from("ins_prompt_overrides").delete().eq("key", key);
  clearPromptCache();
  return error ? { ok: false, error: error.message } : { ok: true };
}
