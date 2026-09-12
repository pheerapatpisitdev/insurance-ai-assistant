"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { formatBaht } from "@/calc/money";
import { priceWithRiders } from "@/app/ihealthy/actions";
import type {
  AttachedRider, RiderChoice, RiderQuoteInput, RiderQuoteResult,
} from "@/app/ihealthy/actions";

export interface RiderPanelProps {
  /** everything the action needs except the attached riders themselves */
  request: Omit<RiderQuoteInput, "riders">;
}

/** What is ticked and what has been typed into it. "" is a sum field mid-keystroke. */
type Attached = { sumAssured?: number | ""; plan?: number; option?: string };

/**
 * How long a change is left alone before the server is asked.
 *
 * A sum assured is typed digit by digit, and 1000000 down the wire a character at a time is
 * seven quotes for six arrangements nobody asked for. Ticks and picks are coalesced by the
 * same wait; a third of a second is under the round trip it saves.
 */
const SETTLE_MS = 300;

/** What a rider starts at when it is ticked: the package's pinned sum, the smallest plan or
 *  the first variant it sells, and its own floor where it takes a sum of its own. */
function opening(c: RiderChoice): Attached {
  return {
    ...(c.plans && c.plans.length > 0 ? { plan: c.plans[0] } : {}),
    ...(c.options && c.options.length > 0 ? { option: c.options[0].code } : {}),
    ...(c.exactSumAssured !== undefined ? { sumAssured: c.exactSumAssured }
      : c.saMin !== undefined ? { sumAssured: c.saMin } : {}),
  };
}

/**
 * The agent's fold. It asks the server for nothing until it is opened, so a customer who
 * never touches it never pays for the round trip — and never downloads the rate tables the
 * payor riders would need to price in the browser.
 */
export function RiderPanel({ request }: RiderPanelProps) {
  // Taken apart at the door. The calculator builds `request` inline, so a fresh object
  // arrives on every render; an effect that listed it as a dependency would ask the server
  // for the same arrangement again, set state, render, and ask again — for ever.
  const { base, age, sex, sumAssured, mode, plan, territory, coverage } = request;
  const [open, setOpen] = useState(false);
  const [chosen, setChosen] = useState<Record<string, Attached>>({});
  const [priced, setPriced] = useState<{ at: string; result: RiderQuoteResult }>();
  const [lost, setLost] = useState(false);
  const [pending, start] = useTransition();
  const newest = useRef(0);
  const asked = useRef(false);

  /** Which arrangement a result belongs to. One priced for another is not stale, it is wrong. */
  const at = [base, age, sex, sumAssured, mode, plan, territory, coverage].join("|");

  useEffect(() => {
    if (!open) return;
    const riders: AttachedRider[] = Object.entries(chosen).map(([code, a]) => ({
      code,
      ...(typeof a.sumAssured === "number" ? { sumAssured: a.sumAssured } : {}),
      ...(a.plan === undefined ? {} : { plan: a.plan }),
      ...(a.option === undefined ? {} : { option: a.option }),
    }));
    // The generation counter is for the answers already in flight when the next question is
    // asked: two server actions can land in either order, and an older one overwriting a
    // newer would leave a premium on screen for an arrangement nobody is looking at. Only
    // the first request skips the wait — an empty fold is what the agent is staring at.
    const generation = ++newest.current;
    const wait = asked.current ? SETTLE_MS : 0;
    asked.current = true;
    const timer = setTimeout(() => {
      start(async () => {
        try {
          const result = await priceWithRiders({
            base, age, sex, sumAssured, mode, plan, territory, coverage, riders,
          });
          if (newest.current !== generation) return;
          setPriced({ at, result });
          setLost(false);
        } catch {
          // The engine is at the other end of a wire now. A quote that never arrives has to
          // say so: the fold would otherwise sit there claiming to be still thinking.
          if (newest.current === generation) setLost(true);
        }
      });
    }, wait);
    return () => clearTimeout(timer);
  }, [open, chosen, at, base, age, sex, sumAssured, mode, plan, territory, coverage, start]);

  // The ticks are the agent's and survive the arrangement changing under them — switch to the
  // health package and back, and อุบัติเหตุ is still ticked. The figures do not: a total
  // priced for another age is withheld until this one comes back, while a total being
  // re-priced for the same arrangement is only dimmed, because every row in it still stands.
  const result = priced?.at === at ? priced.result : undefined;

  const toggle = (c: RiderChoice) =>
    setChosen((prev) => {
      const next = { ...prev };
      if (c.code in next) delete next[c.code];
      else next[c.code] = opening(c);
      return next;
    });
  const amend = (code: string, part: Attached) =>
    setChosen((prev) => ({ ...prev, [code]: { ...prev[code], ...part } }));

  const control =
    "rounded-sm border border-[var(--lg-panel-line)] bg-[var(--lg-raise)] px-2 py-1.5 text-sm tabular-nums text-[var(--lg-white)]";

  return (
    <details
      className="group rounded-sm border border-[var(--lg-hair)] bg-[var(--lg-panel)] print:hidden"
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-sm font-medium text-[var(--lg-white)] marker:hidden">
        แนบสัญญาเพิ่มเติมอื่น
        <span
          aria-hidden
          className="shrink-0 text-lg leading-none text-[var(--lg-gold)] transition-transform duration-300 group-open:rotate-45"
        >
          +
        </span>
      </summary>
      <div
        aria-busy={pending}
        className={`space-y-3 border-t border-[var(--lg-panel-line)] px-5 py-4 ${pending ? "opacity-60" : ""}`}
      >
        {lost && (
          <p className="text-sm text-[var(--lg-gold)]">คิดเบี้ยไม่สำเร็จ ลองเปลี่ยนตัวเลือกอีกครั้ง</p>
        )}
        {result === undefined ? (
          !lost && <p className="text-sm text-[var(--lg-mute)]">กำลังคิดเบี้ย</p>
        ) : (
          <>
            {result.available.map((c) => {
              const on = c.code in chosen;
              const picked = chosen[c.code];
              return (
                <div key={c.code} className="flex flex-wrap items-center gap-2.5">
                  <label className="flex flex-1 items-center gap-2.5 text-sm text-[var(--lg-white)]">
                    <input
                      type="checkbox" checked={on} onChange={() => toggle(c)}
                      className="h-4 w-4 shrink-0 accent-[var(--lg-gold)]"
                    />
                    {c.name}
                    {/* the rider's name wraps on a phone; "0 - 60 ปี" broken over two lines
                        reads as two different numbers */}
                    <span className="shrink-0 whitespace-nowrap text-xs text-[var(--lg-mute)]">{c.ageRange}</span>
                  </label>
                  {on && c.options && c.options.length > 0 && (
                    <select
                      aria-label={`แบบของ${c.name}`} className={control} value={picked.option ?? ""}
                      onChange={(e) => amend(c.code, { option: e.target.value })}
                    >
                      {c.options.map((o) => <option key={o.code} value={o.code}>{o.name}</option>)}
                    </select>
                  )}
                  {on && c.plans && c.plans.length > 0 && (
                    <select
                      aria-label={`แผนของ${c.name}`} className={control} value={picked.plan ?? ""}
                      onChange={(e) => amend(c.code, { plan: Number(e.target.value) })}
                    >
                      {c.plans.map((p) => (
                        <option key={p} value={p}>{p.toLocaleString("en-US")}</option>
                      ))}
                    </select>
                  )}
                  {on && c.exactSumAssured !== undefined && (
                    <span className="text-xs tabular-nums text-[var(--lg-mute)]">
                      ทุน {c.exactSumAssured.toLocaleString("en-US")} บาทเท่านั้น
                    </span>
                  )}
                  {on && c.exactSumAssured === undefined && c.saMin !== undefined && (
                    <input
                      type="number" inputMode="numeric" aria-label={`ทุนของ${c.name}`}
                      value={picked.sumAssured ?? ""} min={c.saMin} max={c.saMax} step={c.saMin}
                      onChange={(e) => amend(c.code, {
                        sumAssured: e.target.value === "" ? "" : Number(e.target.value),
                      })}
                      className={`w-32 ${control}`}
                    />
                  )}
                </div>
              );
            })}
            <dl className="space-y-1.5 border-t border-[var(--lg-panel-line)] pt-3 text-sm">
              {result.items.map((i) => (
                <div key={i.code} className="flex items-baseline justify-between gap-3">
                  <dt className="text-[var(--lg-mute)]">{i.name}</dt>
                  <dd
                    className={`lg-figure tabular-nums ${i.eligible ? "text-[var(--lg-white)]" : "text-[var(--lg-gold)]"}`}
                  >
                    {i.eligible ? formatBaht(i.modal) : i.message}
                  </dd>
                </div>
              ))}
              <div className="flex items-baseline justify-between gap-3 border-t border-[var(--lg-panel-line)] pt-2 font-medium">
                <dt className="text-[var(--lg-white)]">รวมทั้งหมด</dt>
                <dd className="lg-figure tabular-nums text-[var(--lg-white)]">{formatBaht(result.totalModal)}</dd>
              </div>
            </dl>
            {result.warnings.map((w) => (
              <p key={w} className="text-xs text-[var(--lg-gold)]">{w}</p>
            ))}
          </>
        )}
      </div>
    </details>
  );
}
