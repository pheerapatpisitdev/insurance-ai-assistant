import type { LeadView } from "./actions";
import type { UnansweredRow } from "@/lib/crm/types";

const PLAN_TAG: Record<string, { label: string; className: string }> = {
  lifeprotect: { label: "Life Protect", className: "bg-blue-50 text-blue-700" },
  ihealthy: { label: "iHealthy", className: "bg-emerald-50 text-emerald-700" },
  undecided: { label: "ยังไม่เลือก", className: "bg-slate-100 text-slate-600" },
};

const STAGE_TAG: Record<string, { label: string; className: string }> = {
  interested: { label: "สนใจสมัคร", className: "bg-green-100 text-green-700" },
  form_sent: { label: "ส่งฟอร์มแล้ว", className: "bg-fuchsia-100 text-fuchsia-700" },
  form_done: { label: "กรอกฟอร์มแล้ว", className: "bg-purple-100 text-purple-700" },
};

/** "3 ชม.ที่แล้ว" — near enough, and never a timestamp nobody reads. */
function ago(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "เมื่อครู่";
  if (mins < 60) return `${mins} นาทีที่แล้ว`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} ชม.ที่แล้ว`;
  const days = Math.round(hours / 24);
  return days === 1 ? "เมื่อวาน" : `${days} วันที่แล้ว`;
}

/**
 * What the bot last quoted this person, in the words of the figures it kept.
 *
 * `coverWanted` and `sumAssured` are shown by their own names and never interchanged: on the
 * life plan the family receives twice the sum assured before the booster age, so a column
 * that mixed them would state a cover nobody was ever offered.
 */
function quoteOf(q: Record<string, unknown> | null): { who: string; money: string } {
  if (!q || Object.keys(q).length === 0) return { who: "—", money: "—" };
  const num = (k: string) => (typeof q[k] === "number" ? (q[k] as number) : undefined);
  const str = (k: string) => (typeof q[k] === "string" ? (q[k] as string) : undefined);

  const parts: string[] = [];
  const age = num("age");
  const sex = str("sex");
  if (age !== undefined) parts.push(`${sex === "F" ? "ญ" : sex === "M" ? "ช" : ""} ${age}`.trim());
  const cover = num("coverWanted");
  if (cover !== undefined) parts.push(`ครอบครัวได้รับ ${cover.toLocaleString("en-US")}`);
  else {
    const sum = num("sumAssured");
    if (sum !== undefined) parts.push(`ทุน ${sum.toLocaleString("en-US")}`);
  }
  const plan = str("plan");
  if (plan) parts.push(plan);
  const territory = str("territory");
  if (territory) parts.push(territory);

  const annual = num("annual");
  return {
    who: parts.join(" · ") || "—",
    money: annual !== undefined ? `${annual.toLocaleString("en-US")} ฿/ปี` : "—",
  };
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="px-4 py-10 text-center text-sm text-slate-400">{children}</p>;
}

export function Leads(
  { tab, leads, unanswered }: { tab: string; leads: LeadView[]; unanswered: UnansweredRow[] },
) {
  const box = "rounded-b-xl border border-t-0 border-slate-200 bg-white overflow-x-auto";

  if (tab === "unanswered") {
    return (
      <div className={box}>
        {unanswered.length === 0 ? (
          <Empty>ยังไม่มีคำถามที่บอทตอบไม่ได้ — หรือยังไม่มีใครถาม</Empty>
        ) : (
          <ul className="divide-y divide-slate-100">
            {unanswered.map((u) => (
              <li key={u.id} className="px-4 py-3">
                <p className="text-sm text-slate-800">{u.question}</p>
                <p className="mt-1 text-xs text-slate-400">
                  {PLAN_TAG[u.product ?? "undecided"]?.label ?? u.product} · {u.intent ?? "ไม่ระบุ"} · {ago(u.at)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  if (leads.length === 0) {
    return (
      <div className={box}>
        <Empty>
          {tab === "follow" ? "ยังไม่มีใครต้องตามต่อ" : "ยังไม่มีลูกค้าในช่วงเวลานี้"}
        </Empty>
      </div>
    );
  }

  return (
    <div className={box}>
      <table className="w-full min-w-[46rem] border-collapse text-sm">
        <thead>
          <tr className="text-xs font-normal text-slate-500">
            {["ลูกค้า", "แผน", "ข้อมูล", "เบี้ยที่เสนอ", "มาจาก", "สถานะ", "ล่าสุด", ""].map((h) => (
              <th key={h} className="whitespace-nowrap border-b border-slate-200 px-3.5 py-2.5 text-left font-normal">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {leads.map((lead) => {
            const plan = PLAN_TAG[lead.product ?? "undecided"] ?? PLAN_TAG.undecided;
            const stage = STAGE_TAG[lead.stage] ?? { label: lead.stage, className: "bg-slate-100 text-slate-600" };
            const { who, money } = quoteOf(lead.last_quote);
            return (
              <tr key={lead.id} className="border-b border-slate-50 last:border-b-0">
                <td className="whitespace-nowrap px-3.5 py-3">
                  <div className="flex items-center gap-2.5">
                    {lead.picture ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={lead.picture} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
                    ) : (
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-200 text-xs text-slate-500">
                        {lead.name?.[0] ?? "?"}
                      </span>
                    )}
                    <span className="font-medium">
                      {lead.name ?? (lead.reachable ? "ไม่ทราบชื่อ" : "ลูกค้าเก่า")}
                    </span>
                  </div>
                </td>
                <td className="px-3.5 py-3">
                  <span className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs ${plan.className}`}>
                    {plan.label}
                  </span>
                </td>
                <td className="whitespace-nowrap px-3.5 py-3 text-xs text-slate-500">{who}</td>
                <td className="whitespace-nowrap px-3.5 py-3 tabular-nums">{money}</td>
                <td className="max-w-[9rem] truncate px-3.5 py-3 font-mono text-xs text-slate-400">
                  {lead.ad_id ?? "ทักตรง"}
                </td>
                <td className="px-3.5 py-3">
                  <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${stage.className}`}>
                    {stage.label}
                  </span>
                </td>
                <td className="whitespace-nowrap px-3.5 py-3 text-xs text-slate-500">{ago(lead.updated_at)}</td>
                <td className="px-3.5 py-3">
                  {lead.reachable ? (
                    <a
                      href="https://business.facebook.com/latest/inbox/all"
                      target="_blank"
                      rel="noreferrer"
                      className="whitespace-nowrap rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
                    >
                      เปิดแชท ↗
                    </a>
                  ) : (
                    <span className="text-xs text-slate-300">ติดต่อไม่ได้</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
