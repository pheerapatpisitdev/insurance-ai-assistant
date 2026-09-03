import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

/**
 * The public calculator posts one row per quote so the back office can show usage.
 * No customer identifiers are stored, and a failure here must never affect a quote.
 */
export async function POST(request: NextRequest) {
  try {
    const b = await request.json();
    const row = {
      plan_code: String(b.planCode ?? "").slice(0, 40),
      variant: String(b.variant ?? "").slice(0, 40),
      age: Number(b.age),
      sex: b.sex === "F" ? "F" : "M",
      mode: ["annual", "semi", "monthly"].includes(b.mode) ? b.mode : "annual",
      rider_codes: Array.isArray(b.riderCodes) ? b.riderCodes.slice(0, 20).map((c: unknown) => String(c).slice(0, 20)) : [],
      total_modal: Math.max(0, Math.round(Number(b.totalModal) || 0)),
    };
    if (!row.plan_code || !row.variant || !Number.isFinite(row.age) || row.age < 0 || row.age > 120) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }
    const supabase = await supabaseServer();
    await supabase.schema("ins").from("quote_events").insert(row);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
