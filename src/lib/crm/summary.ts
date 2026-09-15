import { UNDECIDED, type ConversationRow, type Counts, type Range, type Summary } from "./types";

/**
 * Every figure the report shows, as a function of the rows behind it.
 *
 * No database, no clock of its own, no React. A wrong number is caught here by a test rather
 * than by someone looking at a chart and thinking it seems about right — which, for a page
 * whose whole purpose is telling the owner where money is going, it always would.
 */

/** Days a range looks back over, and how many bars its daily chart therefore has. */
const DAYS: Record<Range, number> = { today: 1, "7d": 7, "30d": 30 };

/** Midnight at the start of the day `d` falls in, in the machine's own timezone. */
function midnight(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * Where a range begins.
 *
 * "Today" means since this morning rather than the last twenty-four hours: an owner opening
 * the page at nine wants to know about today, not about yesterday afternoon.
 */
export function rangeStart(range: Range, now: Date = new Date()): Date {
  const start = midnight(now);
  start.setDate(start.getDate() - (DAYS[range] - 1));
  return start;
}

/** A local calendar day as `YYYY-MM-DD`, which `toISOString` would shift by the offset. */
function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function empty(): Counts {
  return { arrived: 0, told: 0, priced: 0, interested: 0, formDone: 0, stalled: 0, agentReplied: 0 };
}

/**
 * Add one conversation to a tally.
 *
 * `told` is the one that is not simply a milestone: it asks whether the bot got anywhere at
 * all, and the evidence for that is a second message. Someone who wrote once and left is an
 * arrival and nothing more, which is exactly the gap the funnel is drawn to show.
 */
function add(into: Counts, row: ConversationRow): void {
  into.arrived += 1;
  if ((row.messages ?? 0) >= 2) into.told += 1;
  if (row.priced_at) into.priced += 1;
  if (row.handover_at) into.interested += 1;
  if (row.form_done_at) into.formDone += 1;
  if (row.stalled_at) into.stalled += 1;
  if (row.agent_replied_at) into.agentReplied += 1;
}

export function summarise(
  conversations: ConversationRow[],
  range: Range,
  now: Date = new Date(),
): Summary {
  const start = rangeStart(range, now);
  const rows = conversations.filter((r) => new Date(r.started_at) >= start);

  const counts = empty();
  const products = new Map<string, Counts>();
  const ads = new Map<string, { arrived: number; interested: number }>();

  // one slot per day of the range and one per hour of the clock, filled with zero first, so a
  // quiet Tuesday is a gap in the chart rather than a day the chart forgets to draw
  const days = new Map<string, { date: string; arrived: number; priced: number; interested: number }>();
  for (let i = 0; i < DAYS[range]; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    days.set(dayKey(d), { date: dayKey(d), arrived: 0, priced: 0, interested: 0 });
  }
  const hours = Array.from({ length: 24 }, (_, hour) => ({ hour, arrived: 0 }));

  for (const row of rows) {
    add(counts, row);

    const product = row.product ?? UNDECIDED;
    if (!products.has(product)) products.set(product, empty());
    add(products.get(product)!, row);

    const at = new Date(row.started_at);
    const day = days.get(dayKey(at));
    if (day) {
      day.arrived += 1;
      if (row.priced_at) day.priced += 1;
      if (row.handover_at) day.interested += 1;
    }
    hours[at.getHours()].arrived += 1;

    if (row.ad_id) {
      const ad = ads.get(row.ad_id) ?? { arrived: 0, interested: 0 };
      ad.arrived += 1;
      if (row.handover_at) ad.interested += 1;
      ads.set(row.ad_id, ad);
    }
  }

  return {
    counts,
    byProduct: [...products.entries()]
      .map(([product, c]) => ({ product, counts: c }))
      .sort((a, b) => b.counts.arrived - a.counts.arrived),
    byDay: [...days.values()],
    byHour: hours,
    byAd: [...ads.entries()]
      .map(([adId, c]) => ({ adId, ...c }))
      .sort((a, b) => b.arrived - a.arrived),
  };
}

/** What share of `whole` `part` is, as a whole percent — and zero rather than NaN on nothing. */
export function share(part: number, whole: number): number {
  return whole === 0 ? 0 : Math.round((part / whole) * 100);
}
