"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/guard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { BUCKET } from "@/lib/knowledge";
import { ingestDocument } from "@/lib/knowledge/ingest";

export interface DocRow {
  id: string;
  title: string;
  plan_code: string | null;
  bytes: number;
  page_count: number | null;
  status: string;
  error: string | null;
  is_active: boolean;
  created_at: string;
}

export async function listDocs(): Promise<DocRow[]> {
  const supabase = supabaseAdmin();
  const { data } = await supabase.from("ins_knowledge_docs")
    .select("id, title, plan_code, bytes, page_count, status, error, is_active, created_at")
    .order("created_at", { ascending: false });
  return data ?? [];
}

/** Uploads a PDF and records it. The file never touches the browser's Supabase client. */
export async function uploadDoc(formData: FormData) {
  await requireAdmin();
  const file = formData.get("file");
  const planCode = String(formData.get("planCode") ?? "") || null;
  if (!(file instanceof File)) throw new Error("ไม่พบไฟล์");
  if (file.type !== "application/pdf") throw new Error(`${file.name} ไม่ใช่ไฟล์ PDF`);
  if (file.size > 50 * 1024 * 1024) throw new Error(`${file.name} ใหญ่เกิน 50 MB`);

  const supabase = supabaseAdmin();
  const path = `${Date.now()}-${crypto.randomUUID()}.pdf`;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const up = await supabase.storage.from(BUCKET).upload(path, bytes, { contentType: "application/pdf" });
  if (up.error) throw new Error(up.error.message);

  const { data, error } = await supabase.from("ins_knowledge_docs").insert({
    title: file.name.replace(/\.pdf$/i, "").slice(0, 200),
    plan_code: planCode,
    storage_path: path,
    bytes: file.size,
    status: "uploaded",
  }).select("id").single();
  if (error) throw new Error(error.message);

  // Read, split and embed straight away so the document is searchable on return. A failure
  // here is recorded on the row, not thrown away, so the page can show what went wrong.
  try {
    await ingestDocument(data.id);
  } catch {
    // status and error are already stored by ingestDocument
  }
  revalidatePath("/admin/knowledge");
}

/** Re-reads a document, e.g. after a failure was fixed. */
export async function reingestDoc(id: string) {
  await requireAdmin();
  await ingestDocument(id);
  revalidatePath("/admin/knowledge");
}

export async function setDocActive(id: string, isActive: boolean) {
  await requireAdmin();
  const supabase = supabaseAdmin();
  const { error } = await supabase.from("ins_knowledge_docs")
    .update({ is_active: isActive, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/knowledge");
}

export async function deleteDoc(id: string) {
  await requireAdmin();
  const supabase = supabaseAdmin();
  const { data } = await supabase.from("ins_knowledge_docs").select("storage_path").eq("id", id).maybeSingle();
  if (data?.storage_path) await supabase.storage.from(BUCKET).remove([data.storage_path]);
  const { error } = await supabase.from("ins_knowledge_docs").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/knowledge");
}
