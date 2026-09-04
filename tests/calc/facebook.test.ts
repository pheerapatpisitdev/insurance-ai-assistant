import { describe, it, expect, beforeEach, afterEach } from "vitest";
import crypto from "crypto";
import { verifySignature, verifyTokenMatches, hashUserId } from "@/lib/facebook/verify";
import { toParts } from "@/lib/facebook/client";
import { facebookStatus } from "@/lib/facebook/status";

const SECRET = "test-app-secret";

describe("webhook signature", () => {
  beforeEach(() => { process.env.FB_APP_SECRET = SECRET; });
  afterEach(() => { delete process.env.FB_APP_SECRET; });

  const sign = (body: string, secret = SECRET) =>
    `sha256=${crypto.createHmac("sha256", secret).update(body).digest("hex")}`;

  it("accepts a body Meta signed", () => {
    const body = '{"object":"page","entry":[]}';
    expect(verifySignature(body, sign(body))).toBe(true);
  });

  it("rejects a body that was altered after signing", () => {
    expect(verifySignature('{"object":"page","entry":[1]}', sign('{"object":"page","entry":[]}'))).toBe(false);
  });

  it("rejects a signature made with someone else's app secret", () => {
    const body = '{"object":"page"}';
    expect(verifySignature(body, sign(body, "not-our-secret"))).toBe(false);
  });

  it("rejects a signature that is not sha256", () => {
    const body = '{"object":"page"}';
    const sha1 = `sha1=${crypto.createHmac("sha1", SECRET).update(body).digest("hex")}`;
    expect(verifySignature(body, sha1)).toBe(false);
  });

  it("rejects a request with no signature at all", () => {
    expect(verifySignature('{"object":"page"}', null)).toBe(false);
  });

  it("rejects everything when the app secret is missing, rather than letting requests through", () => {
    const body = '{"object":"page"}';
    const signature = sign(body);
    delete process.env.FB_APP_SECRET;
    expect(verifySignature(body, signature)).toBe(false);
  });
});

describe("the challenge Meta sends when the webhook is set", () => {
  beforeEach(() => { process.env.FB_VERIFY_TOKEN = "our-verify-token"; });
  afterEach(() => { delete process.env.FB_VERIFY_TOKEN; });

  it("accepts the token we chose", () => {
    expect(verifyTokenMatches("our-verify-token")).toBe(true);
  });

  it("refuses any other token", () => {
    expect(verifyTokenMatches("someone-elses-token")).toBe(false);
    expect(verifyTokenMatches("our-verify-token-plus")).toBe(false);
    expect(verifyTokenMatches(null)).toBe(false);
  });

  it("refuses everything when no token is configured", () => {
    delete process.env.FB_VERIFY_TOKEN;
    expect(verifyTokenMatches("our-verify-token")).toBe(false);
  });
});

describe("page-scoped id hashing", () => {
  beforeEach(() => { process.env.FB_APP_SECRET = SECRET; });
  afterEach(() => { delete process.env.FB_APP_SECRET; });

  it("gives the same person the same hash, so a conversation continues", () => {
    expect(hashUserId("7654321")).toBe(hashUserId("7654321"));
  });

  it("does not keep the id anywhere in the hash", () => {
    expect(hashUserId("7654321")).not.toContain("7654321");
  });

  it("separates two people", () => {
    expect(hashUserId("7654321")).not.toBe(hashUserId("1234567"));
  });
});

describe("splitting an answer into Messenger messages", () => {
  it("leaves a short answer as one message", () => {
    expect(toParts("สวัสดีครับ")).toEqual(["สวัสดีครับ"]);
  });

  it("splits on blank lines so a quote does not break mid-table", () => {
    const text = `${"ก".repeat(1500)}\n\n${"ข".repeat(800)}`;
    expect(toParts(text)).toEqual(["ก".repeat(1500), "ข".repeat(800)]);
  });

  it("hard-wraps a single paragraph too long for one message", () => {
    const parts = toParts("ค".repeat(5000));
    expect(parts).toHaveLength(3);
    for (const p of parts) expect(p.length).toBeLessThanOrEqual(1900);
  });

  it("never sends more messages than one answer should take", () => {
    expect(toParts("ง".repeat(100_000)).length).toBeLessThanOrEqual(5);
  });

  it("keeps every character of an answer that fits", () => {
    const text = `${"จ".repeat(1200)}\n\n${"ฉ".repeat(600)}`;
    expect(toParts(text).join("\n\n")).toBe(text);
  });
});

describe("page status", () => {
  const real = globalThis.fetch;
  beforeEach(() => { process.env.FB_PAGE_ACCESS_TOKEN = "page-token"; });
  afterEach(() => {
    delete process.env.FB_PAGE_ACCESS_TOKEN;
    globalThis.fetch = real;
  });

  /** answers each Graph path from a table: a body for success, a [code, message] for a refusal */
  function graph(routes: Record<string, unknown | [number, string]>) {
    globalThis.fetch = (async (url: string | URL) => {
      const path = new URL(String(url)).pathname.replace("/v23.0", "");
      const hit = routes[path];
      if (Array.isArray(hit)) {
        const [code, message] = hit as [number, string];
        return new Response(JSON.stringify({ error: { code, message } }), { status: 400 });
      }
      return new Response(JSON.stringify(hit ?? {}), { status: 200 });
    }) as typeof fetch;
  }

  it("says so when no token is configured", async () => {
    delete process.env.FB_PAGE_ACCESS_TOKEN;
    const status = await facebookStatus();
    expect(status.configured).toBe(false);
    expect(status.errors).toHaveLength(1);
  });

  it("reports a messaging-only token as working, with notes rather than errors", async () => {
    graph({
      "/me/messenger_profile": { data: [] },
      "/me": [100, "Object does not exist, cannot be loaded due to missing permission"],
      "/me/subscribed_apps": [200, "Requires pages_manage_metadata permission"],
    });
    const status = await facebookStatus();
    expect(status.messagingOk).toBe(true);
    expect(status.errors).toEqual([]);
    expect(status.notes).toHaveLength(2);
    expect(status.notes.join(" ")).toContain("ไม่กระทบการตอบข้อความ");
  });

  it("reports an expired token as an error that names the fix", async () => {
    graph({
      "/me/messenger_profile": [190, "Error validating access token: Session has expired"],
      "/me": [190, "Error validating access token: Session has expired"],
      "/me/subscribed_apps": [190, "Error validating access token: Session has expired"],
    });
    const status = await facebookStatus();
    expect(status.messagingOk).toBe(false);
    expect(status.errors[0]).toContain("ต้องออกใหม่");
    expect(status.notes).toEqual([]);
  });

  it("reads the page and its subscription when the token carries the permissions", async () => {
    graph({
      "/me/messenger_profile": { data: [] },
      "/me": { id: "123", name: "Ai chet" },
      "/me/subscribed_apps": { data: [{ name: "app", subscribed_fields: ["messages"] }] },
    });
    const status = await facebookStatus();
    expect(status.pageName).toBe("Ai chet");
    expect(status.pageId).toBe("123");
    expect(status.subscribed).toBe(true);
    expect(status.fields).toEqual(["messages"]);
    expect(status.notes).toEqual([]);
    expect(status.errors).toEqual([]);
  });
});
