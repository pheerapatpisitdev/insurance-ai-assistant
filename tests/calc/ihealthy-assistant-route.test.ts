import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatOptions } from "@/lib/ai/client";

let routed: Record<string, unknown> = { intent: "other" };
const chat = vi.fn(async (_: ChatOptions) => ({
  text: JSON.stringify(routed), model: "stub", provider: "stub",
  inputTokens: 0, outputTokens: 0, costThb: 0,
}));
vi.mock("@/lib/ai/client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/ai/client")>("@/lib/ai/client");
  return { ...actual, chat };
});

const {
  asksFullTable, asksOtherPlans, asksShareOfBill, planNamedIn, routeHealth, territoryNamedIn,
} = await import("@/lib/assistant/ihealthy/route");

const said = (content: string) => [{ role: "user" as const, content }];
beforeEach(() => { chat.mockClear(); routed = { intent: "other" }; });

describe("a plan named in a message", () => {
  it("is read in Thai and in English", () => {
    expect(planNamedIn("เอาโกลด์")).toBe("GOLD");
    expect(planNamedIn("ขอ platinum")).toBe("PLATINUM");
    expect(planNamedIn("ไดมอนด์เท่าไหร่")).toBe("DIAMOND");
    expect(planNamedIn("สมาร์ทพอ")).toBe("SMART");
    expect(planNamedIn("บรอนซ์")).toBe("BRONZE");
    expect(planNamedIn("ซิลเวอร์")).toBe("SILVER");
  });

  it("is not guessed from a word that is not a plan", () => {
    expect(planNamedIn("แผนกลางๆ")).toBeUndefined();
    expect(planNamedIn("ถูกสุดเลย")).toBeUndefined();
  });
});

describe("a territory named in a message", () => {
  it("is read as the label the rate table spells", () => {
    expect(territoryNamedIn("คุ้มครองเอเชียด้วยไหม")).toBe("เอเชีย");
    expect(territoryNamedIn("อยากได้ทั่วโลก")).toBe("ทั่วโลก");
    expect(territoryNamedIn("รักษาต่างประเทศได้ไหม")).toBe("ทั่วโลก");
    expect(territoryNamedIn("ในไทยพอ")).toBe("ประเทศไทย");
  });

  it("is nothing when the message names none", () => {
    expect(territoryNamedIn("โกลด์เท่าไหร่")).toBeUndefined();
  });
});

describe("the questions answered without a model", () => {
  it("hears someone asking to share the bill", () => {
    for (const s of ["มีแบบรับผิดส่วนแรกไหม", "แบบร่วมจ่ายถูกกว่าไหม", "deductible เท่าไหร่", "copay"]) {
      expect(asksShareOfBill(s)).toBe(true);
    }
    expect(asksShareOfBill("โกลด์เท่าไหร่")).toBe(false);
  });

  it("hears someone asking for the whole benefit sheet", () => {
    for (const s of ["ขอตารางเต็ม", "ดูทุกหมวด", "ตารางผลประโยชน์ทั้งหมด"]) {
      expect(asksFullTable(s)).toBe(true);
    }
  });

  it("hears someone asking what else there is", () => {
    for (const s of ["ดูแผนอื่น", "มีแผนอื่นไหม", "แผนอื่นล่ะ"]) expect(asksOtherPlans(s)).toBe(true);
    expect(asksOtherPlans("โกลด์เท่าไหร่")).toBe(false);
  });
});

describe("what the model is allowed to fill in", () => {
  it("keeps the age and sex the message itself names, over the model's", async () => {
    routed = { intent: "quote", age: 99, sex: "M" };
    const slots = await routeHealth(said("หญิง 35 สนใจค่ะ"), null);
    expect(slots).toMatchObject({ product: "ihealthy", age: 35, sex: "F" });
  });

  it("keeps the plan the message names, over the model's", async () => {
    routed = { intent: "quote", plan: "SMART" };
    const slots = await routeHealth(said("เอาไดมอนด์"), null);
    expect(slots.plan).toBe("DIAMOND");
  });

  it("refuses a plan the company does not sell", async () => {
    routed = { intent: "quote", plan: "TITANIUM" };
    const slots = await routeHealth(said("ขอราคา"), null);
    expect(slots.plan).toBeUndefined();
  });

  it("carries the age and sex forward, and lets a new plan replace an old one", async () => {
    routed = { intent: "quote" };
    const slots = await routeHealth(said("โกลด์"), {
      product: "ihealthy", intent: "quote", age: 35, sex: "F", plan: "BRONZE",
    });
    expect(slots).toMatchObject({ age: 35, sex: "F", plan: "GOLD" });
  });

  it("reads an age out of a birthdate rather than trusting the model with the arithmetic", async () => {
    routed = { intent: "quote", age: 43 };
    const slots = await routeHealth(said("เกิด 14/12/2523 ผู้หญิง"), null);
    expect(slots.age).toBe(45);
    expect(slots.sex).toBe("F");
  });
});
