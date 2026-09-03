import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

/** Temporary probe: how clean is the text we stored? */
export async function GET() {
  const supabase = supabaseAdmin();
  const { data: docs } = await supabase.from("ins_knowledge_docs").select("id, title, status, page_count");
  const out = [];
  for (const d of docs ?? []) {
    const { data: chunks } = await supabase.from("ins_doc_chunks").select("content").eq("doc_id", d.id);
    const text = (chunks ?? []).map((c) => c.content).join("\n");
    const stripped = text.replace(/\s/g, "");
    const isBad = (c: string) => {
      const p = c.codePointAt(0) ?? 0;
      return p === 0xfffd || (p >= 0x80 && p <= 0x9f);
    };
    const bad = [...stripped].filter(isBad);
    const badCounts = new Map<string, number>();
    for (const c of bad) badCounts.set(c, (badCounts.get(c) ?? 0) + 1);
    out.push({
      title: d.title, status: d.status, pages: d.page_count, chunks: chunks?.length ?? 0,
      chars: stripped.length,
      badChars: bad.length,
      badShare: Number(((bad.length / Math.max(1, stripped.length)) * 100).toFixed(2)),
      badBreakdown: [...badCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([c, n]) => ({ code: "U+" + (c.codePointAt(0) ?? 0).toString(16).toUpperCase().padStart(4, "0"), n })),
      sample: text.slice(0, 300),
    });
  }
  return NextResponse.json(out);
}
