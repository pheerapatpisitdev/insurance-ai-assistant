import { supabaseAdmin } from "@/lib/supabase/admin";
import type { ChatMessage } from "@/lib/ai/types";
import type { AnySlots } from "@/lib/assistant/slots";

/** Which messaging service a person wrote from. Messenger is the only one the bot answers on. */
export type Channel = "facebook";

/** A conversation older than this has almost certainly moved on to a new customer. */
const MAX_AGE_HOURS = 24;
/** Enough turns for follow-up questions, few enough to keep every prompt cheap. */
const MAX_TURNS = 6;
/**
 * How long the agent's mark on a thread stands.
 *
 * It is not a day of silence: the customer writing again hands the thread back to the bot.
 * What the mark is for is the seconds the model takes — an answer already being composed
 * when the agent types is dropped rather than sent on top of them.
 */
const MUTE_HOURS = 24;

export interface Session {
  messages: ChatMessage[];
  slots: AnySlots | null;
  /** ISO time the bot may speak again, or null when it was never asked to stop */
  mutedUntil: string | null;
  /**
   * The conversation this live session belongs to in the record, or null when there is none
   * yet: nobody has written, or what was written is a day old and the next message starts a
   * new conversation with the same person.
   */
  conversationId: string | null;
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
    .select("messages, slots, muted_until, updated_at, conversation_id")
    .eq("channel", channel)
    .eq("user_hash", userHash)
    .maybeSingle();
  if (!data) return { messages: [], slots: null, mutedUntil: null, conversationId: null };

  const fresh = new Date(data.updated_at).getTime() > Date.now() - MAX_AGE_HOURS * 3600_000;
  const stored = fresh && Array.isArray(data.messages) ? (data.messages as ChatMessage[]) : [];
  const slots = fresh && data.slots && Object.keys(data.slots).length ? (data.slots as AnySlots) : null;
  const conversationId = fresh && typeof data.conversation_id === "string" ? data.conversation_id : null;
  return { messages: stored.slice(-MAX_TURNS), slots, mutedUntil: data.muted_until ?? null, conversationId };
}

/**
 * `mutedUntil` left out means the mute is none of this save's business, and the column is
 * left exactly as it is. The same goes for `conversationId`.
 *
 * It used to be a required argument, and the bot passed null after every answer — so a mute
 * the agent had written while the model was still thinking was wiped by the bot's own save,
 * seconds later. The thread then took the next customer message as if nobody had answered.
 */
export async function saveSession(
  channel: Channel,
  userHash: string,
  messages: ChatMessage[],
  slots: AnySlots | null,
  mutedUntil?: Date | null,
  conversationId?: string | null,
): Promise<void> {
  await supabaseAdmin()
    .from("ins_chat_sessions")
    .upsert({
      channel,
      user_hash: userHash,
      messages: messages.slice(-MAX_TURNS),
      slots: slots ?? {},
      // only the columns named here are written on conflict, so omitting one keeps it
      ...(mutedUntil === undefined ? {} : { muted_until: mutedUntil?.toISOString() ?? null }),
      ...(conversationId === undefined ? {} : { conversation_id: conversationId }),
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
