import { share } from "@/lib/crm/summary";
import type { Counts } from "@/lib/crm/types";

/** The six figures the owner reads first, and nothing that needs explaining under them. */
export function Kpis({ counts, aiCostThisMonth }: { counts: Counts; aiCostThisMonth: number }) {
  const cards = [
    { label: "คนทักเข้ามา", value: counts.arrived, sub: `${counts.told} คนคุยต่อ` },
    { label: "ได้เบี้ยไป", value: counts.priced, sub: `${share(counts.priced, counts.arrived)}% ของคนที่ทัก` },
    { label: "สนใจสมัคร", value: counts.interested, sub: `${share(counts.interested, counts.arrived)}% ของคนที่ทัก` },
    { label: "กรอกฟอร์มแล้ว", value: counts.formDone, sub: `${share(counts.formDone, counts.interested)}% ของคนที่สนใจ` },
    { label: "เงียบหาย", value: counts.stalled, sub: `ตัวแทนตอบเอง ${counts.agentReplied}` },
    {
      label: "ค่า AI เดือนนี้",
      value: `฿${aiCostThisMonth.toLocaleString("en-US", { maximumFractionDigits: 0 })}`,
      sub: counts.arrived
        ? `฿${(aiCostThisMonth / counts.arrived).toFixed(2)} ต่อคนที่ทัก`
        : "ยังไม่มีคนทัก",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
      {cards.map((c) => (
        <div key={c.label} className="rounded-xl border border-slate-200 bg-white p-3.5">
          <div className="text-xs text-slate-500">{c.label}</div>
          <div className="mt-1 text-2xl font-bold tracking-tight tabular-nums">{c.value}</div>
          <div className="mt-0.5 text-xs text-slate-500">{c.sub}</div>
        </div>
      ))}
    </div>
  );
}
