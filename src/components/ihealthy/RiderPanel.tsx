"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { formatBaht } from "@/calc/money";
import { PAY_MODE_LABEL } from "@/calc/types";
import { MoneyInput } from "@/components/MoneyInput";
import { priceWithRiders } from "@/app/ihealthy-ultra/actions";
import type { RiderChoice, RiderQuoteInput, RiderQuoteResult } from "@/app/ihealthy-ultra/actions";
import { arrangementKey, attachedRiders, type RiderPick } from "@/components/ihealthy/rider-request";

export interface RiderPanelProps {
  /** everything the action needs except the attached riders themselves */
  request: Omit<RiderQuoteInput, "riders">;
}

/**
 * The last thing the server said about one arrangement: a quote, or nothing at all because
 * the asking failed. One value and not a result beside a flag, because those two can
 * disagree — a failed tick would otherwise leave the rider ticked above a total that was
 * worked out before it, which reads as a priced arrangement and is not one.
 */
interface Answer {
  at: string;
  result?: RiderQuoteResult;
}

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
function opening(c: RiderChoice): RiderPick {
  return {
    ...(c.plans && c.plans.length > 0 ? { plan: c.plans[0] } : {}),
    ...(c.options && c.options.length > 0 ? { option: c.options[0].code } : {}),
    ...(c.exactSumAssured !== undefined ? { sumAssured: c.exactSumAssured }
      : c.saMin !== undefined ? { sumAssured: c.saMin } : {}),
  };
}

/** The bounds the rider is written between, where it has them. */
function range(c: RiderChoice): string {
  if (c.saMin === undefined) return "";
  const min = c.saMin.toLocaleString("en-US");
  return c.saMax === undefined ? min : `${min} – ${c.saMax.toLocaleString("en-US")}`;
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
  const [chosen, setChosen] = useState<Record<string, RiderPick>>({});
  const [answer, setAnswer] = useState<Answer>();
  const [pending, start] = useTransition();
  const newest = useRef(0);

  const at = arrangementKey(request);

  useEffect(() => {
    if (!open) return;
    const riders = attachedRiders(chosen);
    // Nothing is asked until the typing settles; only the first question skips the wait,
    // because an empty fold is what the agent is staring at. The generation is what makes a
    // late answer harmless — the router queues these POSTs today, but the guard costs a
    // number and does not depend on it staying that way.
    const wait = newest.current === 0 ? 0 : SETTLE_MS;
    const generation = ++newest.current;
    const timer = setTimeout(() => {
      start(async () => {
        try {
          const result = await priceWithRiders({
            base, age, sex, sumAssured, mode, plan, territory, coverage, riders,
          });
          if (newest.current === generation) setAnswer({ at, result });
        } catch {
          // The engine is at the other end of a wire now. A quote that never arrives leaves
          // this arrangement with no figures at all rather than the last one's.
          if (newest.current === generation) setAnswer({ at });
        }
      });
    }, wait);
    return () => clearTimeout(timer);
  }, [open, chosen, at, base, age, sex, sumAssured, mode, plan, territory, coverage, start]);

  // The ticks are the agent's and survive the arrangement changing under them — switch to the
  // health package and back, and อุบัติเหตุ is still ticked. The figures do not: an answer
  // about another arrangement is withheld until this one is answered, while one being
  // re-priced for the same arrangement is only dimmed, because every row in it still stands.
  const answered = answer?.at === at ? answer : undefined;
  const result = answered?.result;
  const lost = answered !== undefined && answered.result === undefined;

  const toggle = (c: RiderChoice) =>
    setChosen((prev) => {
      const next = { ...prev };
      if (c.code in next) delete next[c.code];
      else next[c.code] = opening(c);
      return next;
    });
  const amend = (code: string, part: RiderPick) =>
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
        {lost ? (
          <p className="text-sm text-[var(--lg-gold)]">คิดเบี้ยไม่สำเร็จ ปิดแล้วเปิดใหม่เพื่อลองอีกครั้ง</p>
        ) : result === undefined ? (
          <p className="text-sm text-[var(--lg-mute)]">กำลังคิดเบี้ย</p>
        ) : (
          <>
            {result.available.map((c) => {
              const on = c.code in chosen && c.eligible;
              const picked = chosen[c.code];
              return (
                <div
                  key={c.code}
                  className={`flex flex-wrap items-center gap-2.5 ${c.eligible ? "" : "opacity-55"}`}
                >
                  <label className="flex flex-1 items-center gap-2.5 text-sm text-[var(--lg-white)]">
                    <input
                      type="checkbox" checked={on} disabled={!c.eligible} onChange={() => toggle(c)}
                      className="h-4 w-4 shrink-0 accent-[var(--lg-gold)]"
                    />
                    {c.name}
                    {/* the rider's name wraps on a phone; "0 - 60 ปี" broken over two lines
                        reads as two different numbers */}
                    <span className="shrink-0 whitespace-nowrap text-xs text-[var(--lg-mute)]">{c.ageRange}</span>
                  </label>
                  {!c.eligible && (
                    <span className="text-xs text-[var(--lg-mute)]">{c.reason}</span>
                  )}
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
                    <span className="text-xs text-[var(--lg-mute)]">{c.exactMessage}</span>
                  )}
                  {on && c.exactSumAssured === undefined && c.saMin !== undefined && (
                    <label className="flex items-center gap-2">
                      <span className="sr-only">ทุนของ{c.name}</span>
                      <MoneyInput
                        className={`w-32 ${control}`} value={picked.sumAssured ?? ""} max={c.saMax}
                        onChange={(v) => amend(c.code, { sumAssured: v })}
                      />
                      <span className="whitespace-nowrap text-xs tabular-nums text-[var(--lg-mute)]">
                        {range(c)}
                      </span>
                    </label>
                  )}
                </div>
              );
            })}
            {/* the figures, not the pickers: a screen reader hears the new total when the
                answer lands, and hears it once, because the wait is announced by aria-busy */}
            <dl
              aria-live="polite"
              className="space-y-1.5 border-t border-[var(--lg-panel-line)] pt-3 text-sm"
            >
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
                <dt className="text-[var(--lg-white)]">เบี้ยรวม {PAY_MODE_LABEL[mode]}</dt>
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
