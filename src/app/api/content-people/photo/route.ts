import type { NextRequest } from "next/server";
import { photoBytes } from "@/lib/content/people-store";

/** A reference photo for the library's thumbnails; the path is checked against its one shape first. */
export async function GET(req: NextRequest) {
  const photo = await photoBytes(req.nextUrl.searchParams.get("path") ?? "");
  if (!photo) return new Response("not found", { status: 404 });
  return new Response(new Uint8Array(photo.bytes), {
    headers: { "content-type": photo.mimeType, "cache-control": "private, max-age=300" },
  });
}
