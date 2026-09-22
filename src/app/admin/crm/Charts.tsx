import type { Summary } from "@/lib/crm/types";

const DAY_NAMES = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

/** The tallest bar in a set, never zero — a chart of nothing must still have a scale. */
function peak(values: number[]): number {
  return Math.max(1, ...values);
}

/**
 * By day and by hour, and which advertisement paid for it.
 *
 * Bars rather than a plotting library: three series over thirty points is not a chart problem
 * worth a dependency, and a page in the back office should not wait on one to draw.
 */
export function Charts({ byDay, byHour, byAd }: Pick<Summary, "byDay" | "byHour" | "byAd">) {
  const dayPeak = peak(byDay.map((d) => d.arrived));
  const hourPeak = peak(byHour.map((h) => h.arrived));

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <section className="rounded-xl border border-[var(--bot-line)] bg-white p-4">
        <h2 className="mb-3.5 text-sm font-semibold">รายวัน</h2>
        <div className="flex h-32 items-end gap-1.5 overflow-x-auto">
          {byDay.map((d) => {
            const date = new Date(`${d.date}T00:00:00`);
            return (
              <div
                key={d.date}
                className="flex h-full min-w-[1.1rem] flex-1 flex-col justify-end gap-0.5"
                title={`${d.date} — ทัก ${d.arrived} / ได้เบี้ย ${d.priced} / สนใจ ${d.interested}`}
              >
                {/* Navy, sand, blue — the order the deck this palette comes from ranks its own
                    series in, which happens to be the order these three matter in: the people
                    who asked to sign up, the people who got as far as a price, and everyone
                    who said anything at all. */}
                <div className="rounded-t-sm bg-[var(--bot-navy)]" style={{ height: `${(d.interested / dayPeak) * 100}%` }} />
                <div className="bg-[var(--bot-sand)]" style={{ height: `${(d.priced / dayPeak) * 100}%` }} />
                <div className="rounded-b-sm bg-[var(--bot-blue)]" style={{ height: `${(d.arrived / dayPeak) * 100}%` }} />
                <div className="pt-1 text-center text-[10px] text-[var(--bot-ink-faint)]">
                  {byDay.length <= 10 ? DAY_NAMES[date.getDay()] : date.getDate()}
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap gap-4 text-xs text-[var(--bot-ink-mute)]">
          <span><i className="mr-1.5 inline-block h-2 w-2 rounded-sm bg-[var(--bot-blue)] align-middle" />ทักเข้ามา</span>
          <span><i className="mr-1.5 inline-block h-2 w-2 rounded-sm bg-[var(--bot-sand)] align-middle" />ได้เบี้ย</span>
          <span><i className="mr-1.5 inline-block h-2 w-2 rounded-sm bg-[var(--bot-navy)] align-middle" />สนใจสมัคร</span>
        </div>
      </section>

      <section className="rounded-xl border border-[var(--bot-line)] bg-white p-4">
        <h2 className="mb-1 text-sm font-semibold">ช่วงเวลาที่คนทักเยอะ</h2>
        <p className="mb-3 text-xs text-[var(--bot-ink-mute)]">เอาไปตั้งเวลายิงแอด และรู้ว่าต้องเฝ้าแชทช่วงไหน</p>
        <div className="flex h-24 items-end gap-px">
          {byHour.map((h) => (
            <div
              key={h.hour}
              className="flex-1 rounded-t-sm bg-[var(--bot-blue)]"
              style={{ height: `${Math.max((h.arrived / hourPeak) * 100, 2)}%` }}
              title={`${String(h.hour).padStart(2, "0")}:00 — ${h.arrived} คน`}
            />
          ))}
        </div>
        <div className="mt-1 flex justify-between text-[10px] text-[var(--bot-ink-faint)]">
          <span>00</span><span>06</span><span>12</span><span>18</span><span>23</span>
        </div>

        <h2 className="mb-2 mt-5 text-sm font-semibold">มาจากแอดไหน</h2>
        {byAd.length === 0 ? (
          <p className="text-xs text-[var(--bot-ink-faint)]">
            ยังไม่มีข้อมูลโฆษณา — ต้องให้เพจรับ <code>messaging_referrals</code> ก่อน
          </p>
        ) : (
          <ul className="space-y-1.5 text-sm">
            {byAd.slice(0, 5).map((a) => (
              <li key={a.adId} className="flex items-baseline justify-between gap-3">
                <span className="truncate font-mono text-xs text-[var(--bot-ink-foot)]">{a.adId}</span>
                <span className="shrink-0 tabular-nums text-[var(--bot-ink-mute)]">
                  {a.arrived} ทัก · <b className="text-[var(--bot-ink)]">{a.interested}</b> สนใจ
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
