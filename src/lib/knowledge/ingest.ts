import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { embedTexts } from "@/lib/ai/client";
import { BUCKET } from "@/lib/knowledge";
import { chunkPages, chunkPage, type Chunk } from "./chunk";
import { assessText } from "./quality";
import { repairThaiText } from "./repair";

/**
 * Reads a stored PDF, splits it and stores the pieces with their embeddings.
 * Updates the document's status so the admin page shows what happened.
 */
export async function ingestDocument(docId: string): Promise<{ chunks: number; pages: number; unreadableShare: number }> {
  const supabase = supabaseAdmin();
  const { data: doc, error } = await supabase
    .from("ins_knowledge_docs").select("id, title, storage_path").eq("id", docId).maybeSingle();
  if (error || !doc) throw new Error("ไม่พบเอกสาร");

  const setStatus = (status: string, extra: Record<string, unknown> = {}) =>
    supabase.from("ins_knowledge_docs")
      .update({ status, updated_at: new Date().toISOString(), ...extra }).eq("id", docId);

  await setStatus("processing", { error: null });
  try {
    const file = await supabase.storage.from(BUCKET).download(doc.storage_path);
    if (file.error || !file.data) throw new Error(`อ่านไฟล์ไม่ได้: ${file.error?.message ?? "ไม่ทราบสาเหตุ"}`);
    const buffer = Buffer.from(await file.data.arrayBuffer());

    const raw = await extractPdf(buffer);
    const fixedPages = raw.pages.map((p) => repairThaiText(p));
    const pages = fixedPages.map((r) => r.text);
    const pageCount = raw.pageCount;
    const text = pages.join("\n\n");
    const unreadable = fixedPages.reduce((n, r) => n + r.unreadable, 0);

    const quality = assessText(text);
    if (!quality.ok) throw new Error(quality.reason ?? "อ่านข้อความจากไฟล์นี้ไม่ได้");

    const chunks: Chunk[] = pages.length > 1 ? chunkPages(pages) : chunkPage(text, null);
    if (chunks.length === 0) throw new Error("ตัดข้อความไม่ได้");

    const vectors = await embedTexts(chunks.map((c) => c.content), "knowledge-ingest");

    await supabase.from("ins_doc_chunks").delete().eq("doc_id", docId);
    for (let i = 0; i < chunks.length; i += 100) {
      const slice = chunks.slice(i, i + 100);
      const rows = slice.map((c, j) => ({
        doc_id: docId, page: c.page, ordinal: c.ordinal,
        content: c.content, embedding: JSON.stringify(vectors[i + j]),
      }));
      const ins = await supabase.from("ins_doc_chunks").insert(rows);
      if (ins.error) throw new Error(ins.error.message);
    }

    // A few glyphs the extractor could not identify are tolerable; a lot of them means the
    // answers drawn from this document would be unreliable, so say so on the page.
    const unreadableShare = unreadable / Math.max(1, text.replace(/\s/g, "").length);
    const partial = unreadableShare > 0.02;
    await setStatus(partial ? "partial" : "ready", {
      page_count: pageCount,
      raw_text: text.slice(0, 200_000),
      error: partial
        ? `อ่านได้ไม่ครบ มีอักขระที่ระบุไม่ได้ ${(unreadableShare * 100).toFixed(1)}% ค้นหาได้แต่คำตอบอาจไม่ครบถ้วน`
        : null,
    });
    return { chunks: chunks.length, pages: pageCount, unreadableShare };
  } catch (e) {
    await setStatus("failed", { error: e instanceof Error ? e.message.slice(0, 500) : String(e) });
    throw e;
  }
}

/** Pulls text out of a PDF, one string per page. */
async function extractPdf(buffer: Buffer): Promise<{ pages: string[]; pageCount: number; text: string }> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  // pdfjs is listed in serverExternalPackages, so Node resolves its worker from node_modules
  // on its own. Naming the worker file here would make the bundler rewrite the path and break
  // that resolution, which is what the "Setting up fake worker failed" error was.
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(buffer),
    useSystemFonts: true,
    isEvalSupported: false,
    useWorkerFetch: false,
  }).promise;
  const pages: string[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const content = await page.getTextContent();
    const items = content.items as { str?: string; hasEOL?: boolean }[];
    pages.push(items.map((i) => (i.str ?? "") + (i.hasEOL ? "\n" : "")).join(""));
    page.cleanup();
  }
  await doc.destroy();
  return { pages, pageCount: doc.numPages, text: pages.join("\n\n") };
}
