import Link from "next/link";
import { loadOverview } from "./overview";
import { Card, Empty } from "./ui";
import { isSignedIn } from "@/lib/admin/session";

export const dynamic = "force-dynamic";

/**
 * The first thing the back office says when it is opened.
 *
 * It was a redirect to the AI settings, which meant opening the tool told you nothing and
 * dropped you on the page you were least likely to have come for. What it says now is the two
 * things worth knowing at the door: whether anything is waiting, and how the week went.
 *
 * The waiting half is empty when nothing is waiting, on purpose. A panel that is always lit is
 * one that stops being read — and this system has the proof: the Messenger subscription has
 * never been switched on, no customer message has ever reached the database because of it, and
 * the only screen that said so was one nobody had a reason to open.
 */

const TONE = {
  soon: { ring: "border-[var(--bot-sand-line)] bg-[var(--bot-sand-soft)]", ink: "text-[var(--bot-sand-ink)]", sub: "text-[var(--bot-sand-ink)]" },
  wait: { ring: "border-[var(--bot-line)] bg-white", ink: "text-[var(--bot-ink)]", sub: "text-[var(--bot-ink-mute)]" },
} as const;

function Figure({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-lg border border-[var(--bot-line)] bg-white px-3 py-2.5">
      <p className="text-xs text-[var(--bot-ink-mute)]">{label}</p>
      <p className="mt-0.5 text-xl font-semibold tabular-nums text-[var(--bot-ink)]">{value}</p>
      {note && <p className="text-xs text-[var(--bot-ink-faint)]">{note}</p>}
    </div>
  );
}

export default async function OverviewPage() {
  /**
   * No session, nothing to read.
   *
   * The layout has the PIN box up already — a page renders beside its layout, not after it —
   * and the loaders below all throw at a missing session. That throw reached the browser as
   * Next's error screen: an owner whose twelve hours had run out was told the back office had
   * broken rather than being asked for the PIN. The actions still throw; they are a network
   * boundary and this is a screen.
   */
  if (!(await isSignedIn())) return null;

  const { attention, week } = await loadOverview();
  const n = (v: number) => v.toLocaleString("en-US");

  return (
    <>
      <Card title="ต้องจัดการ" hint="ขึ้นเฉพาะเรื่องที่ค้างอยู่จริง — ไม่มีอะไรค้างก็ว่างไว้">
        {attention.length === 0 ? (
          <Empty>ไม่มีอะไรค้างครับ ระบบทำงานปกติ</Empty>
        ) : (
          <ul className="space-y-2">
            {attention.map((a) => {
              const tone = TONE[a.urgency];
              return (
                <li key={a.id} className={`flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2.5 ${tone.ring}`}>
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-medium ${tone.ink}`}>{a.title}</p>
                    <p className={`mt-0.5 text-xs ${tone.sub}`}>{a.detail}</p>
                  </div>
                  <Link href={a.href} className="shrink-0 rounded border border-[var(--bot-line-strong)] bg-white px-2.5 py-1 text-xs text-[var(--bot-ink-foot)] no-underline hover:bg-[var(--bot-band)]">
                    {a.action}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card title="เจ็ดวันที่ผ่านมา" hint="นับจากบทสนทนาในเพจ — ตัวเลขเต็มอยู่ที่หน้าลูกค้า">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Figure label="ลูกค้าทักเข้ามา" value={n(week.arrived)} />
          <Figure label="ได้รับใบเสนอเบี้ย" value={n(week.priced)} />
          <Figure label="ขอสมัคร" value={n(week.interested)} />
          <Figure
            label="ถามแล้วตอบไม่ได้"
            value={n(week.unanswered)}
            note={week.unanswered > 0 ? "เขียนคำตอบไว้ได้" : undefined}
          />
        </div>
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Figure
            label="ค่า AI เดือนนี้"
            value={`${week.aiCostThisMonth.toFixed(2)} บาท`}
            note={week.budgetThb === null ? "ยังไม่ได้ตั้งงบ" : `จากงบ ${n(week.budgetThb)} บาท`}
          />
        </div>
      </Card>
    </>
  );
}
