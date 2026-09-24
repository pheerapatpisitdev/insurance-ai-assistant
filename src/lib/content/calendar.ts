/**
 * The content calendar's week, worked out in Thailand's time.
 *
 * Thailand keeps UTC+7 all year, so a day there is a fixed seven hours off UTC and a week can
 * be cut without a time-zone library. The week runs Monday to Sunday, the way a Thai wall
 * calendar and Meta Business Suite's planner both lay it out.
 */

const BKK_MS = 7 * 60 * 60_000;
const DAY_MS = 24 * 60 * 60_000;

const DAY_NAME = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];
const MONTH = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

export interface Day {
  /** "2026-09-25", Thailand's date */
  key: string;
  /** "พฤ. 25 ก.ย." */
  label: string;
  from: Date;
  to: Date;
}

/** Midnight in Thailand at the Monday on or before `d`. */
export function weekStart(d: Date): Date {
  const local = new Date(d.getTime() + BKK_MS);
  const back = (local.getUTCDay() + 6) % 7; // Monday → 0
  const midnight = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() - back);
  return new Date(midnight - BKK_MS);
}

export function weekDays(start: Date): Day[] {
  return Array.from({ length: 7 }, (_, i) => {
    const from = new Date(start.getTime() + i * DAY_MS);
    const local = new Date(from.getTime() + BKK_MS);
    return {
      key: local.toISOString().slice(0, 10),
      label: `${DAY_NAME[local.getUTCDay()]} ${local.getUTCDate()} ${MONTH[local.getUTCMonth()]}`,
      from,
      to: new Date(from.getTime() + DAY_MS),
    };
  });
}

/** "25 ก.ย. – 1 ต.ค." for the heading */
export function weekLabel(start: Date): string {
  const days = weekDays(start);
  const cut = (d: Day) => d.label.split(" ").slice(1).join(" ");
  return `${cut(days[0])} – ${cut(days[6])}`;
}

/** Thailand's date of a moment, as a Day key. */
export function dayKey(d: Date): string {
  return new Date(d.getTime() + BKK_MS).toISOString().slice(0, 10);
}

interface Dated {
  id: string;
  planHref: string;
  at: Date;
}

/**
 * The pieces that follow one about the same plan, in time order — the same product twice in a
 * row reads to a follower as the Page having nothing else to say.
 */
export function repeats(list: Dated[]): Set<string> {
  const sorted = [...list].sort((a, b) => a.at.getTime() - b.at.getTime());
  const out = new Set<string>();
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].planHref === sorted[i - 1].planHref) out.add(sorted[i].id);
  }
  return out;
}
