import { supabaseAdmin } from "@/lib/supabase/admin";
import type { ChatMessage } from "@/lib/ai/types";
import type { Routed } from "@/lib/assistant/route";

/** Which messaging service a person wrote from. Conversations never cross between them. */
export type Channel = "line" | "facebook";

/** A conversation older than this has almost certainly moved on to a new customer. */
const MAX_AGE_HOURS = 24;
/** Enough turns for follow-up questions, few enough to keep every prompt cheap. */
const MAX_TURNS = 6;

export interface Session {
  messages: ChatMessage[];
  slots: Routed | null;
}

export async function loadSession(channel: Channel, userHash: string): Promise<Session> {
  const cutoff = new Date(Date.now() - MAX_AGE_HOURS * 3600_000).toISOString();
  const { data } = await supabaseAdmin()
    .from("ins_chat_sessions")
    .select("messages, slots, updated_at")
    .eq("channel", channel)
    .eq("user_hash", userHash)
    .gte("updated_at", cutoff)
    .maybeSingle();
  if (!data) return { messages: [], slots: null };
  const messages = Array.isArray(data.messages) ? (data.messages as ChatMessage[]) : [];
  const slots = data.slots && Object.keys(data.slots).length ? (data.slots as Routed) : null;
  return { messages: messages.slice(-MAX_TURNS), slots };
}

export async function saveSession(channel: Channel, userHash: string, messages: ChatMessage[], slots: Routed | null): Promise<void> {
  await supabaseAdmin()
    .from("ins_chat_sessions")
    .upsert({
      channel,
      user_hash: userHash,
      messages: messages.slice(-MAX_TURNS),
      slots: slots ?? {},
      updated_at: new Date().toISOString(),
    });
}

/**
 * Both services retry a webhook they believe failed, so the same event can arrive more than
 * once. Inserting the id first means the second arrival collides and is dropped, and the
 * customer is never answered twice.
 */
export async function claimEvent(channel: Channel, eventId: string): Promise<boolean> {
  const { error } = await supabaseAdmin().from("ins_chat_events").insert({ channel, event_id: eventId });
  if (!error) return true;
  if (error.code === "23505") return false;
  throw new Error(`บันทึกเหตุการณ์ไม่สำเร็จ: ${error.message}`);
}
