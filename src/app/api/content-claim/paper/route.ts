import type { NextRequest } from "next/server";
import { checkPaper, claimPaper } from "@/lib/content/claim-run";

/**
 * A รีวิวเคลม piece's paper in the editor: GET shows it (the bucket is private), POST is the
 * owner's ตรวจแล้ว — with a new picture when they laid more stickers on it.
 */

const ID = /^[0-9a-f-]{36}$/i;
const TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_BYTES = 4 * 1024 * 1024;

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id") ?? "";
  if (!ID.test(id)) return new Response("not found", { status: 404 });
  const paper = await claimPaper(id).catch(() => null);
  if (!paper) return new Response("not found", { status: 404 });
  return new Response(new Uint8Array(paper.bytes), { headers: { "content-type": paper.mimeType, "cache-control": "no-store" } });
}

export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null);
  const id = String(form?.get("id") ?? "");
  if (!form || !ID.test(id)) return Response.json({ ok: false, error: "ไม่พบชิ้นงานนี้" }, { status: 400 });
  const file = form.get("paper");
  let paper = null;
  if (file instanceof File && file.size > 0) {
    const ratio = Number(form.get("ratio"));
    if (!TYPES.has(file.type) || file.size > MAX_BYTES || !(ratio >= 0.2 && ratio <= 5)) {
      return Response.json({ ok: false, error: "รูปเอกสารไม่ถูกต้อง ลองใหม่อีกครั้งนะครับ" }, { status: 400 });
    }
    paper = { bytes: Buffer.from(await file.arrayBuffer()), mimeType: file.type, ratio };
  }
  return Response.json(await checkPaper(id, paper));
}
