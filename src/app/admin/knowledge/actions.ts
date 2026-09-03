"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin, supabaseServer } from "@/lib/supabase/server";
import { BUCKET } from "@/lib/knowledge";

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
  const supabase = await supabaseServer();
  const { data } = await supabase.schema("ins").from("knowledge_docs")
    .select("id, title, plan_code, bytes, page_count, status, error, is_active, created_at")
    .order("created_at", { ascending: false });
  return data ?? [];
}

/** Records a document the browser has already uploaded to storage. */
export async function registerDoc(input: { title: string; planCode: string | null; storagePath: string; bytes: number }) {
  if (!(await requireAdmin())) throw new Error("ไม่มีสิทธิ์");
  const supabase = await supabaseServer();
  const { error } = await supabase.schema("ins").from("knowledge_docs").insert({
    title: input.title.slice(0, 200),
    plan_code: input.planCode,
    storage_path: input.storagePath,
    bytes: input.bytes,
    status: "uploaded",
  });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/knowledge");
}

export async function setDocActive(id: string, isActive: boolean) {
  if (!(await requireAdmin())) throw new Error("ไม่มีสิทธิ์");
  const supabase = await supabaseServer();
  const { error } = await supabase.schema("ins").from("knowledge_docs")
    .update({ is_active: isActive, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/knowledge");
}

export async function deleteDoc(id: string) {
  if (!(await requireAdmin())) throw new Error("ไม่มีสิทธิ์");
  const supabase = await supabaseServer();
  const { data } = await supabase.schema("ins").from("knowledge_docs").select("storage_path").eq("id", id).maybeSingle();
  if (data?.storage_path) await supabase.storage.from(BUCKET).remove([data.storage_path]);
  const { error } = await supabase.schema("ins").from("knowledge_docs").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/knowledge");
}
