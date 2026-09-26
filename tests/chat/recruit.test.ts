import { describe, expect, it } from "vitest";
import { RECRUIT_ASK, recruitReply, wantsToJoin } from "@/lib/assistant/recruit";
import { answerAny } from "@/lib/assistant/dispatch";

describe("wantsToJoin", () => {
  it.each([
    "อยากเป็นตัวแทนครับ",
    "สนใจร่วมทีมค่ะ",
    "สมัครตัวแทนยังไงคะ",
    "รับสมัครตัวแทนไหมครับ",
    "สนใจสมัครเป็นตัวแทนค่ะ",
    "อยากสอบใบอนุญาตตัวแทน",
    "อยากทำงานกับทีมนี้ สมัครงานได้ไหม",
  ])("hears someone who wants to join: %s", (text) => {
    expect(wantsToJoin(text)).toBe(true);
  });

  it.each([
    "ขอคุยกับตัวแทนหน่อยครับ",
    "ตัวแทนโทรมาแล้วค่ะ",
    "สนใจสมัคร",
    "สมัครประกันยังไง",
    "ติดต่อตัวแทนได้ที่ไหน",
    "อยากได้ตัวแทนดูแล",
    "เบี้ยเท่าไหร่ ผู้หญิง 35",
  ])("leaves a customer to the sales brains: %s", (text) => {
    expect(wantsToJoin(text)).toBe(false);
  });
});

describe("recruitReply", () => {
  it("thanks, says the manager will write, and asks one question — no model", () => {
    const r = recruitReply("อยากเป็นตัวแทนครับ", undefined)!;
    expect(r.recruit).toBe(true);
    expect(r.messages.map((m) => m.text).join("\n")).toContain("ผู้จัดการทีม");
    expect(r.messages.at(-1)!.text).toBe(RECRUIT_ASK);
  });

  it("the answer to that question is taken, not sold to", () => {
    const r = recruitReply("ทำงานบริษัทครับ", `ขอบคุณ\n\n${RECRUIT_ASK}`)!;
    expect(r.recruit).toBe(true);
    expect(r.messages).toHaveLength(1);
    expect(r.messages[0].text).toContain("ผู้จัดการทีม");
  });

  it("a question after it goes back to the normal brains", () => {
    expect(recruitReply("เบี้ยเท่าไหร่ครับ", RECRUIT_ASK)).toBeNull();
  });

  it("says nothing to an ordinary message", () => {
    expect(recruitReply("สวัสดีครับ", undefined)).toBeNull();
  });
});

describe("answerAny — the hand-over comes before any brain", () => {
  it("answers a would-be agent without pricing anything, and keeps the slots", async () => {
    const slots = { product: "lifeprotect" as const };
    const a = await answerAny([{ role: "user", content: "สนใจร่วมทีมครับ" }], slots as never, "facebook");
    expect(a.recruit).toBe(true);
    expect(a.priced).toBeFalsy();
    expect(a.slots).toBe(slots);
  });
});

describe("the report names a would-be agent's thread", () => {
  it("files it under หาทีม", async () => {
    const { planName, RECRUIT_PRODUCT } = await import("@/lib/crm/plans");
    expect(planName(RECRUIT_PRODUCT)).toBe("หาทีม");
  });
});
