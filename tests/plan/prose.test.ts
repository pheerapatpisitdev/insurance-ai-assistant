import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/ai/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/ai/client")>()),
  chat: vi.fn(),
}));

import { chat } from "@/lib/ai/client";
import { explain, FALLBACK_PROSE, parseProse, planBrief } from "@/lib/plan/prose";
import type { PlanInput } from "@/lib/plan/needs";
import type { PlanResult } from "@/lib/plan/recommend";

const P: PlanInput = {
  age: 35, sex: "M", income: 50_000, expense: 25_000, savings: 0, children: [5], otherDependants: false,
  debts: 0, lifeCover: 0, ciCover: 0, healthNow: "none", healthRoom: 0, premiumsNow: 0, hospital: "private", lifeWant: "save", budget: 4_000,
};
const R: PlanResult = {
  budget: 4_000, usedAnnual: 0, taxSaved: 0,
  areas: [
    { key: "life", unit: "sum", have: 0, should: 1, status: "fits" },
    { key: "health", unit: "room", have: 0, should: 1, status: "short" },
    { key: "ci", unit: "sum", have: 0, should: 1, status: "covered" },
    { key: "retire", unit: "pension", have: 0, should: 1, status: "unavailable" },
  ],
};

describe("parseProse", () => {
  it("keeps clean fields and replaces a field with a digit", () => {
    const p = parseProse(JSON.stringify({ intro: "สวัสดีครับ", life: "ทุน 4 ล้าน", health: "ดีครับ", ci: "ดี", retire: "ดี" }));
    expect(p.intro).toBe("สวัสดีครับ");
    expect(p.life).toBe(FALLBACK_PROSE.life);
    expect(p.health).toBe("ดีครับ");
  });
  it("falls back entirely on junk", () => {
    expect(parseProse("not json")).toEqual(FALLBACK_PROSE);
  });
});

describe("explain", () => {
  it("falls back when the model fails", async () => {
    vi.mocked(chat).mockRejectedValueOnce(new Error("down"));
    expect(await explain(P, R)).toEqual(FALLBACK_PROSE);
  });
  it("asks the small model once, as JSON", async () => {
    vi.mocked(chat).mockResolvedValueOnce({ text: JSON.stringify({ intro: "ก", life: "ข", health: "ค", ci: "ง", retire: "จ" }) } as never);
    const p = await explain(P, R);
    expect(p.retire).toBe("จ");
    expect(vi.mocked(chat).mock.calls.at(-1)![0]).toMatchObject({ tier: "small", task: "plan-advice", json: true });
  });
});

describe("planBrief", () => {
  it("says each area's status in words", () => {
    const b = planBrief(P, R);
    expect(b).toContain("มีพอแล้ว");
    expect(b).toContain("อายุเกินเกณฑ์");
  });
});
