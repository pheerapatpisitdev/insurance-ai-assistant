/**
 * What day it is where the company is.
 *
 * Every rate table carries an `expiresOn` written as a Thai calendar date, and every table
 * builder compares today against it. `toISOString()` answers in UTC, which is seven hours
 * behind Bangkok: between midnight and seven in the morning of the day a table lapses, a
 * UTC comparison still calls it current and the pages go on quoting from it.
 *
 * The formatter is built once — constructing one is the expensive part, and this is called
 * on every request to six pages.
 */
const BANGKOK = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Bangkok",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Today in Bangkok as "YYYY-MM-DD", which is how every `expiresOn` is written. */
export function businessDate(today: Date): string {
  return BANGKOK.format(today);
}

/** Whether a rate table written to last until `expiresOn` has run out by now. */
export function hasExpired(today: Date, expiresOn: string): boolean {
  return businessDate(today) > expiresOn;
}

/**
 * How many days are left of a rate table, counted in Bangkok.
 *
 * Negative once it has lapsed, so a caller that wants "soon" and a caller that wants "gone"
 * both read the same number. Counted from the business date for the reason the whole file
 * exists: between midnight and seven, UTC is still on yesterday.
 */
export function daysUntil(today: Date, expiresOn: string): number {
  const from = Date.parse(`${businessDate(today)}T00:00:00Z`);
  const to = Date.parse(`${expiresOn}T00:00:00Z`);
  if (!Number.isFinite(from) || !Number.isFinite(to)) return 0;
  return Math.round((to - from) / 86_400_000);
}
