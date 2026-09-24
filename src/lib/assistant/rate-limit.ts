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

/**
 * Who is asking, for the limits above. On Vercel x-real-ip is set by the platform from the
 * connection itself; x-forwarded-for may carry whatever the caller wrote before the platform
 * appended the real address, so only its first entry is used, and only when x-real-ip is
 * missing. A limiter keyed on a header the caller controls limits nobody — which is why the
 * content ceiling's reservations, not this, are the real stop on spending.
 */
export function clientIp(h: { get(name: string): string | null }): string {
  const real = h.get("x-real-ip")?.trim();
  if (real) return real;
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}
