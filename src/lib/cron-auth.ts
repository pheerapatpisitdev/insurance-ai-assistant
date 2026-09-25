import crypto from "crypto";
import { NextResponse } from "next/server";

/**
 * Whether the request carries the cron secret, compared in constant time.
 *
 * `!==` stops at the first differing character, so how long a refusal takes says how much of
 * a guess was right — slow to exploit over the internet, but the webhook check next door
 * (src/lib/facebook/verify.ts) already does this properly and a secret is a secret.
 */
export function bearerMatches(header: string | null, secret: string): boolean {
  if (!header) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(`Bearer ${secret}`);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/**
 * The refusal for a request Vercel's cron did not make, or null when it did. Without the
 * secret set the route answers nobody at all, which is the safer failure on a deployment that
 * forgot it.
 */
export function refuseUnlessCron(req: Request): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "ยังไม่ได้ตั้งค่า CRON_SECRET" }, { status: 503 });
  if (!bearerMatches(req.headers.get("authorization"), secret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return null;
}
