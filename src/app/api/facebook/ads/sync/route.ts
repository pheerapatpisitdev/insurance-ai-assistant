import { NextResponse } from "next/server";
import { syncAds } from "@/lib/ads/sync";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Vercel calls this once a day (vercel.json) with `Authorization: Bearer <CRON_SECRET>`.
 * Nobody else is meant to: without the secret the route answers nobody at all, which is the
 * safer failure on a deployment that forgot to set it.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "ยังไม่ได้ตั้งค่า CRON_SECRET" }, { status: 503 });
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const result = await syncAds();
  for (const e of result.errors) console.error(`ดึงตัวเลขโฆษณา ${e.name} (${e.actId}) ไม่สำเร็จ: ${e.message}`);
  return NextResponse.json(result);
}
