import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatOptions } from "@/lib/ai/client";

/**
 * One set of knowledge, whichever door the customer came through.
 *
 * The website and the page's inbox used to know different things: the website had every
 * plan's rules, the illness lists and whatever the agent had typed into the knowledge box,
 * and the bot had a ten-line summary of one plan. The same question got two answers, and the
 * customer who arrived through a paid advertisement got the thinner one.
 *
 * These press the shared door — the dispatcher — because that is now where both of them
 * knock. Anything proved here is true of the bot as well as of the page.
 */

let routed: Record<string, unknown> = { intent: "other" };
const chat = vi.fn(async ({ task }: ChatOptions) => ({
  text: task.startsWith("route") ? JSON.stringify(routed) : "ตอบจากคลัง",
  model: "stub", provider: "stub", inputTokens: 0, outputTokens: 0, costThb: 0,
}));
vi.mock("@/lib/ai/client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/ai/client")>("@/lib/ai/client");
  return { ...actual, chat };
});
vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({
    from: () => ({ select: () => ({ eq: () => ({ limit: async () => ({ data: [], error: null }) }) }) }),
  }),
}));

const { answerAny } = await import("@/lib/assistant/dispatch");
const said = (content: string) => [{ role: "user" as const, content }];
beforeEach(() => { chat.mockClear(); routed = { intent: "other" }; });

describe("a premium for a plan with no brain", () => {
  it("is quoted by the dispatcher, so the inbox gets the figure the website gets", async () => {
    for (const [ask, plan] of [
      ["PLB ชาย 35 ทุน 1 ล้าน จ่าย 10 ปี เบี้ยเท่าไหร่", "PLB"],
      ["iSmart ชาย 35 ทุน 1 ล้าน เบี้ยเท่าไหร่", "ISMART"],
      ["Life Treasure ชาย 40 ทุน 10 ล้าน จ่าย 6 ปี เบี้ยเท่าไหร่", "LIFETREASURE"],
    ] as const) {
      const a = await answerAny(said(ask), null);
      expect(a.priced, ask).toBe(true);
      expect(a.messages[0].text, ask).toMatch(/💰 เบี้ยปีละ \*\*[\d,]+ บาท\*\*/);
      // the same card the page draws, drawn by the same code
      expect(a.messages[0].card, ask).toContain(`plan=${plan}`);
      // and no model was paid to produce a figure the engine already had
      expect(chat, ask).not.toHaveBeenCalled();
    }
  });

  it("explains iShield rather than quoting it, because it is asked for a premium", async () => {
    const a = await answerAny(said("iShield ชาย 35 ทุน 1 ล้าน เบี้ยเท่าไหร่"), null);
    expect(a.priced).toBeFalsy();
    expect(a.messages[0].text).toContain("กรอกเบี้ยที่อยากจ่าย");
    expect(a.messages[0].card).toBeUndefined();
  });

  it("asks for the paying term instead of choosing one", async () => {
    // six years and eighteen are the same contract at very different money
    const a = await answerAny(said("Life Treasure ชาย 40 ทุน 10 ล้าน เบี้ยเท่าไหร่"), null);
    expect(a.priced).toBeFalsy();
    expect(a.messages[0].text).toContain("ระยะเวลาชำระเบี้ย");
    expect(a.messages[0].text).not.toMatch(/💰/);
  });

  it("keeps a named plan away from the brain that owns its subject", async () => {
    // "PLB ทุน 1 ล้าน" reads as a life-insurance subject and used to be quoted as Life Protect
    const a = await answerAny(said("PLB ทุน 1 ล้าน เบี้ยเท่าไหร่"), null);
    expect(a.messages[0].text).toContain("Protection Life");
    expect(a.messages[0].text).not.toContain("Life Protect+");
  });
});

describe("a question about a rule, asked in the page's inbox", () => {
  it("is answered from the library instead of met with “สนใจแบบไหนครับ”", async () => {
    const a = await answerAny(said("HIC ซื้อคู่กับ MEB ได้ไหม"), null);
    expect(a.fromLibrary).toBe(true);
    expect(a.messages[0].text).toBe("ตอบจากคลัง");
    // the funnel is not dropped: the two buttons are still offered under the answer
    expect(a.replies?.length).toBe(2);

    // and the library it read is the whole library, not one plan's summary
    const system = chat.mock.calls.at(-1)![0].messages[0].content as string;
    for (const plan of ["LIFEPROTECT", "ISMART", "LIFETREASURE", "ISHIELD", "PLB"]) {
      expect(system, plan).toContain(`รหัส ${plan}`);
    }
    expect(system).toContain("ไม่สามารถซื้อคู่กับ MEX, MEB หรือ iHealthy Ultra");
  });

  it("still answers a question about the company itself without paying for a model", async () => {
    const a = await answerAny(said("ของอะไร"), null);
    expect(a.messages[0].text).toContain("กรุงไทย-แอกซ่า ประกันชีวิต");
    expect(chat).not.toHaveBeenCalled();
  });

  it("still opens with the two buttons for someone who asked nothing", async () => {
    // a greeting names no plan and asks nothing; the buttons are the answer to it, and
    // spending a model call to say hello would be the wrong trade
    const a = await answerAny(said("สวัสดีครับ"), null);
    expect(a.messages.at(-1)!.text).toContain("สนใจแบบไหน");
    expect(a.fromLibrary).toBeUndefined();
    expect(chat).not.toHaveBeenCalled();
  });
});
