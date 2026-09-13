import { supabaseAdmin } from "@/lib/supabase/admin";
import type { ChatMessage } from "@/lib/ai/types";
import type { Routed } from "@/lib/assistant/route";

/** Which messaging service a person wrote from. Messenger is the only one the bot answers on. */
export type Channel = "facebook";

/** A conversation older than this has almost certainly moved on to a new customer. */
const MAX_AGE_HOURS = 24;
/** Enough turns for follow-up questions, few enough to keep every prompt cheap. */
const MAX_TURNS = 6;
/** How long the bot stays out of a thread after the agent has answered in it by hand. */
const MUTE_HOURS = 24;

export interface Session {
  messages: ChatMessage[];
  slots: Routed | null;
  /** ISO time the bot may speak again, or null when it was never asked to stop */
  mutedUntil: string | null;
}

/** When the bot may speak in this thread again, counted from the agent's message. */
export function muteFor(now: Date = new Date()): Date {
  return new Date(now.getTime() + MUTE_HOURS * 3600_000);
}

export function isMuted(mutedUntil: string | null, now: Date = new Date()): boolean {
  return mutedUntil !== null && new Date(mutedUntil) > now;
}

/**
 * The row is read whatever its age, and the cutoff is applied to the conversation alone: a
 * mute has its own clock. A thread the agent answered in and then left alone for a day would
 * otherwise come back with the mute unread, and the bot would speak over them.
 */
export async function loadSession(channel: Channel, userHash: string): Promise<Session> {
  const { data } = await supabaseAdmin()
    .from("ins_chat_sessions")
    .select("messages, slots, muted_until, updated_at")
    .eq("channel", channel)
    .eq("user_hash", userHash)
    .maybeSingle();
  if (!data) return { messages: [], slots: null, mutedUntil: null };

  const fresh = new Date(data.updated_at).getTime() > Date.now() - MAX_AGE_HOURS * 3600_000;
  const stored = fresh && Array.isArray(data.messages) ? (data.messages as ChatMessage[]) : [];
  const slots = fresh && data.slots && Object.keys(data.slots).length ? (data.slots as Routed) : null;
  return { messages: stored.slice(-MAX_TURNS), slots, mutedUntil: data.muted_until ?? null };
}

/**
 * `mutedUntil` left out means the mute is none of this save's business, and the column is
 * left exactly as it is.
 *
 * It used to be a required argument, and the bot passed null after every answer — so a mute
 * the agent had written while the model was still thinking was wiped by the bot's own save,
 * seconds later. The thread then took the next customer message as if nobody had answered.
 */
export async function saveSession(
  channel: Channel,
  userHash: string,
  messages: ChatMessage[],
  slots: Routed | null,
  mutedUntil?: Date | null,
): Promise<void> {
  await supabaseAdmin()
    .from("ins_chat_sessions")
    .upsert({
      channel,
      user_hash: userHash,
      messages: messages.slice(-MAX_TURNS),
      slots: slots ?? {},
      // only the columns named here are written on conflict, so omitting this one keeps it
      ...(mutedUntil === undefined ? {} : { muted_until: mutedUntil?.toISOString() ?? null }),
      updated_at: new Date().toISOString(),
    });
}

/**
 * Meta retries a webhook it believes failed, so the same event can arrive more than once.
 * Inserting the id first means the second arrival collides and is dropped, and the customer
 * is never answered twice.
 */
export async function claimEvent(channel: Channel, eventId: string): Promise<boolean> {
  const { error } = await supabaseAdmin().from("ins_chat_events").insert({ channel, event_id: eventId });
  if (!error) return true;
  if (error.code === "23505") return false;
  throw new Error(`บันทึกเหตุการณ์ไม่สำเร็จ: ${error.message}`);
}
