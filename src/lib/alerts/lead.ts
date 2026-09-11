import { supabaseAdmin } from "@/lib/supabase/admin";
import type { Channel } from "@/lib/chat/session";
import { alert } from "./send";
import { alertSettings } from "./settings";

/**
 * Telling the agent that someone is worth calling back.
 *
 * Conversations are kept for 24 hours and customers are stored as a hash, so a lead that
 * nobody looks at within the day is gone. The alert carries what was asked and nothing that
 * identifies anyone — there is nothing identifying to carry.
 */

const CHANNEL_TH: Record<Channel, string> = { line: "LINE" };

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.advisortool.app";
}

export function leadMessage(channel: Channel, question: string, reply: string): string {
  // the first two lines of a quotation name the plan and the person; anything after is detail
  const headline = reply.split("\n").filter(Boolean).slice(0, 2).join(" · ");
  return [
    `🔔 ลูกค้าใหม่ทาง ${CHANNEL_TH[channel]}`,
    `ถามว่า: ${question.slice(0, 120)}`,
    headline ? `บอทตอบ: ${headline}` : "",
    `${siteUrl()}/admin/${channel}`,
  ].filter(Boolean).join("\n");
}

/** True the first time this conversation is claimed, false ever after. */
async function claimConversation(channel: Channel, userHash: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin()
    .from("ins_chat_sessions")
    .update({ alerted_at: new Date().toISOString() })
    .eq("channel", channel).eq("user_hash", userHash).is("alerted_at", null)
    .select("user_hash");
  if (error) throw new Error(error.message);
  return (data ?? []).length > 0;
}

export interface LeadContext {
  channel: Channel;
  userHash: string;
  question: string;
  reply: string;
  /** the answer carried a premium */
  priced: boolean;
  /** nobody had spoken in this conversation before this turn */
  isNew: boolean;
}

/** Decides whether this turn is worth an alert, and sends one if so. Never throws. */
export async function alertLead(ctx: LeadContext): Promise<void> {
  try {
    const { leadsMode } = await alertSettings();
    if (leadsMode === "off") return;
    if (leadsMode === "quote" ? !ctx.priced : !ctx.isNew) return;
    if (!(await claimConversation(ctx.channel, ctx.userHash))) return;
    await alert("lead", leadMessage(ctx.channel, ctx.question, ctx.reply));
  } catch (e) {
    console.error("lead alert failed:", e);
  }
}
