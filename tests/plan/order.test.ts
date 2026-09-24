import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/ai/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/ai/client")>()),
  chat: vi.fn(),
}));

import { chat } from "@/lib/ai/client";
import { FIXED_PICK, fixedSummary, isOrder, ORDER_TIMEOUT_MS, orderBrief, parseOrder, pickOrder } from "@/lib/plan/order";
import type { PlanInput } from "@/lib/plan/needs";

const P: PlanInput = {
  age: 35, sex: "M", income: 50_000, expense: 25_000, savings: 0, children: [5], otherDependants: false,
  debts: 0, lifeCover: 0, ciCover: 0, healthNow: "none", healthRoom: 0, premiumsNow: 0, hospital: "private", lifeWant: "save",
  retireAge: 60, retireMonthly: 17_500, pensionHave: 0, retireLump: 0, budget: 4_000,
};

afterEach(() => vi.useRealTimers());

describe("isOrder", () => {
  it("wants the four areas, each once", () => {
    expect(isOrder(["retire", "ci", "health", "life"])).toBe(true);
    expect(isOrder(["life", "life", "ci", "retire"])).toBe(false);
    expect(isOrder(["life", "health", "ci"])).toBe(false);
    expect(isOrder("life")).toBe(false);
  });
});

describe("parseOrder", () => {
  it("takes a full order and a clean summary", () => {
    const p = parseOrder(JSON.stringify({ order: ["health", "life", "ci", "retire"], summary: "เริ่มที่สุขภาพก่อนครับ" }));
    expect(p).toEqual({ order: ["health", "life", "ci", "retire"], by: "ai", summary: "เริ่มที่สุขภาพก่อนครับ" });
  });
  it.each([
    [["life", "life", "ci", "retire"]], [["life", "health", "ci"]], [["life", "health", "ci", "tax"]], ["life"],
  ])("falls back to the fixed order on %j", (order) => {
    expect(parseOrder(JSON.stringify({ order, summary: "ดี" }))).toEqual(FIXED_PICK);
  });
  it("keeps a good order but replaces a summary with a digit, or one too long", () => {
    const withDigit = parseOrder(JSON.stringify({ order: ["ci", "life", "health", "retire"], summary: "ทุน 3 ล้าน" }));
    expect(withDigit.by).toBe("ai");
    expect(withDigit.summary).toBe(fixedSummary("ci"));
    const long = parseOrder(JSON.stringify({ order: ["ci", "life", "health", "retire"], summary: "ก".repeat(451) }));
    expect(long.summary).toBe(fixedSummary("ci"));
  });
  it("falls back on junk", () => {
    expect(parseOrder("not json")).toEqual(FIXED_PICK);
  });
});

describe("pickOrder", () => {
  it("asks the small model as JSON", async () => {
    vi.mocked(chat).mockResolvedValueOnce({ text: JSON.stringify({ order: ["retire", "health", "ci", "life"], summary: "ก" }) } as never);
    expect((await pickOrder(P)).order[0]).toBe("retire");
    expect(vi.mocked(chat).mock.calls.at(-1)![0]).toMatchObject({ tier: "small", task: "plan-order", json: true });
  });
  it("falls back when the model fails", async () => {
    vi.mocked(chat).mockRejectedValueOnce(new Error("down"));
    expect(await pickOrder(P)).toEqual(FIXED_PICK);
  });
  it("falls back when the model is too slow", async () => {
    vi.useFakeTimers();
    vi.mocked(chat).mockReturnValueOnce(new Promise(() => {}));
    const pending = pickOrder(P);
    await vi.advanceTimersByTimeAsync(ORDER_TIMEOUT_MS);
    expect(await pending).toEqual(FIXED_PICK);
  });
});

describe("orderBrief", () => {
  it("gives the model each area's gap and the retirement answers", () => {
    const b = orderBrief(P);
    expect(b).toContain("life: ควรมีทุน");
    expect(b).toContain("retire: อยากเกษียณอายุ 60");
  });
});
