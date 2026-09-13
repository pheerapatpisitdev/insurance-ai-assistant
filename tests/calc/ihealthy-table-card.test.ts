import { describe, expect, it } from "vitest";
import { iHealthyCard, iHealthyTableCard } from "@/lib/ihealthy-card";

const query = (extra: Record<string, string> = {}) =>
  new URLSearchParams({ age: "35", sex: "F", plan: "GOLD", fit: "phone", ...extra });

describe("the comparison table on its own", () => {
  it("says who it is for and what it rides on", () => {
    const card = iHealthyTableCard(query());
    expect(card.headLine).toBe("iHealthy Ultra · เปรียบเทียบแผน");
    expect(card.insuredLine).toContain("หญิง 35 ปี");
    expect(card.insuredLine).toContain("150,000");
    expect(card.insuredLine).toContain("ประเทศไทย");
  });

  it("singles out no plan, because none has been chosen", () => {
    const card = iHealthyTableCard(query());
    expect(card.columns.map((c) => c.name)).toEqual(["Bronze", "Silver", "Gold"]);
    expect(card.columns.every((c) => c.selected === false)).toBe(true);
  });

  it("says the same thing as the table under a quote card", () => {
    const q = query();
    const quote = iHealthyCard(new URLSearchParams(q));
    const table = iHealthyTableCard(new URLSearchParams(q));
    expect(table.rows).toEqual(quote.rows);
    expect(table.premiumRows).toEqual(quote.premiumRows);
  });

  it("says what the premium rows are made of", () => {
    const card = iHealthyTableCard(query());
    expect(card.notes[0]).toContain("เบี้ยรวมสัญญาหลัก ค่ารักษา และค่าชดเชยรายวัน");
    expect(card.notes.some((n) => n.includes("เบี้ยปีแรก"))).toBe(true);
    expect(card.notes.some((n) => n.includes("ไม่ใช่ใบเสนอราคา"))).toBe(true);
  });

  it("shows a child only the plans a child may buy", () => {
    const card = iHealthyTableCard(query({ age: "8", plan: "SMART" }));
    expect(card.columns.map((c) => c.name)).toEqual(["Smart", "Bronze"]);
  });
});
