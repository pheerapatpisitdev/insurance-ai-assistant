import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * The PIN that stands between the content page and the Facebook Page.
 *
 * The workbench is open to anyone who finds it — the owner chose that — but posting speaks as
 * the agency in public, so that one act asks for a PIN. Entered once, the browser keeps a
 * cookie for thirty days. The cookie is a keyed hash of the PIN, not the PIN: changing
 * CONTENT_PUBLISH_PIN turns every browser away until it is entered again.
 */

export const PIN_COOKIE = "content-publish";
export const PIN_DAYS = 30;

/** The PIN set for this deployment, or null when none is (and nobody can post). */
export function publishPin(): string | null {
  const pin = process.env.CONTENT_PUBLISH_PIN?.trim();
  return pin && /^\d{4,8}$/.test(pin) ? pin : null;
}

function key(): string {
  const s = process.env.ADMIN_SESSION_SECRET;
  if (!s) throw new Error("ยังไม่ได้ตั้งค่า ADMIN_SESSION_SECRET");
  return s;
}

export function pinToken(pin: string): string {
  return createHmac("sha256", key()).update(`content-publish:${pin}`).digest("base64url");
}

function same(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Whether a typed PIN is the one set; compared as hashes so the length leaks nothing. */
export function pinMatches(given: string): boolean {
  const pin = publishPin();
  return !!pin && same(pinToken(given.trim()), pinToken(pin));
}

/** Whether a browser's cookie still opens posting. */
export function cookieOpens(value: string | undefined): boolean {
  const pin = publishPin();
  return !!pin && !!value && same(value, pinToken(pin));
}
