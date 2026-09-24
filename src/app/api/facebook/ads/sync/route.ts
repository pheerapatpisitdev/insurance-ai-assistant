import crypto from "crypto";
import { NextResponse } from "next/server";
import { syncAds } from "@/lib/ads/sync";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Whether the request carries the cron secret, compared in constant time.
 *
 * `!==` stops at the first differing character, so how long a refusal takes says how much of
 * a guess was right — slow to exploit over the internet, but the webhook check next door
 * (src/lib/facebook/verify.ts) already does this properly and a secret is a secret.
 */
function bearerMatches(header: string | null, secret: string): boolean {
  if (!header) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(`Bearer ${secret}`);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/**
 * Vercel calls this once a day (vercel.json) with `Authorization: Bearer <CRON_SECRET>`.
 * Nobody else is meant to: without the secret the route answers nobody at all, which is the
 * safer failure on a deployment that forgot to set it.
 *
 * The answer is 500 when every account failed. It used to be 200 whatever happened, so the
 * cron's own record showed a green tick on the nights nothing was fetched; one account
 * failing among several still answers 200, because the others did arrive, and each
 * account's failure is written onto its own card on the ADS page by the sync itself.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "ยังไม่ได้ตั้งค่า CRON_SECRET" }, { status: 503 });
  }
  if (!bearerMatches(req.headers.get("authorization"), secret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const result = await syncAds();
  for (const e of result.errors) console.error(`ดึงตัวเลขโฆษณา ${e.name} (${e.actId}) ไม่สำเร็จ: ${e.message}`);
  const allFailed = result.accounts > 0 && result.errors.length >= result.accounts;
  return NextResponse.json(result, { status: allFailed ? 500 : 200 });
}
