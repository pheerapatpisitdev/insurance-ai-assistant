import { describe, it, expect } from "vitest";
import { codeIsLive, expiryFrom, looksLikeCode, makeCode } from "@/lib/alerts/register";
import { leadMessage } from "@/lib/alerts/lead";

describe("the code that binds a LINE account to the alerts", () => {
  it("is short, upper case and free of characters that read two ways", () => {
    for (let i = 0; i < 50; i++) {
      const code = makeCode();
      expect(code).toMatch(/^ALERT-[A-Z2-9]{5}$/);
      expect(code).not.toMatch(/[OI01]/);
    }
  });

  it("recognises an attempt at a code, so it never reaches the assistant", () => {
    expect(looksLikeCode("ALERT-4F2K9")).toBe(true);
    expect(looksLikeCode("  alert-4f2k9  ")).toBe(true);
    expect(looksLikeCode("อยากได้เบี้ยมรดก 3 ล้าน")).toBe(false);
  });

  it("lives for ten minutes and not a moment longer", () => {
    const now = Date.UTC(2026, 8, 6, 12, 0, 0);
    const until = expiryFrom(now);
    expect(codeIsLive("ALERT-AAAAA", until, now)).toBe(true);
    expect(codeIsLive("ALERT-AAAAA", until, now + 9 * 60_000)).toBe(true);
    expect(codeIsLive("ALERT-AAAAA", until, now + 11 * 60_000)).toBe(false);
  });

  it("is not live when there is none", () => {
    expect(codeIsLive(null, null)).toBe(false);
    expect(codeIsLive("ALERT-AAAAA", null)).toBe(false);
  });
});

describe("what the agent is told about a new customer", () => {
  const reply = "ชุดมรดกเพื่อครอบครัว — มรดก 3 ล้าน\nชาย 40 ปี\n\nรายปี 18,792 บาท\nราย 6 เดือน 9,771.84 บาท";

  it("names the channel, the question and what the bot answered", () => {
    const msg = leadMessage("facebook", "มรดก 3 ล้าน ชาย 40", reply);
    expect(msg).toContain("Messenger");
    expect(msg).toContain("มรดก 3 ล้าน ชาย 40");
    expect(msg).toContain("ชุดมรดกเพื่อครอบครัว — มรดก 3 ล้าน · ชาย 40 ปี");
  });

  it("links to the conversation on the channel it came from", () => {
    expect(leadMessage("line", "สนใจมรดก", reply)).toContain("/admin/line");
    expect(leadMessage("facebook", "สนใจมรดก", reply)).toContain("/admin/messenger");
  });

  it("carries nothing that identifies the customer, because nothing identifying is kept", () => {
    const msg = leadMessage("line", "ผมชื่อสมชาย สนใจมรดก", reply);
    // the question is repeated as the customer wrote it, but no id, hash or profile is added
    expect(msg).not.toMatch(/[0-9a-f]{16}/);
    expect(msg.split("\n")).toHaveLength(4);
  });

  it("keeps a long question from filling the whole message", () => {
    const msg = leadMessage("line", "ก".repeat(400), reply);
    expect(msg.split("\n")[1].length).toBeLessThan(140);
  });
});
