import crypto from "crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { toParts } from "@/lib/facebook/client";
import { agentTyped, eventKey, textOf, type Messaging } from "@/lib/facebook/events";
import { hashUserId, verifySignature, verifyTokenMatches } from "@/lib/facebook/verify";

const SECRET = "test-app-secret";

beforeEach(() => {
  process.env.FB_APP_SECRET = SECRET;
  process.env.FB_VERIFY_TOKEN = "test-verify";
  process.env.FB_APP_ID = "1624098972401227";
});
afterEach(() => {
  delete process.env.FB_APP_SECRET;
  delete process.env.FB_VERIFY_TOKEN;
  delete process.env.FB_APP_ID;
});

const sign = (body: string) => "sha256=" + crypto.createHmac("sha256", SECRET).update(body).digest("hex");

describe("what Meta sends", () => {
  it("accepts a body signed with the app secret", () => {
    const body = JSON.stringify({ object: "page" });
    expect(verifySignature(body, sign(body))).toBe(true);
  });

  it("refuses a body that was changed after signing", () => {
    const body = JSON.stringify({ object: "page" });
    expect(verifySignature(body + " ", sign(body))).toBe(false);
  });

  it("refuses a request carrying no signature at all", () => {
    expect(verifySignature("{}", null)).toBe(false);
  });

  it("echoes the challenge only for the token we chose", () => {
    expect(verifyTokenMatches("test-verify")).toBe(true);
    expect(verifyTokenMatches("something-else")).toBe(false);
    expect(verifyTokenMatches(null)).toBe(false);
  });

  it("hashes a page-scoped id to something stable and unrecognisable", () => {
    const hash = hashUserId("psid-123");
    expect(hash).toBe(hashUserId("psid-123"));
    expect(hash).not.toContain("psid-123");
  });
});

describe("reading an event", () => {
  it("takes a typed message as the customer's words", () => {
    expect(textOf({ message: { text: "  สนใจครับ  " } })).toBe("สนใจครับ");
  });

  it("takes a tapped button as the customer's words too", () => {
    expect(textOf({ postback: { title: "ขอเบี้ยประกัน" } })).toBe("ขอเบี้ยประกัน");
  });

  it("does not take the page's own message as the customer's words", () => {
    expect(textOf({ message: { text: "สวัสดีครับ", is_echo: true } })).toBe("");
  });

  it("recognises a redelivery by the message id", () => {
    expect(eventKey({ message: { mid: "m-1", text: "hi" } })).toBe("m-1");
    expect(eventKey({ sender: { id: "p" }, timestamp: 7, postback: { title: "hi" } })).toBe("pb:p:7");
  });
});

describe("telling the agent's message from the bot's", () => {
  it("counts an echo with no app id as the agent typing in the inbox", () => {
    const event: Messaging = { message: { mid: "m", text: "เดี๋ยวโทรหานะครับ", is_echo: true } };
    expect(agentTyped(event)).toBe(true);
  });

  it("does not count the bot's own echo", () => {
    const event: Messaging = { message: { mid: "m", text: "เบี้ย…", is_echo: true, app_id: 1624098972401227 } };
    expect(agentTyped(event)).toBe(false);
  });

  it("does not count a message the customer sent", () => {
    expect(agentTyped({ message: { mid: "m", text: "สนใจครับ" } })).toBe(false);
  });
});

describe("a long answer", () => {
  it("is split on blank lines, never mid-paragraph, while it can be", () => {
    const para = "ก".repeat(900);
    const parts = toParts([para, para, para].join("\n\n"));
    expect(parts).toHaveLength(2);
    expect(parts[0]).toBe([para, para].join("\n\n"));
  });

  it("hard-wraps a paragraph Messenger would refuse on its own", () => {
    const parts = toParts("ก".repeat(4000));
    expect(parts.every((p) => p.length <= 1900)).toBe(true);
  });
});
