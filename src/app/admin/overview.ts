"use server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { monthSpend, monthStart } from "@/lib/ai/ledger";
import { pageConnection } from "@/lib/facebook/connection";
import { SUBSCRIBED_FIELDS } from "@/lib/facebook/oauth";
import { tablesMeta } from "@/lib/api/service";
import { daysUntil } from "@/calc/calendar";

/**
 * What is waiting for somebody, and how the week has gone.
 *
 * `/admin` was a five-line redirect to the AI settings, so opening the back office told you
 * nothing and landed you on the page you were least likely to want. The owner named the gap:
 * "no page that shows the overall picture".
 *
 * The rule for the top half is that a warning appears only when it is true. A dashboard whose
 * panels are always lit is a dashboard nobody reads, and this system has a live example of the
 * cost: the Messenger subscription has never been switched on, so no customer message has ever
 * reached the database — and the only place that was visible was a page nobody had reason to
 * open.
 */

export type Urgency = "wait" | "soon";

export interface Attention {
  id: string;
  title: string;
  detail: string;
  href: string;
  action: string;
  urgency: Urgency;
}

export interface Week {
  arrived: number;
  priced: number;
  interested: number;
  unanswered: number;
  aiCostThisMonth: number;
  budgetThb: number | null;
}

export interface Overview {
  attention: Attention[];
  week: Week;
}

const DAYS = 7;
/** far enough ahead that new rates can be asked for without anybody hurrying */
const EXPIRY_WARNING_DAYS = 60;

export async function loadOverview(): Promise<Overview> {
  const supabase = supabaseAdmin();
  const since = new Date(Date.now() - DAYS * 86_400_000).toISOString();

  const [connection, unanswered, conversations, spend, settings] = await Promise.all([
    pageConnection().catch(() => null),
    supabase.from("ins_unanswered").select("id", { count: "exact", head: true }).gte("at", since),
    supabase.from("ins_conversations").select("priced_at, form_sent_at").gte("started_at", since),
    monthSpend(monthStart()),
    supabase.from("ins_ai_settings").select("monthly_budget_thb").maybeSingle(),
  ]);

  const rows = (conversations.data ?? []) as { priced_at: string | null; form_sent_at: string | null }[];
  const aiCost = spend.baht;
  const budget = settings.data?.monthly_budget_thb ?? null;

  const attention: Attention[] = [];

  /**
   * The subscription first, because without it none of the rest of this page has any figures
   * to show. A connected Page that is not subscribed looks connected on every screen that
   * only asks whether a token exists.
   */
  const missing = SUBSCRIBED_FIELDS.filter((f) => !(connection?.fields ?? []).includes(f));
  if (!connection) {
    attention.push({
      id: "page", urgency: "soon",
      title: "ยังไม่ได้เชื่อมเพจเฟซบุ๊ก",
      detail: "บอทยังตอบข้อความในเพจไม่ได้ และยังไม่มีข้อมูลลูกค้าเข้าระบบ",
      href: "/admin/messenger", action: "ไปเชื่อมเพจ",
    });
  } else if (missing.length > 0) {
    attention.push({
      id: "subscribe", urgency: "soon",
      title: "เชื่อมเพจแล้ว แต่ยังไม่ได้สมัครรับข้อความ",
      detail: `ข้อความจากลูกค้ายังไม่เข้าระบบเลย ต้องกดปุ่มสมัครรับอีกครั้ง (ขาด ${missing.join(", ")})`,
      href: "/admin/messenger", action: "กดสมัครรับ",
    });
  }

  const asked = unanswered.count ?? 0;
  if (asked > 0) {
    attention.push({
      id: "unanswered", urgency: "wait",
      title: `มีคำถามที่ผู้ช่วยตอบเองไม่ได้ ${asked} ข้อ`,
      detail: "อ่านแล้วเขียนคำตอบไว้ ครั้งหน้าระบบจะตอบได้เองโดยไม่ต้องเสียค่า AI",
      href: "/admin/crm?tab=unanswered", action: "ไปอ่าน",
    });
  }

  const meta = tablesMeta();
  const left = daysUntil(new Date(), meta.expiresOn);
  if (meta.expired || left <= EXPIRY_WARNING_DAYS) {
    attention.push({
      id: "rates", urgency: meta.expired ? "soon" : "wait",
      title: meta.expired ? "ตารางเบี้ยหมดอายุแล้ว" : `ตารางเบี้ยเหลืออีก ${left} วัน`,
      detail: `ชุด ${meta.version} ใช้ได้ถึง ${meta.expiresOn} — ขอชุดใหม่จากบริษัทไว้ก่อน`,
      href: "/admin/ai", action: "ดูรายละเอียด",
    });
  }

  if (budget !== null && aiCost >= budget * 0.8) {
    attention.push({
      id: "budget", urgency: aiCost >= budget ? "soon" : "wait",
      title: aiCost >= budget ? "ค่า AI เดือนนี้เต็มงบแล้ว" : "ค่า AI เดือนนี้ใกล้เต็มงบ",
      detail: `ใช้ไป ${aiCost.toFixed(2)} จาก ${budget} บาท — เต็มงบแล้วผู้ช่วยจะหยุดตอบทั้งเว็บและเพจ`,
      href: "/admin/ai", action: "ดูการใช้งาน",
    });
  }

  return {
    attention,
    week: {
      arrived: rows.length,
      priced: rows.filter((r) => r.priced_at).length,
      interested: rows.filter((r) => r.form_sent_at).length,
      unanswered: asked,
      aiCostThisMonth: aiCost,
      budgetThb: budget,
    },
  };
}
