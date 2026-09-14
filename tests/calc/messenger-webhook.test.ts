import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AnswerContext } from "@/lib/assistant/common";
import type { Answer } from "@/lib/assistant/lifeprotect/answer";

const sent: { text: string[]; images: string[]; replies: (string[] | undefined)[] } = { text: [], images: [], replies: [] };
const session = {
  messages: [] as { role: "user" | "assistant"; content: string }[], slots: null as unknown,
  mutedUntil: null as string | null, conversationId: null as string | null,
};
const saved: { mutedUntil?: Date | null }[] = [];
/** the conversation each save pointed the session at, when it named one */
const savedConversations: (string | null)[] = [];
/** every user hash the handler touched, so one conversation can be shown to be one row */
const hashesSeen: string[] = [];
const quoted = async (): Promise<Answer> => ({
  messages: [{ text: "เบี้ยประมาณ…", card: "/api/card?x=1" }],
  slots: { intent: "quote" },
  priced: true,
});
const answer = vi.fn<(history: unknown, slots: unknown, ctx?: AnswerContext) => Promise<Answer>>(quoted);

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
      _c: string, u: string, _m: unknown, _s: unknown, mutedUntil?: Date | null, conversationId?: string | null,
    ) => {
      hashesSeen.push(u); saved.push({ mutedUntil });
      if (conversationId !== undefined) savedConversations.push(conversationId);
    },
  };
});

vi.mock("@/lib/assistant/dispatch", () => ({ answerAny: answer }));

/** What the record was told, and how it answers. */
type Recorded = { id: string; events: { kind: string; data?: Record<string, unknown> }[]; unanswered: unknown[] };
const collected: { opened: unknown[]; attributed: unknown[]; recorded: Recorded[]; leads: unknown[] } =
  { opened: [], attributed: [], recorded: [], leads: [] };
let openReturns: string | null = "conv-1";
let recordFails = false;

vi.mock("@/lib/chat/collect", async () => {
  const actual = await vi.importActual<typeof import("@/lib/chat/collect")>("@/lib/chat/collect");
  return {
    ...actual,
    openConversation: async (c: unknown) => { collected.opened.push(c); return openReturns; },
    attribute: async (id: string, r: unknown) => { collected.attributed.push({ id, r }); },
    record: async (id: string, events: Recorded["events"], _p: unknown, unanswered: unknown[] = []) => {
      if (recordFails) throw new Error("db down");
      collected.recorded.push({ id, events, unanswered });
    },
    openLead: async (l: unknown) => { collected.leads.push(l); },
  };
});

const { handle } = await import("@/lib/facebook/conversation");

beforeEach(() => {
  process.env.FB_APP_ID = "app-1";
  process.env.FB_APP_SECRET = "secret";
  sent.text = []; sent.images = []; sent.replies = []; saved.length = 0;
  session.messages = []; session.slots = null; session.mutedUntil = null; session.conversationId = null;
  savedConversations.length = 0;
  collected.opened = []; collected.attributed = []; collected.recorded = []; collected.leads = [];
  openReturns = "conv-1"; recordFails = false;
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

describe("what the record is told", () => {
  it("opens a conversation for a customer who has none, and writes the turn down after answering", async () => {
    answer.mockResolvedValueOnce({
      messages: [{ text: "เบี้ยประมาณ…", card: "/api/card?x=1" }],
      slots: { intent: "quote" },
      priced: true,
      trace: [{ kind: "routed", data: { intent: "quote" } }, { kind: "quoted", data: { age: 35, sumAssured: 1_000_000 } }],
    });
    await handle({ sender: { id: "psid-rec1" }, recipient: { id: "page-1" }, message: { mid: "m1", text: "ชาย 35 ล้านนึง" } });
    expect(collected.opened).toEqual([expect.objectContaining({ channel: "facebook", pageId: "page-1" })]);
    expect(collected.recorded).toHaveLength(1);
    expect(collected.recorded[0].id).toBe("conv-1");
    expect(collected.recorded[0].events.map((e) => e.kind)).toEqual(["message", "routed", "quoted"]);
    expect(collected.recorded[0].events[0].data).toEqual({ chars: "ชาย 35 ล้านนึง".length, button: false });
    // and the session now points at it, so the next message joins the same conversation
    expect(savedConversations).toEqual(["conv-1"]);
  });

  it("joins the live conversation instead of opening another", async () => {
    session.conversationId = "conv-live";
    await handle({ sender: { id: "psid-rec2" }, message: { mid: "m1", text: "ขอตาราง" } });
    expect(collected.opened).toEqual([]);
    expect(collected.recorded[0].id).toBe("conv-live");
  });

  it("keeps where the advert sent them, even when the referral arrives with no words", async () => {
    await handle({ sender: { id: "psid-rec3" }, recipient: { id: "page-1" }, referral: { source: "ADS", type: "OPEN_THREAD", ad_id: "1202" } });
    expect(answer).not.toHaveBeenCalled();
    expect(sent.text).toEqual([]);
    expect(collected.opened).toEqual([expect.objectContaining({ referral: expect.objectContaining({ source: "ads", adId: "1202" }) })]);
    expect(savedConversations).toEqual(["conv-1"]);
  });

  it("attributes a live conversation when a referral lands on it", async () => {
    session.conversationId = "conv-live";
    await handle({ sender: { id: "psid-rec4" }, message: { mid: "m1", text: "สนใจครับ", referral: { source: "ADS", ad_id: "77" } } });
    expect(collected.attributed).toEqual([{ id: "conv-live", r: expect.objectContaining({ adId: "77" }) }]);
    expect(sent.text).toEqual(["เบี้ยประมาณ…"]);
  });

  it("still answers when the record cannot be written", async () => {
    recordFails = true;
    await handle({ sender: { id: "psid-rec5" }, message: { mid: "m1", text: "ชาย 35 ล้านนึง" } });
    expect(sent.text).toEqual(["เบี้ยประมาณ…"]);
  });

  it("answers all the same when no conversation could be opened", async () => {
    openReturns = null;
    await handle({ sender: { id: "psid-rec6" }, message: { mid: "m1", text: "ชาย 35 ล้านนึง" } });
    expect(sent.text).toEqual(["เบี้ยประมาณ…"]);
    expect(collected.recorded).toEqual([]);
    // and the form link would carry no code, since there is nothing to match it to
    expect(answer.mock.calls[0][2]).toEqual({});
  });

  it("hands the answer the code that rides on the form link", async () => {
    await handle({ sender: { id: "psid-rec7" }, message: { mid: "m1", text: "สมัครยังไง" } });
    expect(answer.mock.calls[0][2]).toEqual({ formRef: "conv1" });
  });

  it("opens a lead when the form goes out", async () => {
    answer.mockResolvedValueOnce({
      messages: [{ text: "ยินดีครับ" }, { text: "https://form" }, { text: "กรอกเสร็จแล้วแจ้ง" }],
      slots: { intent: "quote", formSent: true },
      trace: [{ kind: "form_sent", data: { form_ref: "conv1" } }],
    });
    await handle({ sender: { id: "psid-rec8" }, message: { mid: "m1", text: "เอาแผนนี้" } });
    expect(collected.leads).toEqual([expect.objectContaining({ conversationId: "conv-1", stage: "form_sent", product: "lifeprotect", formRef: "conv1" })]);
    expect((collected.leads[0] as { psid: string }).psid).toMatch(/^psid-rec/);
  });

  it("opens a lead for someone who asked for a person, and none for an ordinary quote", async () => {
    answer.mockResolvedValueOnce({
      messages: [{ text: "…" }], slots: { intent: "other" },
      trace: [{ kind: "company", data: { trust: true } }, { kind: "handover", data: { reason: "trust" } }],
    });
    await handle({ sender: { id: "psid-rec9" }, message: { mid: "m1", text: "เชื่อถือได้ไหม" } });
    expect(collected.leads).toEqual([expect.objectContaining({ stage: "interested" })]);
    collected.leads = [];
    await handle({ sender: { id: "psid-rec10" }, message: { mid: "m2", text: "ชาย 35 ล้านนึง" } });
    expect(collected.leads).toEqual([]);
  });

  it("sends a question the model answered to the unanswered list, and never into the events", async () => {
    answer.mockResolvedValueOnce({
      messages: [{ text: "…" }], slots: { intent: "plan_info" },
      trace: [{ kind: "plan_info", question: "แบบนี้เวนคืนได้ไหม" }],
    });
    await handle({ sender: { id: "psid-rec11" }, message: { mid: "m1", text: "เวนคืนได้มั้ย" } });
    const r = collected.recorded[0];
    expect(r.unanswered).toEqual([{ intent: "plan_info", route: "model", question: "แบบนี้เวนคืนได้ไหม" }]);
    expect(JSON.stringify(r.events)).not.toContain("เวนคืน");
  });

  it("notes the agent stepping in on the live conversation", async () => {
    session.conversationId = "conv-live";
    await handle({ sender: { id: "page" }, recipient: { id: "psid-rec-echo" }, message: { mid: "m2", text: "เดี๋ยวโทรหาครับ", is_echo: true } });
    expect(collected.recorded).toEqual([{ id: "conv-live", events: [{ kind: "agent_replied" }], unanswered: [] }]);
  });
});
