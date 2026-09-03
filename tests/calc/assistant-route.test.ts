import { describe, it, expect } from "vitest";
import { planNamedIn, mergeSlots, recentTurns, type Routed } from "@/lib/assistant/route";
import type { ChatMessage } from "@/lib/ai/types";

describe("reading the plan name out of a message", () => {
  it.each([
    ["ไลฟ์โพรเทค ชาย 35 ทุน 1 ล้าน", "LIFEPROTECT"],
    ["ไลฟ์ โพรเทค+ 100", "LIFEPROTECT"],
    ["Life Protect เบี้ยเท่าไหร่", "LIFEPROTECT"],
    ["iShield ชาย 40 ทุน 500,000", "ISHIELD"],
    ["ประกันโรคร้ายแรง ไอชิว อายุ 35", "ISHIELD"],
    ["ไอสมาร์ท ชาย 70 ปี", "ISMART"],
    ["iSmart 80/6", "ISMART"],
    ["ไลฟ์เทรเชอร์ หญิง 30", "LIFETREASURE"],
    ["PLB 10 ปี", "PLB"],
    ["Protection Life ชาย 50", "PLB"],
  ])("%s -> %s", (text, code) => {
    expect(planNamedIn(text)).toBe(code);
  });

  it("finds nothing in a message that names no plan", () => {
    expect(planNamedIn("ชาย 42 ทุน 2 ล้าน")).toBeUndefined();
    expect(planNamedIn("ขั้นตอนการเคลม")).toBeUndefined();
  });
});

describe("carrying slots between turns", () => {
  const first: Routed = { intent: "quote", planCode: "LIFEPROTECT", variant: "WLF09H", age: 35, sex: "M", sumAssured: 1_000_000 };

  it("keeps age, sex and plan when the next turn only changes one thing", () => {
    const merged = mergeSlots(first, { intent: "quote", sex: "F" });
    expect(merged).toMatchObject({ planCode: "LIFEPROTECT", variant: "WLF09H", age: 35, sex: "F", sumAssured: 1_000_000 });
  });

  it("drops the payment term and the amount when the plan changes, because both belonged to the old plan", () => {
    const merged = mergeSlots(first, { intent: "quote", planCode: "ISHIELD" });
    expect(merged.planCode).toBe("ISHIELD");
    expect(merged.variant).toBeUndefined();
    expect(merged.sumAssured).toBeUndefined();
  });

  it("keeps the amount while the plan stays the same", () => {
    expect(mergeSlots(first, { intent: "quote", sex: "F" }).sumAssured).toBe(1_000_000);
  });

  it("still remembers who the customer is across a plan change", () => {
    const merged = mergeSlots(first, { intent: "quote", planCode: "ISHIELD" });
    expect(merged).toMatchObject({ age: 35, sex: "M" });
  });

  it("lets the newer turn win", () => {
    expect(mergeSlots(first, { intent: "quote", age: 50 }).age).toBe(50);
  });
});

describe("cutting a conversation down to the last few turns", () => {
  const u = (t: string): ChatMessage => ({ role: "user", content: t });
  const a = (t: string): ChatMessage => ({ role: "assistant", content: t });

  it("begins on something the customer said, never on a reply", () => {
    const history = [u("1"), a("2"), u("3"), a("4"), u("5")];
    expect(recentTurns(history, 4)[0].role).toBe("user");
  });

  it("keeps the newest turn, which is the question being answered", () => {
    const history = [u("1"), a("2"), u("3"), a("4"), u("ask me")];
    expect(recentTurns(history, 4).at(-1)?.content).toBe("ask me");
  });

  it("returns the whole conversation when it is shorter than the cut", () => {
    const history = [u("1"), a("2")];
    expect(recentTurns(history, 6)).toEqual(history);
  });

  it("returns nothing when the window holds no question at all", () => {
    expect(recentTurns([a("only a reply")], 4)).toEqual([]);
  });

  it("handles an empty conversation", () => {
    expect(recentTurns([], 6)).toEqual([]);
  });
});
