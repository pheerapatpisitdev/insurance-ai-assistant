import { describe, it, expect, beforeEach, afterEach } from "vitest";
import crypto from "crypto";
import { verifySignature, verifyTokenMatches, hashUserId } from "@/lib/facebook/verify";
import { toParts } from "@/lib/facebook/client";
import { facebookStatus } from "@/lib/facebook/status";
import { forgetCachedToken } from "@/lib/facebook/connection";
import { authorizeUrl, makeState, redirectUri, stateIsValid } from "@/lib/facebook/oauth";
import { requestOrigin } from "@/lib/facebook/origin";
import { eventKey, textOf } from "@/lib/facebook/events";
import { normaliseProfile, profileBody } from "@/lib/facebook/profile";

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
  beforeEach(() => {
    process.env.FB_PAGE_ACCESS_TOKEN = "page-token";
    forgetCachedToken();
  });
  afterEach(() => {
    delete process.env.FB_PAGE_ACCESS_TOKEN;
    forgetCachedToken();
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
    forgetCachedToken();
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

describe("connect flow", () => {
  beforeEach(() => {
    process.env.ADMIN_SESSION_SECRET = "state-secret";
    process.env.FB_APP_ID = "1234567890";
    delete process.env.FB_LOGIN_CONFIG_ID;
  });
  afterEach(() => {
    delete process.env.ADMIN_SESSION_SECRET;
    delete process.env.FB_APP_ID;
    delete process.env.FB_LOGIN_CONFIG_ID;
  });

  it("accepts the state it just signed", () => {
    expect(stateIsValid(makeState())).toBe(true);
  });

  it("rejects a state signed with someone else's secret", () => {
    const state = makeState();
    process.env.ADMIN_SESSION_SECRET = "another-secret";
    expect(stateIsValid(state)).toBe(false);
  });

  it("rejects a state that has expired", () => {
    const [, nonce, mac] = makeState().split(".");
    expect(stateIsValid(`${Date.now() - 1000}.${nonce}.${mac}`)).toBe(false);
  });

  it("rejects a missing or malformed state", () => {
    expect(stateIsValid(null)).toBe(false);
    expect(stateIsValid("nonsense")).toBe(false);
  });

  it("asks Meta for exactly the permissions the bot needs", () => {
    const url = new URL(authorizeUrl("https://www.advisortool.app", makeState()));
    expect(url.searchParams.get("scope")).toBe("pages_show_list,pages_messaging,pages_manage_metadata");
    expect(url.searchParams.get("redirect_uri")).toBe("https://www.advisortool.app/api/facebook/connect/callback");
    expect(url.searchParams.get("client_id")).toBe("1234567890");
  });

  it("uses the login configuration instead of a scope list when one is set", () => {
    process.env.FB_LOGIN_CONFIG_ID = "1600660545122340";
    const url = new URL(authorizeUrl("https://www.advisortool.app", makeState()));
    expect(url.searchParams.get("config_id")).toBe("1600660545122340");
    expect(url.searchParams.get("override_default_response_type")).toBe("true");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.has("scope")).toBe(false);
  });

  it("builds the redirect URI from the address the browser used, not the internal host", () => {
    const req = new Request("https://internal.vercel.app/api/facebook/connect", {
      headers: { "x-forwarded-host": "www.advisortool.app", "x-forwarded-proto": "https" },
    });
    expect(redirectUri(requestOrigin(req))).toBe("https://www.advisortool.app/api/facebook/connect/callback");
  });

  it("falls back to the request host when nothing is forwarded", () => {
    const req = new Request("http://localhost:3000/api/facebook/connect");
    expect(requestOrigin(req)).toBe("http://localhost:3000");
  });
});

describe("what a webhook event says", () => {
  it("reads a typed message", () => {
    expect(textOf({ message: { mid: "m1", text: "  มรดก 3 ล้าน  " } })).toBe("มรดก 3 ล้าน");
  });

  it("reads a tapped ice breaker as the question that was tapped", () => {
    expect(textOf({ postback: { title: "มรดก 3 ล้าน เบี้ยเท่าไหร่", payload: "มรดก 3 ล้าน เบี้ยเท่าไหร่" } }))
      .toBe("มรดก 3 ล้าน เบี้ยเท่าไหร่");
  });

  it("says nothing for the page's own echo, an image, or a read receipt", () => {
    expect(textOf({ message: { mid: "m1", text: "hi", is_echo: true } })).toBe("");
    expect(textOf({ message: { mid: "m2" } })).toBe("");
    expect(textOf({})).toBe("");
  });

  it("keys a message by its id and a postback by sender and moment", () => {
    expect(eventKey({ message: { mid: "m1", text: "x" } })).toBe("m1");
    expect(eventKey({ sender: { id: "42" }, timestamp: 1700000000000, postback: { title: "x" } })).toBe("pb:42:1700000000000");
    expect(eventKey({ postback: { title: "x" } })).toBeUndefined();
  });
});

describe("messenger profile", () => {
  it("drops blank questions and trims the rest", () => {
    const p = normaliseProfile({ greeting: " สวัสดี ", questions: ["", " ก ", "ข", ""] });
    expect(p).toEqual({ greeting: "สวัสดี", questions: ["ก", "ข"] });
  });

  it("refuses more than four questions or one that is too long", () => {
    expect(() => normaliseProfile({ greeting: "", questions: ["1", "2", "3", "4", "5"] })).toThrow("4");
    expect(() => normaliseProfile({ greeting: "", questions: ["ก".repeat(81)] })).toThrow("80");
  });

  it("sends each question as its own payload, so a tap reads like a typed message", () => {
    const body = profileBody({ greeting: "สวัสดี", questions: ["มรดก 3 ล้าน เบี้ยเท่าไหร่"] }) as {
      greeting: { locale: string; text: string }[];
      ice_breakers: { locale: string; call_to_actions: { question: string; payload: string }[] }[];
    };
    expect(body.greeting).toEqual([{ locale: "default", text: "สวัสดี" }]);
    expect(body.ice_breakers[0].call_to_actions).toEqual([
      { question: "มรดก 3 ล้าน เบี้ยเท่าไหร่", payload: "มรดก 3 ล้าน เบี้ยเท่าไหร่" },
    ]);
  });

  it("leaves out what is empty rather than sending an empty list", () => {
    expect(profileBody({ greeting: "", questions: [] })).toEqual({});
  });
});
