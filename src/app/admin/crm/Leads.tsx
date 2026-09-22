import { BotResume } from "./BotResume";
import type { LeadView } from "./actions";
import type { UnansweredRow } from "@/lib/crm/types";

const PLAN_TAG: Record<string, { label: string; className: string }> = {
  lifeprotect: { label: "Life Protect", className: "bg-[var(--bot-navy-soft)] text-[var(--bot-navy)]" },
  ihealthy: { label: "iHealthy", className: "bg-[var(--bot-ok-soft)] text-[var(--bot-ok)]" },
  undecided: { label: "ยังไม่เลือก", className: "bg-[var(--bot-panel)] text-[var(--bot-ink-foot)]" },
};

/**
 * The three stages, as one ramp rather than three unrelated colours.
 *
 * These are a sequence — somebody is interested, then they are sent a form, then they return
 * it — so the chips deepen along it, ending on the accent itself for the one stage that is an
 * outcome. Read down a column of leads and the dark chips are the ones to act on.
 */
const STAGE_TAG: Record<string, { label: string; className: string }> = {
  interested: { label: "สนใจสมัคร", className: "bg-[var(--bot-sand-soft)] text-[var(--bot-sand-ink)]" },
  form_sent: { label: "ส่งฟอร์มแล้ว", className: "bg-[var(--bot-navy-soft)] text-[var(--bot-navy)]" },
  form_done: { label: "กรอกฟอร์มแล้ว", className: "bg-[var(--bot-navy)] text-[var(--bot-surface)]" },
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
  return <p className="px-4 py-10 text-center text-sm text-[var(--bot-ink-faint)]">{children}</p>;
}

export function Leads(
  { tab, leads, unanswered }: { tab: string; leads: LeadView[]; unanswered: UnansweredRow[] },
) {
  const box = "rounded-b-xl border border-t-0 border-[var(--bot-line)] bg-white overflow-x-auto";

  if (tab === "unanswered") {
    return (
      <div className={box}>
        {unanswered.length === 0 ? (
          <Empty>ยังไม่มีคำถามที่บอทตอบไม่ได้ — หรือยังไม่มีใครถาม</Empty>
        ) : (
          <ul className="divide-y divide-[var(--bot-line)]">
            {unanswered.map((u) => (
              <li key={u.id} className="px-4 py-3">
                <p className="text-sm text-[var(--bot-ink)]">{u.question}</p>
                <p className="mt-1 text-xs text-[var(--bot-ink-faint)]">
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
          <tr className="text-xs font-normal text-[var(--bot-ink-mute)]">
            {["ลูกค้า", "แผน", "ข้อมูล", "เบี้ยที่เสนอ", "มาจาก", "สถานะ", "ล่าสุด", ""].map((h) => (
              <th key={h} className="whitespace-nowrap border-b border-[var(--bot-line)] px-3.5 py-2.5 text-left font-normal">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {leads.map((lead) => {
            const plan = PLAN_TAG[lead.product ?? "undecided"] ?? PLAN_TAG.undecided;
            const stage = STAGE_TAG[lead.stage] ?? { label: lead.stage, className: "bg-[var(--bot-panel)] text-[var(--bot-ink-foot)]" };
            const { who, money } = quoteOf(lead.last_quote);
            return (
              <tr key={lead.id} className="border-b border-[var(--bot-line)] last:border-b-0">
                <td className="whitespace-nowrap px-3.5 py-3">
                  <div className="flex items-center gap-2.5">
                    {lead.picture ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={lead.picture} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
                    ) : (
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--bot-panel)] text-xs text-[var(--bot-ink-mute)]">
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
                <td className="whitespace-nowrap px-3.5 py-3 text-xs text-[var(--bot-ink-mute)]">{who}</td>
                <td className="whitespace-nowrap px-3.5 py-3 tabular-nums">{money}</td>
                <td className="max-w-[9rem] truncate px-3.5 py-3 font-mono text-xs text-[var(--bot-ink-faint)]">
                  {lead.ad_id ?? "ทักตรง"}
                </td>
                <td className="px-3.5 py-3">
                  <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${stage.className}`}>
                    {stage.label}
                  </span>
                  {/* the state the button acts on, said in the row rather than left to a tooltip */}
                  {lead.botStopped && (
                    <span className="mt-1 block whitespace-nowrap text-xs text-[var(--bot-ink-faint)]">บอทหยุดตอบแล้ว</span>
                  )}
                </td>
                <td className="whitespace-nowrap px-3.5 py-3 text-xs text-[var(--bot-ink-mute)]">{ago(lead.updated_at)}</td>
                <td className="px-3.5 py-3">
                  <div className="flex items-center gap-1.5">
                    {lead.reachable ? (
                      <a
                        href="https://business.facebook.com/latest/inbox/all"
                        target="_blank"
                        rel="noreferrer"
                        className="whitespace-nowrap rounded-lg border border-[var(--bot-line)] px-2.5 py-1.5 text-xs text-[var(--bot-ink-foot)] hover:bg-[var(--bot-band)]"
                      >
                        เปิดแชท ↗
                      </a>
                    ) : (
                      <span className="text-xs text-[var(--bot-ink-faint)]">ติดต่อไม่ได้</span>
                    )}
                    {/* only where there is a silence to end: the bot is answering everyone else */}
                    {lead.botStopped && <BotResume leadId={lead.id} />}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
