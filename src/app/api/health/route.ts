import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

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
    line: Boolean(process.env.LINE_CHANNEL_ACCESS_TOKEN && process.env.LINE_CHANNEL_SECRET),
  };
  try {
    const { error } = await supabaseAdmin().from("ins_alert_settings").select("id").limit(1);
    checks.database = !error;
  } catch {
    checks.database = false;
  }
  const ok = Object.values(checks).every(Boolean);
  return NextResponse.json({ ok, checks, at: new Date().toISOString() }, { status: ok ? 200 : 503 });
}
