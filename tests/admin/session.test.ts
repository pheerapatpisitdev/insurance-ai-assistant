import { describe, it, expect, beforeEach, vi } from "vitest";
import { createHmac } from "node:crypto";

/** A minimal cookie jar standing in for Next's cookies() during these tests. */
const jar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { value: jar.get(name) } : undefined),
    set: (name: string, value: string) => void jar.set(name, value),
    delete: (name: string) => void jar.delete(name),
  }),
}));

const SECRET = "test-secret";
process.env.ADMIN_SESSION_SECRET = SECRET;
process.env.ADMIN_PIN = "123456";

const { isSignedIn, startSession, endSession, pinMatches, pinIsConfigured } = await import("@/lib/admin/session");

const cookieFor = (expires: number, nonce = "abc") =>
  `${expires}.${nonce}.${createHmac("sha256", SECRET).update(`${expires}.${nonce}`).digest("hex")}`;

describe("admin session cookie", () => {
  beforeEach(() => jar.clear());

  it("accepts a cookie it just issued", async () => {
    await startSession();
    expect(await isSignedIn()).toBe(true);
  });

  it("rejects a missing cookie", async () => {
    expect(await isSignedIn()).toBe(false);
  });

  it("rejects an expired cookie", async () => {
    jar.set("ins_admin", cookieFor(Date.now() - 1000));
    expect(await isSignedIn()).toBe(false);
  });

  it("rejects a tampered signature", async () => {
    const good = cookieFor(Date.now() + 60_000);
    jar.set("ins_admin", good.slice(0, -1) + (good.endsWith("a") ? "b" : "a"));
    expect(await isSignedIn()).toBe(false);
  });

  it("rejects a cookie signed with another secret", async () => {
    const expires = Date.now() + 60_000;
    const mac = createHmac("sha256", "other").update(`${expires}.abc`).digest("hex");
    jar.set("ins_admin", `${expires}.abc.${mac}`);
    expect(await isSignedIn()).toBe(false);
  });

  it("rejects a cookie whose expiry was pushed out without re-signing", async () => {
    const parts = cookieFor(Date.now() + 60_000).split(".");
    jar.set("ins_admin", `${Date.now() + 999_999_999}.${parts[1]}.${parts[2]}`);
    expect(await isSignedIn()).toBe(false);
  });

  it("rejects malformed values", async () => {
    for (const bad of ["", "x", "1.2", "a.b.c.d"]) {
      jar.set("ins_admin", bad);
      expect(await isSignedIn(), bad).toBe(false);
    }
  });

  it("signing out clears the cookie", async () => {
    await startSession();
    await endSession();
    expect(await isSignedIn()).toBe(false);
  });
});

describe("PIN check", () => {
  it("matches only the exact PIN", () => {
    expect(pinMatches("123456")).toBe(true);
    expect(pinMatches("123457")).toBe(false);
    expect(pinMatches("12345")).toBe(false);
    expect(pinMatches("1234567")).toBe(false);
    expect(pinMatches("")).toBe(false);
  });

  it("reports whether the PIN and secret are configured", () => {
    expect(pinIsConfigured()).toBe(true);
  });
});
