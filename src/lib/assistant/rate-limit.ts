/**
 * A small in-process limit so one visitor cannot spend the month's AI budget in an afternoon.
 * It resets when the server restarts, which is fine: the monthly budget stop in the AI client
 * is the real ceiling, and this only smooths out bursts.
 */

/** A limit of its own: at most `max` calls per caller in any `windowMs`. */
export function limiter(max: number, windowMs: number): (key: string, now?: number) => boolean {
  const hits = new Map<string, number[]>();
  return (key, now = Date.now()) => {
    const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
    if (recent.length >= max) {
      hits.set(key, recent);
      return false;
    }
    recent.push(now);
    hits.set(key, recent);
    if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < windowMs)) hits.delete(k);
    return true;
  };
}

/** the chat's limit: eight a minute, which no person reaches and a script does at once */
export const allow = limiter(8, 60_000);
