import { embedTexts } from "@/lib/ai/client";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Answers the agency wrote itself, returned word for word. A document search paraphrases;
 * for a question about what a claim needs or what is excluded, the trainer's own sentence is
 * the one that should reach the customer, every time and identically.
 *
 * Matching is by meaning rather than by wording, so "เคลมใช้เอกสารอะไร" finds an entry saved
 * as "ต้องใช้เอกสารอะไรบ้างตอนเคลม".
 */

/**
 * How close a customer's question must come. Set from real questions rather than guessed:
 * the back office shows the score of the nearest entry on every rehearsal, so this can be
 * judged against what actually gets asked.
 */
export const MATCH_THRESHOLD = 0.72;

export interface FaqHit {
  id: string;
  question: string;
  answer: string;
  score: number;
}

/** The nearest stored questions, closest first, whether or not any is close enough. */
export async function searchFaq(question: string, limit = 3): Promise<FaqHit[]> {
  const [embedding] = await embedTexts([question], "faq-search");
  const { data, error } = await supabaseAdmin().rpc("ins_search_faq", {
    query_embedding: embedding as unknown as string,
    match_count: limit,
  });
  if (error) throw new Error(`ค้นคลังคำตอบไม่สำเร็จ: ${error.message}`);
  return (data ?? []) as FaqHit[];
}

/** Stores the question's embedding so it can be found later; called whenever one is saved. */
export async function embedQuestion(id: string, question: string): Promise<void> {
  const [embedding] = await embedTexts([question], "faq-index");
  const { error } = await supabaseAdmin()
    .from("ins_faq")
    .update({ embedding: embedding as unknown as string })
    .eq("id", id);
  if (error) throw new Error(`บันทึกคำถามไม่สำเร็จ: ${error.message}`);
}
