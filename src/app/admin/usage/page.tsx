import { supabaseServer } from "@/lib/supabase/server";
import { Card, Stat, Empty } from "../ui";
import { listPlans } from "@/calc/plans/registry";

export const dynamic = "force-dynamic";

const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
const baht = (n: number) => n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default async function UsagePage() {
  const supabase = await supabaseServer();
  const since = new Date(Date.now() - THIRTY_DAYS).toISOString();
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

  const [quotes, spend, budget] = await Promise.all([
    supabase.schema("ins").from("quote_events").select("plan_code, created_at, total_modal").gte("created_at", since),
    supabase.from("usage_ledger").select("cost_thb, model").gte("created_at", monthStart),
    supabase.from("app_settings").select("monthly_budget_thb").maybeSingle(),
  ]);

  const events = quotes.data ?? [];
  const planName = new Map(listPlans().map((p) => [p.code, p.name]));
  const byPlan = new Map<string, number>();
  const byDay = new Map<string, number>();
  for (const e of events) {
    byPlan.set(e.plan_code, (byPlan.get(e.plan_code) ?? 0) + 1);
    const day = String(e.created_at).slice(0, 10);
    byDay.set(day, (byDay.get(day) ?? 0) + 1);
  }
  const planRows = [...byPlan.entries()].sort((a, b) => b[1] - a[1]);
  const days = [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const peak = Math.max(1, ...days.map(([, n]) => n));
  const aiCost = (spend.data ?? []).reduce((s, r) => s + Number(r.cost_thb ?? 0), 0);
  const cap = budget.data?.monthly_budget_thb ?? null;

  return (
    <>
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <Stat label="การคำนวณ 30 วัน" value={events.length.toLocaleString("en-US")} sub="ครั้ง" />
        <Stat label="แบบที่ใช้บ่อยที่สุด" value={planRows[0] ? (planName.get(planRows[0][0]) ?? planRows[0][0]) : "—"}
              sub={planRows[0] ? `${planRows[0][1]} ครั้ง` : undefined} />
        <Stat label="ค่า AI เดือนนี้" value={`${baht(aiCost)} บาท`}
              sub={cap ? `จากงบ ${baht(Number(cap))} บาท` : "ยังไม่ได้ตั้งงบ"} />
      </div>

      <Card title="การคำนวณรายวัน" hint="30 วันล่าสุด">
        {days.length === 0 ? <Empty>ยังไม่มีการคำนวณที่บันทึกไว้</Empty> : (
          <div className="flex h-32 items-end gap-1">
            {days.map(([day, n]) => (
              <div key={day} className="flex-1" title={`${day}: ${n} ครั้ง`}>
                <div className="rounded-t bg-emerald-500" style={{ height: `${(n / peak) * 100}%`, minHeight: 2 }} />
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title="แยกตามแบบประกัน">
        {planRows.length === 0 ? <Empty>ยังไม่มีข้อมูล</Empty> : (
          <table className="w-full text-sm">
            <thead><tr className="border-b text-left text-slate-500"><th className="py-2">แบบประกัน</th><th className="py-2 pl-3 text-right">จำนวนครั้ง</th></tr></thead>
            <tbody>
              {planRows.map(([code, n]) => (
                <tr key={code} className="border-b">
                  <td className="py-1.5">{planName.get(code) ?? code}</td>
                  <td className="py-1.5 pl-3 text-right tabular-nums">{n.toLocaleString("en-US")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}
