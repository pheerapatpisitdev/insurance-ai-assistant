"use server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { pinMatches, startSession } from "@/lib/admin/session";
import { supabaseAdmin } from "@/lib/supabase/admin";

const WINDOW_MINUTES = 15;
const MAX_FAILURES = 5;

async function clientIp(): Promise<string> {
  const h = await headers();
  return (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "unknown").trim();
}

/**
 * A 6-digit PIN is only 1,000,000 combinations, so the lockout is what makes it safe:
 * five wrong tries from one address blocks that address for 15 minutes.
 */
export async function signIn(formData: FormData): Promise<{ error: string } | undefined> {
  const pin = String(formData.get("pin") ?? "").trim();
  const ip = await clientIp();
  const supabase = supabaseAdmin();
  const since = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000).toISOString();

  const { count } = await supabase
    .from("ins_login_attempts")
    .select("id", { count: "exact", head: true })
    .eq("ip", ip)
    .eq("ok", false)
    .gte("created_at", since);
  if ((count ?? 0) >= MAX_FAILURES) {
    return { error: `กรอกผิดเกิน ${MAX_FAILURES} ครั้ง กรุณารออีก ${WINDOW_MINUTES} นาที` };
  }

  if (!/^\d{6}$/.test(pin)) return { error: "กรุณากรอกรหัส 6 หลัก" };

  const ok = pinMatches(pin);
  await supabase.from("ins_login_attempts").insert({ ip, ok });
  if (!ok) {
    const left = MAX_FAILURES - (count ?? 0) - 1;
    return { error: left > 0 ? `รหัสไม่ถูกต้อง เหลืออีก ${left} ครั้ง` : "รหัสไม่ถูกต้อง ถูกระงับชั่วคราว" };
  }

  await startSession();
  /** the address they typed to get here, which is now the overview rather than a redirect */
  redirect("/admin");
}

export async function signOut(): Promise<void> {
  const { endSession } = await import("@/lib/admin/session");
  await endSession();
  redirect("/admin");
}
