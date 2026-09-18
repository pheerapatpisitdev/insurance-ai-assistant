import { cookies } from "next/headers";
import { createHmac, timingSafeEqual, randomBytes } from "node:crypto";

const COOKIE = "ins_admin";

/**
 * How long a signed-in back office stays signed in.
 *
 * Twelve hours meant the owner typed the PIN most mornings, and the logs show what that cost:
 * three people met an expired session nine times in two days, on a phone, in the middle of
 * doing something. The session cannot be renewed as it is used — a cookie may only be set in
 * an action, and these are screens — so the honest choice is between asking often and asking
 * seldom. Two weeks, on a cookie that is http-only, same-site and secure, behind a PIN that
 * is not in the page: a stolen phone is the threat this length accepts, and a stolen phone
 * with the back office open was already that threat.
 */
const TTL_MS = 14 * 24 * 60 * 60 * 1000;

function secret(): string {
  const s = process.env.ADMIN_SESSION_SECRET;
  if (!s) throw new Error("ADMIN_SESSION_SECRET is not set");
  return s;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** True when the request carries a valid, unexpired admin cookie. */
export async function isSignedIn(): Promise<boolean> {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return false;
  const [expires, nonce, mac] = raw.split(".");
  if (!expires || !nonce || !mac) return false;
  if (!safeEqual(mac, sign(`${expires}.${nonce}`))) return false;
  return Number(expires) > Date.now();
}

export async function startSession(): Promise<void> {
  const expires = String(Date.now() + TTL_MS);
  const nonce = randomBytes(12).toString("hex");
  const value = `${expires}.${nonce}.${sign(`${expires}.${nonce}`)}`;
  (await cookies()).set(COOKIE, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: TTL_MS / 1000,
  });
}

export async function endSession(): Promise<void> {
  (await cookies()).delete(COOKIE);
}

/** Timing-safe check of the configured PIN. */
export function pinMatches(candidate: string): boolean {
  const expected = process.env.ADMIN_PIN;
  if (!expected) throw new Error("ADMIN_PIN is not set");
  return safeEqual(candidate, expected);
}

export function pinIsConfigured(): boolean {
  return Boolean(process.env.ADMIN_PIN && process.env.ADMIN_SESSION_SECRET);
}
