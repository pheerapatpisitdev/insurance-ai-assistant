import { beforeEach, describe, expect, it, vi } from "vitest";

const inserted: Record<string, unknown>[][] = [];
let fail = false;
vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({
    from: () => ({
      insert: async (rows: Record<string, unknown>[]) => {
        if (fail) throw new Error("network down");
        inserted.push(rows);
        return { error: null };
      },
    }),
  }),
}));

const { botTurn, keepTranscript } = await import("@/lib/chat/transcript");

const thread = { channel: "facebook" as const, pageId: "p1", userHash: "h1", conversationId: "c1", product: "lifeprotect" };

beforeEach(() => { inserted.length = 0; fail = false; });

describe("botTurn", () => {
  it("writes the bubbles, marks each card, and lists the buttons", () => {
    const t = botTurn([{ text: "เบี้ย 43,000", card: "/api/card?x" }, { text: "สนใจไหมครับ" }], ["จ่าย 9 ปี", "สนใจสมัคร"]);
    expect(t).toEqual({ role: "bot", text: "เบี้ย 43,000\n[การ์ดใบเสนอ]\n\nสนใจไหมครับ\n\n[ปุ่ม: จ่าย 9 ปี | สนใจสมัคร]" });
  });

  it("is nothing when nothing was said", () => {
    expect(botTurn([])).toBeUndefined();
  });
});

describe("keepTranscript", () => {
  it("takes the phone number and the national id out before writing", async () => {
    await keepTranscript(thread, [{ role: "customer", text: "โทร 081-234-5678 บัตร 1 2345 67890 12 3 ครับ อายุ 35" }]);
    const text = String(inserted[0][0].text);
    expect(text).not.toMatch(/081|67890/);
    expect(text).toContain("[เบอร์]");
    expect(text).toContain("[เลขบัตร]");
    // the question itself survives
    expect(text).toContain("อายุ 35");
    expect(inserted[0][0]).toMatchObject({ channel: "facebook", page_id: "p1", user_hash: "h1", conversation_id: "c1", role: "customer", product: "lifeprotect" });
  });

  it("writes every turn in one insert and skips the empty ones", async () => {
    await keepTranscript(thread, [{ role: "customer", text: "สวัสดี" }, undefined, { role: "bot", text: "  " }, { role: "bot", text: "สวัสดีครับ" }]);
    expect(inserted).toHaveLength(1);
    expect(inserted[0].map((r) => r.role)).toEqual(["customer", "bot"]);
  });

  it("caps a long message at the column's limit", async () => {
    await keepTranscript(thread, [{ role: "customer", text: "ก".repeat(5000) }]);
    expect(String(inserted[0][0].text)).toHaveLength(2000);
  });

  it("never costs the customer an answer when the database is down", async () => {
    fail = true;
    await expect(keepTranscript(thread, [{ role: "customer", text: "สวัสดี" }])).resolves.toBeUndefined();
  });
});
