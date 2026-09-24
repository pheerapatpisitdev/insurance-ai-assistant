"use client";
import { useEffect, useMemo, useState } from "react";
import { dayKey, repeats, weekDays, weekLabel, weekStart } from "@/lib/content/calendar";
import { defaultPoster, posterUrl } from "@/lib/content/poster";
import { publishView } from "@/lib/content/publish-label";
import type { ContentItem } from "@/lib/content/store";
import { publishedBetween } from "./publish";

/**
 * The week on the Page: what went up and what Facebook is holding, day by day.
 *
 * A list of seven days rather than a grid of seven columns, so it reads the same in the middle
 * column and on a phone. An empty day says so — the gaps are the point of looking — and a post
 * about the same plan as the one before it is marked, because a follower reads that as the
 * Page repeating itself. Only pieces sent from this page are here; a post typed straight into
 * Facebook is not.
 */

const WEEK_MS = 7 * 24 * 60 * 60_000;

interface Props {
  nameOf: (planHref: string) => string;
  onOpen: (item: ContentItem) => void;
  /** bumped by the page when something was posted or taken back, to read the week again */
  refresh: number;
}

const time = (d: Date) => d.toLocaleTimeString("th-TH", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit" });

export function CalendarView({ nameOf, onOpen, refresh }: Props) {
  const [start, setStart] = useState(() => weekStart(new Date()));
  const [items, setItems] = useState<ContentItem[] | null>(null);

  useEffect(() => {
    let live = true;
    setItems(null);
    publishedBetween(start.toISOString(), new Date(start.getTime() + WEEK_MS).toISOString())
      .then((list) => { if (live) setItems(list); })
      .catch(() => { if (live) setItems([]); });
    return () => { live = false; };
  }, [start, refresh]);

  const days = weekDays(start);
  const today = dayKey(new Date());
  const dated = useMemo(
    () => (items ?? []).filter((i) => i.publish?.at).map((i) => ({ item: i, at: new Date(i.publish!.at!) })),
    [items],
  );
  const repeated = useMemo(() => repeats(dated.map((d) => ({ id: d.item.id, planHref: d.item.planHref, at: d.at }))), [dated]);
  const byDay = (key: string) => dated.filter((d) => dayKey(d.at) === key);
  const empty = days.filter((d) => byDay(d.key).length === 0).length;
  const held = dated.filter((d) => publishView(d.item.publish).kind === "scheduled").length;

  const nav = "rounded-lg border border-[var(--ct-line)] bg-[var(--ct-panel)] px-3 py-1.5 text-sm hover:bg-[var(--ct-soft)]";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setStart((s) => new Date(s.getTime() - WEEK_MS))} className={nav} aria-label="สัปดาห์ก่อน">‹</button>
        <p className="min-w-40 text-center text-sm font-medium">{weekLabel(start)}</p>
        <button type="button" onClick={() => setStart((s) => new Date(s.getTime() + WEEK_MS))} className={nav} aria-label="สัปดาห์หน้า">›</button>
        <button type="button" onClick={() => setStart(weekStart(new Date()))} className={nav}>สัปดาห์นี้</button>
      </div>

      {items === null ? (
        <p className="text-sm text-[var(--ct-mute)]">กำลังโหลด…</p>
      ) : (
        <>
          <p className="text-xs text-[var(--ct-mute)]">
            ลงเพจ {dated.length - held} · ตั้งเวลาไว้ {held} · ว่าง {empty} วัน — นับเฉพาะชิ้นที่ส่งจากหน้านี้
          </p>
          <ol className="divide-y divide-[var(--ct-hair)] overflow-hidden rounded-xl border border-[var(--ct-hair)] bg-[var(--ct-panel)]">
            {days.map((d) => {
              const list = byDay(d.key);
              return (
                <li key={d.key} className="flex gap-3 px-3 py-2.5">
                  <p className={`w-20 shrink-0 pt-0.5 text-sm ${d.key === today ? "font-semibold text-[var(--ct-accent)]" : ""}`}>
                    {d.label}{d.key === today && <span className="block text-xs font-normal">วันนี้</span>}
                  </p>
                  {list.length === 0 ? (
                    <p className="pt-0.5 text-sm text-[var(--ct-mute)]">ว่าง</p>
                  ) : (
                    <ul className="min-w-0 flex-1 space-y-2">
                      {list.map(({ item, at }) => {
                        const held = publishView(item.publish).kind === "scheduled";
                        return (
                          <li key={item.id}>
                            <button type="button" onClick={() => onOpen(item)} className="flex w-full items-start gap-2.5 rounded-lg text-left hover:bg-[var(--ct-ground)]">
                              {/* eslint-disable-next-line @next/next/no-img-element -- the piece's own poster, from the browser cache */}
                              <img
                                src={posterUrl(item.output.poster ?? defaultPoster(item.output.hooks[0], nameOf(item.planHref)))}
                                alt="" loading="lazy"
                                className="size-12 shrink-0 rounded-md border border-[var(--ct-hair)] bg-[var(--ct-ground)] object-cover"
                              />
                              <span className="min-w-0">
                                <span className="block text-xs text-[var(--ct-mute)]">
                                  {held ? "⏰" : "✓"} {time(at)} · {nameOf(item.planHref)}
                                </span>
                                <span className="line-clamp-1 text-sm">{item.output.hooks[0]}</span>
                                {repeated.has(item.id) && (
                                  <span className="block text-xs text-[var(--ct-alert)]">แบบประกันเดียวกับโพสต์ก่อนหน้า — ลองสลับแบบอื่นคั่น</span>
                                )}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </li>
              );
            })}
          </ol>
        </>
      )}
    </div>
  );
}
