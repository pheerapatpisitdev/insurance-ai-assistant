import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Who hears about a new customer or a stopped bot, and how loudly.
 *
 * LINE's free plan allows 300 pushed messages a month — replies to customers are free, but
 * telling the agent about them is not — so every alert is counted against a cap that stops
 * short of it. Running out of quota silently would be the worst outcome: the alerts would
 * stop and nobody would know why.
 */

export type LeadsMode = "off" | "quote" | "all";

export interface AlertSettings {
  lineUserId: string | null;
  label: string | null;
  leadsMode: LeadsMode;
  monthlyCap: number;
  pendingCode: string | null;
  pendingUntil: string | null;
}

interface Row {
  line_user_id: string | null;
  label: string | null;
  leads_mode: LeadsMode;
  monthly_cap: number;
  pending_code: string | null;
  pending_until: string | null;
}

const DEFAULTS: AlertSettings = {
  lineUserId: null, label: null, leadsMode: "quote", monthlyCap: 250,
  pendingCode: null, pendingUntil: null,
};

export async function alertSettings(): Promise<AlertSettings> {
  const { data, error } = await supabaseAdmin()
    .from("ins_alert_settings")
    .select("line_user_id, label, leads_mode, monthly_cap, pending_code, pending_until")
    .maybeSingle();
  if (error) throw new Error(error.message);
  const row = data as Row | null;
  if (!row) return DEFAULTS;
  return {
    lineUserId: row.line_user_id,
    label: row.label,
    leadsMode: row.leads_mode,
    monthlyCap: row.monthly_cap,
    pendingCode: row.pending_code,
    pendingUntil: row.pending_until,
  };
}

export async function saveAlertSettings(patch: Partial<Row>): Promise<void> {
  const { error } = await supabaseAdmin()
    .from("ins_alert_settings")
    .upsert({ id: true, ...patch, updated_at: new Date().toISOString() }, { onConflict: "id" });
  if (error) throw new Error(error.message);
}

/** How many alerts have gone out since the first of the month. */
export async function sentThisMonth(): Promise<number> {
  const start = new Date();
  start.setUTCDate(1);
  start.setUTCHours(0, 0, 0, 0);
  const { count, error } = await supabaseAdmin()
    .from("ins_alert_log")
    .select("id", { count: "exact", head: true })
    .gte("sent_at", start.toISOString());
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function recordSent(kind: string, detail: string): Promise<void> {
  await supabaseAdmin().from("ins_alert_log").insert({ kind, detail: detail.slice(0, 300) });
}

export async function recentAlerts(limit = 10): Promise<{ kind: string; detail: string | null; sentAt: string }[]> {
  const { data } = await supabaseAdmin()
    .from("ins_alert_log").select("kind, detail, sent_at").order("sent_at", { ascending: false }).limit(limit);
  return ((data ?? []) as { kind: string; detail: string | null; sent_at: string }[])
    .map((r) => ({ kind: r.kind, detail: r.detail, sentAt: r.sent_at }));
}
