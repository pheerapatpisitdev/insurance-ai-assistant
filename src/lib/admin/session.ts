import { cookies } from "next/headers";
import { createHmac, timingSafeEqual, randomBytes } from "node:crypto";

const COOKIE = "ins_admin";
const TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

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
