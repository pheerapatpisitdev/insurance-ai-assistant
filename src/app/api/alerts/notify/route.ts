import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { alert } from "@/lib/alerts/send";

/**
 * A way in for whatever watches the health endpoint from outside — n8n, an uptime monitor,
 * anything that can call a URL — so a downtime warning reaches the same LINE chat as
 * everything else instead of an inbox nobody reads.
 *
 * Guarded by a shared secret rather than the admin cookie, because the caller is a machine.
 * Compared the slow way so the answer time says nothing about the secret.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function secretMatches(given: string | null): boolean {
  const expected = process.env.ALERT_WEBHOOK_SECRET;
  if (!expected || !given) return false;
  const a = createHmac("sha256", expected).update(given).digest();
  const b = createHmac("sha256", expected).update(expected).digest();
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  if (!secretMatches(req.headers.get("x-alert-secret"))) {
    return new NextResponse("forbidden", { status: 403 });
  }
  let text = "";
  try {
    text = String(((await req.json()) as { text?: unknown }).text ?? "").trim();
  } catch {
    return new NextResponse("bad body", { status: 400 });
  }
  if (!text) return new NextResponse("empty", { status: 400 });
  const outcome = await alert("health", `⚠️ ${text.slice(0, 400)}`);
  return NextResponse.json({ outcome }, { status: outcome === "sent" ? 200 : 202 });
}
