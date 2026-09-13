import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Answer } from "@/lib/assistant/lifeprotect/answer";

const sent: { text: string[]; images: string[]; replies: (string[] | undefined)[] } = { text: [], images: [], replies: [] };
const session = { messages: [] as { role: "user" | "assistant"; content: string }[], slots: null as unknown, mutedUntil: null as string | null };
const saved: { mutedUntil?: Date | null }[] = [];
/** every user hash the handler touched, so one conversation can be shown to be one row */
const hashesSeen: string[] = [];
const quoted = async (): Promise<Answer> => ({
  messages: [{ text: "เบี้ยประมาณ…", card: "/api/card?x=1" }],
  slots: { intent: "quote" },
  priced: true,
});
const answer = vi.fn(quoted);

vi.mock("@/lib/facebook/client", () => ({
  sendMessage: async (_psid: string, text: string, replies?: string[]) => {
    sent.text.push(text); sent.replies.push(replies);
  },
  sendImage: async (_psid: string, url: string, replies?: string[]) => {
    sent.images.push(url); sent.replies.push(replies);
  },
  showTyping: async () => {},
}));

vi.mock("@/lib/chat/session", async () => {
  const actual = await vi.importActual<typeof import("@/lib/chat/session")>("@/lib/chat/session");
  return {
    ...actual,
    claimEvent: async () => true,
    loadSession: async (_c: string, u: string) => { hashesSeen.push(u); return session; },
    saveSession: async (
      _c: string, u: string, _m: unknown, _s: unknown, mutedUntil?: Date | null,
    ) => { hashesSeen.push(u); saved.push({ mutedUntil }); },
  };
});

vi.mock("@/lib/assistant/lifeprotect/answer", () => ({ answerQuestion: answer }));

const { handle } = await import("@/lib/facebook/conversation");

beforeEach(() => {
  process.env.FB_APP_ID = "app-1";
  process.env.FB_APP_SECRET = "secret";
  sent.text = []; sent.images = []; sent.replies = []; saved.length = 0;
  session.messages = []; session.slots = null; session.mutedUntil = null;
  answer.mockReset();
  answer.mockImplementation(quoted);
});

describe("a customer's message", () => {
  it("is answered in words and then in a picture", async () => {
    await handle({ sender: { id: "psid" }, message: { mid: "m1", text: "ชาย 35 ล้านนึง" } });
    expect(sent.text).toEqual(["เบี้ยประมาณ…"]);
    expect(sent.images[0]).toContain("/api/card?x=1");
  });

  it("is remembered without touching whatever mute the thread carries", async () => {
    await handle({ sender: { id: "psid" }, message: { mid: "m1", text: "ชาย 35 ล้านนึง" } });
    expect(saved).toEqual([{ mutedUntil: undefined }]);
  });

  it("is ignored when it carries no words at all", async () => {
    await handle({ sender: { id: "psid" }, message: { mid: "m0" } });
    expect(answer).not.toHaveBeenCalled();
  });
});

describe("a customer whose answer would not come", () => {
  const asked = { sender: { id: "psid-lost" }, message: { mid: "m1", text: "สนใจประกันมรดก ทุน 1,000,000" } };

  it("is answered on the second attempt rather than apologised to", async () => {
    answer.mockRejectedValueOnce(new Error("ไม่มีคีย์ผู้ให้บริการ AI ที่ใช้ได้ในตอนนี้"));
    await handle(asked);
    expect(answer).toHaveBeenCalledTimes(2);
    expect(sent.text).toEqual(["เบี้ยประมาณ…"]);
  });

  it("is handed to the agent, not told to come back later, when it truly cannot answer", async () => {
    answer.mockRejectedValue(new Error("ล่ม"));
    await expect(handle(asked)).rejects.toThrow();
    expect(sent.text).toEqual(["ขออภัยครับ ระบบขัดข้องชั่วคราว เดี๋ยวแอดมินมาตอบให้นะครับ 🙏"]);
  });
});

describe("an agent who answers while the bot is still typing", () => {
  it("does not stop the answer when the mark on the thread is the same one it started with", async () => {
    session.mutedUntil = new Date(Date.now() + 23 * 3600_000).toISOString();
    await handle({ sender: { id: "psid-mark" }, message: { mid: "m7", text: "ขอราคาหน่อย" } });
    expect(sent.text).toEqual(["เบี้ยประมาณ…"]);
  });

  it("is not talked over", async () => {
    // the mute lands during the model call, which is where the seconds go
    session.mutedUntil = null;
    answer.mockImplementationOnce(async (): Promise<Answer> => {
      session.mutedUntil = new Date(Date.now() + 3600_000).toISOString();
      return { messages: [{ text: "เบี้ยประมาณ…", card: "/api/card?x=1" }], slots: { intent: "quote" }, priced: true };
    });
    await handle({ sender: { id: "psid-cut" }, message: { mid: "m1", text: "ชาย 35 ล้านนึง" } });
    expect(sent.text).toEqual([]);
    expect(sent.images).toEqual([]);
  });

  it("keeps their mute: the bot's own save must not wipe it", async () => {
    session.mutedUntil = null;
    answer.mockImplementationOnce(async (): Promise<Answer> => {
      session.mutedUntil = new Date(Date.now() + 3600_000).toISOString();
      return { messages: [{ text: "เบี้ยประมาณ…", card: "/api/card?x=1" }], slots: { intent: "quote" }, priced: true };
    });
    await handle({ sender: { id: "psid-cut2" }, message: { mid: "m1", text: "ชาย 35 ล้านนึง" } });
    expect(saved).toEqual([]);
  });
});

describe("the buttons an answer offers", () => {
  it("ride on the picture, which is what lands last", async () => {
    answer.mockImplementationOnce(async (): Promise<Answer> => ({
      messages: [{ text: "เบี้ยประมาณ…", card: "/api/card?x=1" }],
      slots: { intent: "quote" },
      priced: true,
      replies: ["ขอตารางมูลค่า"],
    }));
    await handle({ sender: { id: "psid-btn" }, message: { mid: "mb1", text: "ชาย 35 ล้านนึง" } });
    // the words go out bare; anything sent after the buttons would take them away
    expect(sent.replies).toEqual([undefined, ["ขอตารางมูลค่า"]]);
  });

  it("ride on the words when there is no picture", async () => {
    answer.mockImplementationOnce(async (): Promise<Answer> => ({
      messages: [{ text: "ส่งตารางให้แล้วครับ" }],
      slots: { intent: "quote" },
      priced: true,
      replies: ["สนใจสมัคร"],
    }));
    await handle({ sender: { id: "psid-btn2" }, message: { mid: "mb2", text: "ขอตาราง" } });
    expect(sent.replies).toEqual([["สนใจสมัคร"]]);
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
  it("mutes the customer's own thread, not one named after the page", async () => {
    const seen: string[] = [];
    hashesSeen.length = 0;
    await handle({ sender: { id: "page" }, recipient: { id: "psid-9" }, message: { mid: "m8", text: "ครับ", is_echo: true } });
    seen.push(...hashesSeen);
    await handle({ sender: { id: "psid-9" }, recipient: { id: "page" }, message: { mid: "m8b", text: "ขอราคา" } });
    seen.push(...hashesSeen);
    // both events are the same conversation, so both must land on one row
    expect(new Set(seen).size).toBe(1);
  });

  it("marks the thread and costs nothing", async () => {
    await handle({ sender: { id: "page" }, recipient: { id: "psid" }, message: { mid: "m2", text: "เดี๋ยวโทรหาครับ", is_echo: true } });
    expect(answer).not.toHaveBeenCalled();
    expect(sent.text).toEqual([]);
    expect(saved[0].mutedUntil).toBeInstanceOf(Date);
  });

  it("hands the thread back the moment the customer writes again", async () => {
    // the agent said hello an hour ago and the customer has just answered: the pause is over
    session.mutedUntil = new Date(Date.now() + 23 * 3600_000).toISOString();
    await handle({ sender: { id: "psid-back" }, message: { mid: "m3", text: "เกิด2522 เพศญ" } });
    expect(answer).toHaveBeenCalledOnce();
    expect(sent.text).toEqual(["เบี้ยประมาณ…"]);
  });

  it("keeps the agent's mark on the thread rather than clearing it to speak", async () => {
    session.mutedUntil = new Date(Date.now() + 23 * 3600_000).toISOString();
    await handle({ sender: { id: "psid-keep" }, message: { mid: "m5", text: "ขอราคาหน่อย" } });
    expect(saved).toEqual([{ mutedUntil: undefined }]);
  });

  it("does not silence the bot for its own echo", async () => {
    await handle({ sender: { id: "page" }, recipient: { id: "psid" }, message: { mid: "m4", text: "เบี้ย…", is_echo: true, app_id: "app-1" } });
    expect(saved).toEqual([]);
  });
});
