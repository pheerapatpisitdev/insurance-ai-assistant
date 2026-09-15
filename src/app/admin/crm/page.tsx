import Link from "next/link";
import { loadCrm } from "./actions";
import { share } from "@/lib/crm/summary";
import type { Range } from "@/lib/crm/types";
import { Kpis } from "./Kpis";
import { Funnel } from "./Funnel";
import { Charts } from "./Charts";
import { Leads } from "./Leads";

export const dynamic = "force-dynamic";

const RANGES: { key: Range; label: string }[] = [
  { key: "today", label: "วันนี้" },
  { key: "7d", label: "7 วัน" },
  { key: "30d", label: "30 วัน" },
];

const TABS = [
  { key: "recent", label: "ลูกค้าล่าสุด" },
  { key: "follow", label: "ต้องตามต่อ" },
  { key: "unanswered", label: "คำถามที่ตอบไม่ได้" },
] as const;

type Tab = (typeof TABS)[number]["key"];

function isRange(v: string | undefined): v is Range {
  return v === "today" || v === "7d" || v === "30d";
}

function isTab(v: string | undefined): v is Tab {
  return v === "recent" || v === "follow" || v === "unanswered";
}

export default async function CrmPage(
  { searchParams }: { searchParams: Promise<{ range?: string; tab?: string }> },
) {
  const params = await searchParams;
  const range = isRange(params.range) ? params.range : "7d";
  const tab = isTab(params.tab) ? params.tab : "recent";
  const { summary, leads, unanswered, aiCostThisMonth } = await loadCrm(range);
  const { counts } = summary;

  /** Everyone the bot quoted who then went quiet, plus everyone who asked to apply. */
  const following = leads.filter((l) => l.stage !== "form_done");

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        {RANGES.map((r) => (
          <Link
            key={r.key}
            href={`/admin/crm?range=${r.key}&tab=${tab}`}
            className={`rounded-lg border px-3.5 py-1.5 text-sm ${
              r.key === range
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            {r.label}
          </Link>
        ))}
        {counts.arrived === 0 && (
          <p className="ml-auto text-xs text-slate-500">
            ยังไม่มีข้อมูลในช่วงนี้ — ระบบเริ่มบันทึกตั้งแต่วันที่อัปเดตบอท
          </p>
        )}
      </div>

      <Kpis counts={counts} aiCostThisMonth={aiCostThisMonth} />
      <Funnel counts={counts} byProduct={summary.byProduct} />
      <Charts byDay={summary.byDay} byHour={summary.byHour} byAd={summary.byAd} />

      <div>
        <nav className="flex gap-0.5 border-b border-slate-200">
          {TABS.map((t) => {
            const n = t.key === "unanswered" ? unanswered.length : t.key === "follow" ? following.length : leads.length;
            return (
              <Link
                key={t.key}
                href={`/admin/crm?range=${range}&tab=${t.key}`}
                className={`-mb-px border-b-2 px-4 py-2.5 text-sm ${
                  t.key === tab
                    ? "border-blue-600 font-semibold text-slate-900"
                    : "border-transparent text-slate-500 hover:text-slate-700"
                }`}
              >
                {t.label} · {n}
              </Link>
            );
          })}
        </nav>
        <Leads
          tab={tab}
          leads={tab === "follow" ? following : leads}
          unanswered={unanswered}
        />
      </div>

      <p className="rounded-lg border border-sky-200 bg-sky-50 px-3.5 py-3 text-xs leading-relaxed text-sky-900">
        ชื่อกับรูปดึงสดจาก Facebook ตอนเปิดหน้านี้ ไม่ได้เก็บลงฐานข้อมูล ·
        ตัวเลขสถิติเก็บตลอด แต่รายละเอียดเหตุการณ์ถูกลบเมื่อเก่ากว่า 13 เดือน ·
        อัตราที่คิดได้ {share(counts.priced, counts.arrived)}% ของคนที่ทักเข้ามา
      </p>
    </div>
  );
}
