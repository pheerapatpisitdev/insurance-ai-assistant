import { listPlans } from "@/calc/plans/registry";
import { listBundles } from "@/calc/bundles/registry";
import { promptsWithOverrides } from "@/lib/assistant/prompts";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ChatAdminClient } from "./ChatAdminClient";

export const dynamic = "force-dynamic";

export interface Conversation {
  channel: string;
  updatedAt: string;
  turns: { role: string; content: string }[];
  intent: string | null;
}

async function recentConversations(): Promise<Conversation[]> {
  const { data } = await supabaseAdmin()
    .from("ins_chat_sessions")
    .select("channel, messages, slots, updated_at")
    .order("updated_at", { ascending: false })
    .limit(20);
  return (data ?? []).map((r) => ({
    channel: r.channel as string,
    updatedAt: r.updated_at as string,
    turns: Array.isArray(r.messages) ? (r.messages as { role: string; content: string }[]) : [],
    intent: (r.slots as { intent?: string } | null)?.intent ?? null,
  }));
}

async function documentCount(): Promise<number> {
  const { count } = await supabaseAdmin()
    .from("ins_knowledge_docs")
    .select("id", { count: "exact", head: true })
    .in("status", ["ready", "partial"]);
  return count ?? 0;
}

export default async function ChatAdminPage() {
  const [prompts, conversations, docs] = await Promise.all([
    promptsWithOverrides(),
    recentConversations(),
    documentCount(),
  ]);
  return (
    <ChatAdminClient
      prompts={prompts}
      conversations={conversations}
      counts={{ plans: listPlans().length, bundles: listBundles().length, docs }}
    />
  );
}
