import { supabaseAdmin } from "@/lib/supabase/admin";
import type { Channel } from "./session";

export interface Conversation {
  channel: string;
  updatedAt: string;
  turns: { role: string; content: string }[];
  intent: string | null;
}

/**
 * The conversations still inside their day-long window, newest first. Passing a channel keeps
 * one messaging service's page to its own traffic.
 */
export async function recentConversations(channel?: Channel, limit = 20): Promise<Conversation[]> {
  let q = supabaseAdmin()
    .from("ins_chat_sessions")
    .select("channel, messages, slots, updated_at")
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (channel) q = q.eq("channel", channel);

  const { data } = await q;
  return (data ?? []).map((r) => ({
    channel: r.channel as string,
    updatedAt: r.updated_at as string,
    turns: Array.isArray(r.messages) ? (r.messages as { role: string; content: string }[]) : [],
    intent: (r.slots as { intent?: string } | null)?.intent ?? null,
  }));
}

/** How many messages that channel has taken in, and when the last one arrived. */
export async function channelActivity(channel: Channel): Promise<{ events: number; latest: string | null }> {
  const { count } = await supabaseAdmin()
    .from("ins_chat_events")
    .select("event_id", { count: "exact", head: true })
    .eq("channel", channel);
  const { data } = await supabaseAdmin()
    .from("ins_chat_events")
    .select("created_at")
    .eq("channel", channel)
    .order("created_at", { ascending: false })
    .limit(1);
  return { events: count ?? 0, latest: data?.[0]?.created_at ?? null };
}
