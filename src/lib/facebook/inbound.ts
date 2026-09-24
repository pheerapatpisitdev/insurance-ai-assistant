import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * When a customer's message last actually reached this system.
 *
 * Everything else on the Messenger screen is what Meta says about a Page — the permission is
 * live, the Page is subscribed — and all of it can be green while nothing arrives: a webhook
 * pointed at an old address, a subscription Meta dropped quietly, an app switched back to
 * development mode. The one fact that cannot be green by mistake is a customer's words
 * landing in the database, so that is what this reads.
 *
 * It reads `ins_chat_events`, which conversation.ts writes once per customer message (typed
 * or tapped, never an echo of the Page's own reply) before answering it. That table keeps the
 * message id and the time and nothing else — not the Page it came in on — so the answer is
 * the newest message across every Page, and the screen has to say so rather than pretend it
 * is per Page.
 */

/** Longer than this without a customer message and the screen turns amber. */
export const QUIET_MS = 24 * 60 * 60 * 1000;

/** The newest customer message's arrival time, or null when none has ever arrived. */
export async function lastCustomerMessageAt(): Promise<string | null> {
  const { data, error } = await supabaseAdmin()
    .from("ins_chat_events")
    .select("created_at")
    .eq("channel", "facebook")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as { created_at: string } | null)?.created_at ?? null;
}

/**
 * Whether the inbox has gone quiet for long enough to be worth a word.
 *
 * Quiet is not broken — a night with no advertising running is quiet too — which is why the
 * screen says amber and explains, rather than red and alarms. Never having had a message
 * counts as quiet: a connected Page that has not received one yet is exactly the case where
 * the owner should go and send a test message.
 */
export function inboxIsQuiet(lastAt: string | null, now: Date = new Date()): boolean {
  if (!lastAt) return true;
  const at = new Date(lastAt).getTime();
  if (Number.isNaN(at)) return true;
  return now.getTime() - at > QUIET_MS;
}
