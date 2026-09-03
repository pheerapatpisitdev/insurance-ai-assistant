import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ingestDocument } from "@/lib/knowledge/ingest";

/** Temporary probe: re-read every document with the current pipeline. */
export async function GET() {
  const { data: docs } = await supabaseAdmin().from("ins_knowledge_docs").select("id, title");
  const out = [];
  for (const d of docs ?? []) {
    try {
      out.push({ title: d.title, ...(await ingestDocument(d.id)) });
    } catch (e) {
      out.push({ title: d.title, error: e instanceof Error ? e.message.slice(0, 200) : String(e) });
    }
  }
  return NextResponse.json(out);
}
