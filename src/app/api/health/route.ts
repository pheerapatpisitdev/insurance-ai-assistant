import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { pageToken } from "@/lib/facebook/connection";

/**
 * Is the whole thing answering? Watched from outside, because an app that has stopped
 * cannot report that it has stopped. The check that matters is not "does the homepage
 * render" but "can an automated request reach this app and read its database" — the day
 * both bots went quiet, the site was serving people fine and refusing everything automated.
 *
 * Public and cheap on purpose: no secrets in the answer, one small query, nothing that
 * costs money or spends an API allowance.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const checks: Record<string, boolean> = {
    database: false,
    messenger: false,
  };
  try {
    const { error } = await supabaseAdmin().from("ins_alert_settings").select("id").limit(1);
    checks.database = !error;
  } catch {
    checks.database = false;
  }
  // the page connection, because a bot with no token is a page nobody is answering
  checks.messenger = Boolean(await pageToken().catch(() => null));
  const ok = Object.values(checks).every(Boolean);
  return NextResponse.json({ ok, checks, at: new Date().toISOString() }, { status: ok ? 200 : 503 });
}
