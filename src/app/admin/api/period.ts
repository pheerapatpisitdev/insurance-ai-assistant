/**
 * The month a key's counter belongs to, and what "ใช้เดือนนี้" should say about it.
 *
 * The counter is only reset when a key is next used: the database sees a stored `period` that
 * is not this month, zeroes the count and moves the period on (ins_api_client_use). A key nobody has called since
 * August therefore still carries August's number, and the table printed it under
 * "ใช้เดือนนี้" — a key idle all month looking busy, and on a quota key, looking nearly used
 * up.
 *
 * "This month" is the month the database counts in, which is UTC (`to_char(now() at time
 * zone 'utc', 'YYYY-MM')` in 20260917_api_clients.sql), not Bangkok's. For seven hours at the
 * turn of each month the two disagree, and in those hours only the database's clock tells the
 * truth about how much quota is left — a Bangkok month here would show 0 for calls that
 * the quota is still counting.
 */
export function currentPeriod(now: Date = new Date()): string {
  return now.toISOString().slice(0, 7);
}

export function usedThisMonth(used: number | null | undefined, period: string | null | undefined, now: Date = new Date()): number {
  return period === currentPeriod(now) ? used ?? 0 : 0;
}
