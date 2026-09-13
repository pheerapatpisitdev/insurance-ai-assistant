import { beforeEach, describe, expect, it, vi } from "vitest";

const sent: { text: string[]; images: string[] } = { text: [], images: [] };
const session = { messages: [] as { role: "user" | "assistant"; content: string }[], slots: null as unknown, mutedUntil: null as string | null };
const saved: { mutedUntil: Date | null }[] = [];
const answer = vi.fn(async () => ({
  reply: "เบี้ยประมาณ…", slots: { intent: "quote" as const }, priced: true, card: "/api/card?x=1",
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
