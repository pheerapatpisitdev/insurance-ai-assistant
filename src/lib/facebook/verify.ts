import crypto from "crypto";

/**
 * Meta signs every webhook body with the app secret. Anyone can POST to a public URL, so an
 * unsigned or wrongly signed request is not from Meta and must be refused.
 */
export function verifySignature(rawBody: string, header: string | null): boolean {
  const secret = process.env.FB_APP_SECRET;
  if (!secret || !header?.startsWith("sha256=")) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(header.slice("sha256=".length));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/**
 * Meta proves it owns the webhook by echoing a challenge back, but only after we confirm the
 * token it sends is the one we chose. Compared in constant time, like any other secret.
 */
export function verifyTokenMatches(token: string | null): boolean {
  const expected = process.env.FB_VERIFY_TOKEN;
  if (!expected || !token) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(token);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/**
 * A page-scoped id identifies a person, so it is never stored as given. The hash is stable
 * for the same person, which is all a conversation needs, and useless to anyone reading the
 * table without the secret.
 */
export function hashUserId(psid: string): string {
  const secret = process.env.FB_APP_SECRET ?? "";
  return crypto.createHmac("sha256", secret).update(psid).digest("hex");
}
