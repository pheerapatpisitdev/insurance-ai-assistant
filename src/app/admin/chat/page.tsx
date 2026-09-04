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

async function documentCount(): Promise<number> {
  const { count } = await supabaseAdmin()
    .from("ins_knowledge_docs")
    .select("id", { count: "exact", head: true })
    .in("status", ["ready", "partial"]);
  return count ?? 0;
}

export default async function ChatAdminPage() {
  const [prompts, docs] = await Promise.all([promptsWithOverrides(), documentCount()]);
  return (
    <ChatAdminClient
      prompts={prompts}
      counts={{ plans: listPlans().length, bundles: listBundles().length, docs }}
    />
  );
}
