import { beforeEach, describe, expect, it, vi } from "vitest";

const sent: { text: string[]; images: string[] } = { text: [], images: [] };
const session = { messages: [] as { role: "user" | "assistant"; content: string }[], slots: null as unknown, mutedUntil: null as string | null };
const saved: { mutedUntil: Date | null }[] = [];
const answer = vi.fn(async () => ({
  messages: [{ text: "เบี้ยประมาณ…", card: "/api/card?x=1" }],
  slots: { intent: "quote" as const },
  priced: true,
}));

vi.mock("@/lib/facebook/client", () => ({
  sendMessage: async (_psid: string, text: string) => { sent.text.push(text); },
  sendImage: async (_psid: string, url: string) => { sent.images.push(url); },
  showTyping: async () => {},
}));

vi.mock("@/lib/chat/session", async () => {
  const actual = await vi.importActual<typeof import("@/lib/chat/session")>("@/lib/chat/session");
  return {
    ...actual,
    claimEvent: async () => true,
    loadSession: async () => session,
    saveSession: async (
      _c: string, _u: string, _m: unknown, _s: unknown, mutedUntil: Date | null,
    ) => { saved.push({ mutedUntil }); },
  };
});

vi.mock("@/lib/assistant/answer", () => ({ answerQuestion: answer }));

const { handle } = await import("@/lib/facebook/conversation");

beforeEach(() => {
  process.env.FB_APP_ID = "app-1";
  process.env.FB_APP_SECRET = "secret";
  sent.text = []; sent.images = []; saved.length = 0;
  session.messages = []; session.slots = null; session.mutedUntil = null;
  answer.mockClear();
});

describe("a customer's message", () => {
  it("is answered in words and then in a picture", async () => {
    await handle({ sender: { id: "psid" }, message: { mid: "m1", text: "ชาย 35 ล้านนึง" } });
    expect(sent.text).toEqual(["เบี้ยประมาณ…"]);
    expect(sent.images[0]).toContain("/api/card?x=1");
  });

  it("is remembered with no mute on it", async () => {
    await handle({ sender: { id: "psid" }, message: { mid: "m1", text: "ชาย 35 ล้านนึง" } });
    expect(saved).toEqual([{ mutedUntil: null }]);
  });

  it("is ignored when it carries no words at all", async () => {
    await handle({ sender: { id: "psid" }, message: { mid: "m0" } });
    expect(answer).not.toHaveBeenCalled();
  });
});

describe("a couple priced together", () => {
  it("is sent one message and one card each, in the order they were named", async () => {
    answer.mockResolvedValueOnce({
      messages: [
        { text: "หญิง อายุ 32…", card: "/api/card?a=1" },
        { text: "ชาย อายุ 33…", card: "/api/card?a=2" },
      ],
      slots: { intent: "quote" as const },
      priced: true,
    });
    await handle({ sender: { id: "psid" }, message: { mid: "m9", text: "ผญ 32 ผช33ค่ะ" } });
    expect(sent.text).toEqual(["หญิง อายุ 32…", "ชาย อายุ 33…"]);
    expect(sent.images.map((u) => u.slice(-4))).toEqual(["?a=1", "?a=2"]);
  });
});

describe("the agent answering by hand", () => {
  it("silences the bot for a day and costs nothing", async () => {
    await handle({ sender: { id: "psid" }, message: { mid: "m2", text: "เดี๋ยวโทรหาครับ", is_echo: true } });
    expect(answer).not.toHaveBeenCalled();
    expect(sent.text).toEqual([]);
    expect(saved[0].mutedUntil).toBeInstanceOf(Date);
  });

  it("leaves the bot silent while the mute stands", async () => {
    session.mutedUntil = new Date(Date.now() + 3600_000).toISOString();
    await handle({ sender: { id: "psid" }, message: { mid: "m3", text: "ขอราคาหน่อย" } });
    expect(answer).not.toHaveBeenCalled();
    expect(sent.text).toEqual([]);
  });

  it("lets the bot speak again once the mute has run out", async () => {
    session.mutedUntil = new Date(Date.now() - 1000).toISOString();
    await handle({ sender: { id: "psid" }, message: { mid: "m5", text: "ขอราคาหน่อย" } });
    expect(answer).toHaveBeenCalledOnce();
  });

  it("does not silence the bot for its own echo", async () => {
    await handle({ sender: { id: "psid" }, message: { mid: "m4", text: "เบี้ย…", is_echo: true, app_id: "app-1" } });
    expect(saved).toEqual([]);
  });
});
