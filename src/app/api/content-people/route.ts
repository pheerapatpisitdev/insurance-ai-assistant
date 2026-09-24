import type { NextRequest } from "next/server";
import { addPerson, deletePerson, MAX_PHOTO_BYTES, PHOTO_TYPES } from "@/lib/content/people-store";
import { MAX_PHOTOS } from "@/lib/content/people";

/**
 * Adding and removing people, as plain requests: four photos are more than a server action's
 * one-megabyte body takes, and the page resizes them to 1024px before they are sent anyway.
 * The consent tick is checked here as well as on the page — the rule is the server's.
 */

export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null);
  if (!form) return Response.json({ ok: false, error: "ข้อมูลไม่ครบ ลองใหม่อีกครั้งนะครับ" }, { status: 400 });
  const name = String(form.get("name") ?? "").trim();
  if (!name || name.length > 40) return Response.json({ ok: false, error: "ตั้งชื่อ 1–40 ตัวอักษรนะครับ" }, { status: 400 });
  if (form.get("consent") !== "on") {
    return Response.json({ ok: false, error: "ต้องติ๊กยืนยันว่าได้รับความยินยอมจากเจ้าของรูปก่อนนะครับ" }, { status: 400 });
  }
  const files = form.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) return Response.json({ ok: false, error: "เลือกรูปอย่างน้อย 1 รูปนะครับ" }, { status: 400 });
  if (files.length > MAX_PHOTOS) return Response.json({ ok: false, error: `เลือกได้ไม่เกิน ${MAX_PHOTOS} รูปนะครับ` }, { status: 400 });
  for (const f of files) {
    if (!PHOTO_TYPES[f.type]) return Response.json({ ok: false, error: "รับเฉพาะรูป JPG, PNG หรือ WebP" }, { status: 400 });
    if (f.size > MAX_PHOTO_BYTES) return Response.json({ ok: false, error: "รูปใหญ่เกิน 5 MB" }, { status: 400 });
  }
  try {
    const photos = await Promise.all(files.map(async (f) => ({ bytes: Buffer.from(await f.arrayBuffer()), mimeType: f.type })));
    const person = await addPerson(name, photos);
    return Response.json({ ok: true, person });
  } catch (e) {
    console.error("person add failed:", e);
    return Response.json({ ok: false, error: "บันทึกไม่สำเร็จ ลองใหม่อีกครั้งนะครับ" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id") ?? "";
  try {
    await deletePerson(id);
    return Response.json({ ok: true });
  } catch (e) {
    console.error("person delete failed:", e);
    return Response.json({ ok: false, error: "ลบไม่สำเร็จ ลองใหม่อีกครั้งนะครับ" }, { status: 500 });
  }
}
