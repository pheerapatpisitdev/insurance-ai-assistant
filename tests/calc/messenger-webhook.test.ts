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
/** how many of the next picture sends Messenger will refuse */
let imageFailures = 0;

vi.mock("@/lib/facebook/client", () => ({
  sendMessage: async (_psid: string, text: string, replies?: string[]) => {
    sent.text.push(text); sent.replies.push(replies);
  },
  sendImage: async (_psid: string, url: string, replies?: string[]) => {
    sent.images.push(url); sent.replies.push(replies);
    if (imageFailures > 0) { imageFailures -= 1; throw new Error("Messenger 400: อัพโหลดไฟล์แนบไม่สำเร็จ"); }
  },
  showTyping: async () => {},
}));

/** the follow-up the bot arms after a quotation, and drops the moment anyone speaks */
const followups: { armed: { user: string; pageId?: string }[]; dropped: string[] } = { armed: [], dropped: [] };
vi.mock("@/lib/chat/followup", () => ({
  armFollowup: async (_c: string, u: string, _psid: string, pageId?: string) => {
    followups.armed.push({ user: u, pageId });
  },
  dropFollowup: async (_c: string, u: string) => { followups.dropped.push(u); },
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

vi.mock("@/lib/assistant/dispatch", () => ({ answerAny: answer }));

const { handle } = await import("@/lib/facebook/conversation");

beforeEach(() => {
  process.env.FB_APP_ID = "app-1";
  process.env.FB_APP_SECRET = "secret";
  sent.text = []; sent.images = []; sent.replies = []; saved.length = 0;
  imageFailures = 0;
  followups.armed.length = 0; followups.dropped.length = 0;
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

describe("the question the bot arms for five minutes' time", () => {
  it("is armed on a quotation, addressed to the customer it quoted", async () => {
    answer.mockImplementationOnce(async (): Promise<Answer> => ({
      messages: [{ text: "เบี้ยประมาณ…", card: "/api/card?x=1" }],
      slots: { intent: "quote", product: "lifeprotect" },
      priced: true,
    }));
    await handle({ sender: { id: "psid-arm" }, message: { mid: "mf1", text: "หญิง 40 ทุน 1 ล้าน" } }, "page-1");
    expect(followups.armed).toHaveLength(1);
  });

  /**
   * And addressed out of the Page it arrived on.
   *
   * Two Pages are connected, and a page-scoped id means nothing to the other one: a follow-up
   * armed without a Page was sent with whichever token came first and refused by Meta.
   */
  it("carries the Page the conversation happened on", async () => {
    answer.mockImplementationOnce(async (): Promise<Answer> => ({
      messages: [{ text: "เบี้ยประมาณ…" }],
      slots: { intent: "quote", product: "lifeprotect" },
      priced: true,
    }));
    await handle({ sender: { id: "psid-arm3" }, message: { mid: "mf4", text: "หญิง 40 ทุน 1 ล้าน" } }, "page-7");
    expect(followups.armed).toEqual([{ user: expect.any(String), pageId: "page-7" }]);
  });

  it("is not armed by an answer that carries no premium", async () => {
    answer.mockImplementationOnce(async (): Promise<Answer> => ({
      messages: [{ text: "ขอเพศกับอายุด้วยครับ" }],
      slots: { intent: "quote", product: "lifeprotect" },
    }));
    await handle({ sender: { id: "psid-arm2" }, message: { mid: "mf2", text: "สนใจครับ" } });
    expect(followups.armed).toEqual([]);
  });

  it("is dropped when the agent takes the thread", async () => {
    await handle({ sender: { id: "page" }, recipient: { id: "psid-drop" }, message: { mid: "mf3", text: "สวัสดีครับ", is_echo: true } });
    expect(followups.dropped).toHaveLength(1);
  });

  it("is dropped when the customer writes again, before anything else happens", async () => {
    await handle({ sender: { id: "psid-drop2" }, message: { mid: "mf4", text: "สนใจครับ" } });
    expect(followups.dropped).toHaveLength(1);
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

/**
 * Messenger fetches the card off the public internet itself, and sometimes refuses it.
 *
 * The customer has been quoted in words by the time this happens, and what used to follow was
 * nothing at all — the figures they were promised a picture of never arrived and no one knew.
 */
describe("the picture of the quotation, when Messenger will not take it", () => {
  it("is offered a second time before anything else is tried", async () => {
    imageFailures = 1;
    await handle({ sender: { id: "psid-card1" }, message: { mid: "mc1", text: "หญิง 40 ทุน 1 ล้าน" } });
    expect(sent.images).toHaveLength(2);
    expect(sent.images.every((u) => u.endsWith("/api/card?x=1"))).toBe(true);
    expect(sent.text.join("\n")).not.toContain("เปิดดูได้ที่ลิงก์นี้");
  });

  it("goes as a link when both attempts are refused, rather than going nowhere", async () => {
    imageFailures = 2;
    await handle({ sender: { id: "psid-card2" }, message: { mid: "mc2", text: "หญิง 40 ทุน 1 ล้าน" } });
    expect(sent.images).toHaveLength(2);
    const last = sent.text[sent.text.length - 1];
    expect(last).toContain("เปิดดูได้ที่ลิงก์นี้");
    expect(last).toContain("/api/card?x=1");
  });
});

/**
 * What follows an application form is an agent — a name to check, a birthdate to read back,
 * a question about the health declaration that no model may answer.
 */
describe("once the form has been handed over", () => {
  it("says nothing more in that thread, whatever the customer writes", async () => {
    session.slots = { product: "lifeprotect", formSent: true };
    await handle({ sender: { id: "psid-done" }, message: { mid: "mg1", text: "กรอกแล้วครับ" } });
    expect(sent.text).toEqual([]);
    expect(sent.images).toEqual([]);
    // and no model was asked to compose the silence
    expect(answer).not.toHaveBeenCalled();
  });

  it("still answers the turn that sends the form", async () => {
    answer.mockImplementationOnce(async (): Promise<Answer> => ({
      messages: [{ text: "ยินดีครับ 😊 รบกวนกรอกข้อมูลตามฟอร์มนี้ได้เลยครับ" }],
      slots: { intent: "quote", product: "lifeprotect", formSent: true },
    }));
    await handle({ sender: { id: "psid-form" }, message: { mid: "mg2", text: "สนใจสมัคร" } });
    expect(sent.text.join(" ")).toContain("ฟอร์ม");
  });

  /** A thread nobody has been handed anything in is untouched by this. */
  it("leaves an ordinary thread alone", async () => {
    session.slots = { product: "lifeprotect" };
    await handle({ sender: { id: "psid-live" }, message: { mid: "mg3", text: "ขอตารางมูลค่า" } });
    expect(sent.text.length).toBeGreaterThan(0);
  });
});
