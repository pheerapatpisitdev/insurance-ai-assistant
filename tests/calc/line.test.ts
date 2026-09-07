import { describe, it, expect, beforeEach, afterEach } from "vitest";
import crypto from "crypto";
import { verifySignature, hashUserId } from "@/lib/line/verify";
import { toBubbles, toMessages } from "@/lib/line/client";

const SECRET = "test-channel-secret";

describe("webhook signature", () => {
  beforeEach(() => { process.env.LINE_CHANNEL_SECRET = SECRET; });
  afterEach(() => { delete process.env.LINE_CHANNEL_SECRET; });

  const sign = (body: string, secret = SECRET) =>
    crypto.createHmac("sha256", secret).update(body).digest("base64");

  it("accepts a body LINE signed", () => {
    const body = '{"events":[]}';
    expect(verifySignature(body, sign(body))).toBe(true);
  });

  it("rejects a body that was altered after signing", () => {
    const signature = sign('{"events":[]}');
    expect(verifySignature('{"events":[{"type":"message"}]}', signature)).toBe(false);
  });

  it("rejects a signature made with someone else's secret", () => {
    const body = '{"events":[]}';
    expect(verifySignature(body, sign(body, "not-our-secret"))).toBe(false);
  });

  it("rejects a request with no signature at all", () => {
    expect(verifySignature('{"events":[]}', null)).toBe(false);
  });

  it("rejects everything when the secret is missing, rather than letting requests through", () => {
    delete process.env.LINE_CHANNEL_SECRET;
    const body = '{"events":[]}';
    expect(verifySignature(body, sign(body))).toBe(false);
  });
});

describe("user id hashing", () => {
  beforeEach(() => { process.env.LINE_CHANNEL_SECRET = SECRET; });
  afterEach(() => { delete process.env.LINE_CHANNEL_SECRET; });

  it("gives the same user the same hash, so a conversation continues", () => {
    expect(hashUserId("U1234")).toBe(hashUserId("U1234"));
  });

  it("does not keep the LINE user id anywhere in the hash", () => {
    expect(hashUserId("U1234")).not.toContain("U1234");
  });

  it("separates two users", () => {
    expect(hashUserId("U1234")).not.toBe(hashUserId("U5678"));
  });
});

describe("splitting an answer into LINE bubbles", () => {
  it("leaves a short answer as one bubble", () => {
    expect(toBubbles("สวัสดีครับ")).toEqual([{ type: "text", text: "สวัสดีครับ" }]);
  });

  it("splits on blank lines so a quote does not break mid-table", () => {
    const text = `${"ก".repeat(4000)}\n\n${"ข".repeat(2000)}`;
    const bubbles = toBubbles(text);
    expect(bubbles).toHaveLength(2);
    expect(bubbles[0].text).toBe("ก".repeat(4000));
    expect(bubbles[1].text).toBe("ข".repeat(2000));
  });

  it("hard-wraps a single paragraph too long for one message", () => {
    const bubbles = toBubbles("ค".repeat(10_000));
    expect(bubbles).toHaveLength(3);
    for (const b of bubbles) expect(b.text.length).toBeLessThanOrEqual(4800);
  });

  it("never sends more bubbles than LINE accepts in one reply", () => {
    expect(toBubbles("ง".repeat(100_000)).length).toBeLessThanOrEqual(5);
  });

  it("keeps every character of an answer that fits", () => {
    const text = `${"จ".repeat(3000)}\n\n${"ฉ".repeat(3000)}`;
    expect(toBubbles(text).map((b) => b.text).join("\n\n")).toBe(text);
  });
});

/**
 * A priced answer now carries a card, and LINE takes at most five messages in one reply — so
 * the picture takes the last slot rather than being dropped, and the words give one up.
 */
describe("toMessages", () => {
  it("sends the words alone when there is no card", () => {
    expect(toMessages("สวัสดีครับ")).toEqual([{ type: "text", text: "สวัสดีครับ" }]);
  });

  it("puts the card after the words", () => {
    const url = "https://www.advisortool.app/api/card?plan=LIFEPROTECT";
    expect(toMessages("เบี้ยรายเดือน 2,583 บาท", url)).toEqual([
      { type: "text", text: "เบี้ยรายเดือน 2,583 บาท" },
      { type: "image", originalContentUrl: url, previewImageUrl: url },
    ]);
  });

  it("never sends more than the five LINE accepts", () => {
    const long = Array.from({ length: 8 }, (_, i) => `ย่อหน้า ${i}`).join("\n\n".repeat(1));
    const many = Array.from({ length: 8 }, (_, i) => "ก".repeat(4800) + i).join("\n\n");
    for (const text of [long, many]) {
      const messages = toMessages(text, "https://example.com/card.png");
      expect(messages.length).toBeLessThanOrEqual(5);
      expect(messages[messages.length - 1].type).toBe("image");
    }
  });
});
