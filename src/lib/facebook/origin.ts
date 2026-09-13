/**
 * The address the browser actually used. Behind Vercel the request URL carries the internal
 * host, and Meta compares the redirect URI it is given against its allow-list character for
 * character — so the forwarded headers are what count.
 */
export function requestOrigin(req: Request): string {
  const h = req.headers;
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) return new URL(req.url).origin;
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
