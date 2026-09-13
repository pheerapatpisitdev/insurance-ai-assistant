import { beforeEach, describe, expect, it, vi } from "vitest";

const reply = { text: "", model: "stub", provider: "stub", inputTokens: 0, outputTokens: 0, costThb: 0 };
const chat = vi.fn(async () => reply);

vi.mock("@/lib/ai/client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/ai/client")>("@/lib/ai/client");
  return { ...actual, chat };
});

const { mergeSlots, routeMessage } = await import("@/lib/assistant/route");

const said = (content: string) => [{ role: "user" as const, content }];

beforeEach(() => { chat.mockClear(); });

describe("reading what the customer wants", () => {
  it("reads an age, a sex and a sum out of one line", async () => {
    reply.text = JSON.stringify({ intent: "quote", age: 35, sex: "M", sumAssured: 1000000 });
    expect(await routeMessage(said("ชาย 35 ล้านนึง"))).toMatchObject({
      intent: "quote", age: 35, sex: "M", sumAssured: 1000000,
    });
  });

  it("takes the term named in the message over the one the model guessed", async () => {
    reply.text = JSON.stringify({ intent: "quote", variant: "WLF99H" });
    expect((await routeMessage(said("จ่าย 19 ปีเท่าไหร่"))).variant).toBe("WLF19H");
  });

  it("keeps the x 1.5 term the customer named, for the answer to turn down", async () => {
    reply.text = JSON.stringify({ intent: "quote" });
    expect((await routeMessage(said("แบบ x 1.5 จ่าย 9 ปี"))).variant).toBe("WLF09L");
  });

  it("refuses a code that is not one of this plan's packages", async () => {
    reply.text = JSON.stringify({ intent: "quote", variant: "ISH10" });
    expect((await routeMessage(said("ขอราคา"))).variant).toBeUndefined();
  });

  it("drops an age outside what a person can be", async () => {
    reply.text = JSON.stringify({ intent: "quote", age: 140 });
    expect((await routeMessage(said("อายุ 140"))).age).toBeUndefined();
  });

  it("treats a question about what the family receives as a question about the plan", async () => {
    reply.text = JSON.stringify({ intent: "other" });
    expect((await routeMessage(said("ทำทุน 1 ล้าน ครอบครัวได้ 2 ล้านจริงไหม"))).intent).toBe("plan_info");
  });

  it("treats the advert's own button as a request for a price, whatever the model called it", async () => {
    reply.text = JSON.stringify({ intent: "plan_info", sumAssured: 1000000 });
    const routed = await routeMessage(said("สนใจประกันมรดก ทุน 1,000,000"));
    expect(routed.intent).toBe("quote");
    expect(routed.sumAssured).toBe(1000000);
  });

  it("leaves a question about what the family receives alone, sum or no sum", async () => {
    reply.text = JSON.stringify({ intent: "plan_info", sumAssured: 1000000 });
    expect((await routeMessage(said("ทำทุน 1 ล้าน ครอบครัวได้ 2 ล้านจริงไหม"))).intent).toBe("plan_info");
  });

  it("falls back to a plain conversation when the model answers with rubbish", async () => {
    reply.text = "ไม่ใช่ JSON";
    expect(await routeMessage(said("สวัสดี"))).toEqual({ intent: "other" });
  });
});

describe("carrying the conversation forward", () => {
  it("keeps the age and sex from an earlier turn", () => {
    const merged = mergeSlots(
      { intent: "quote", age: 35, sex: "M", sumAssured: 1000000 },
      { intent: "quote", variant: "WLF19H" },
    );
    expect(merged).toMatchObject({ age: 35, sex: "M", sumAssured: 1000000, variant: "WLF19H" });
  });

  it("lets the newest turn overwrite what it names", () => {
    const merged = mergeSlots({ intent: "quote", sumAssured: 1000000 }, { intent: "quote", sumAssured: 500000 });
    expect(merged.sumAssured).toBe(500000);
  });
});
