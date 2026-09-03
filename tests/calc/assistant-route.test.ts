import { describe, it, expect } from "vitest";
import { planNamedIn, mergeSlots, type Routed } from "@/lib/assistant/route";

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

  it("drops the payment term when the plan changes, because it belonged to the old plan", () => {
    const merged = mergeSlots(first, { intent: "quote", planCode: "ISHIELD" });
    expect(merged.planCode).toBe("ISHIELD");
    expect(merged.variant).toBeUndefined();
  });

  it("lets the newer turn win", () => {
    expect(mergeSlots(first, { intent: "quote", age: 50 }).age).toBe(50);
  });
});
