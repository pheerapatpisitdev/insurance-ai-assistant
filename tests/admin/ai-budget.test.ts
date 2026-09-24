import { describe, expect, it } from "vitest";
import { checkBudgets, MAX_BUDGET_THB } from "@/app/admin/ai/budget";

/**
 * The two budget boxes on /admin/ai.
 *
 * A monthly budget of 0 was stored, shown as "ยังไม่ได้ตั้งงบ", and read by the AI client as a
 * ฿0 ceiling — every customer's answer stopped. Empty is the only way to say "no limit".
 */
describe("the budget boxes", () => {
  it("takes empty as no limit, and empty content as the ฿30 default", () => {
    expect(checkBudgets("", "", 30)).toEqual({ ok: true, monthly: null, content: null });
  });

  it("refuses 0 and negatives for the month, saying how to mean no limit", () => {
    for (const v of ["0", "-5", "0.00"]) {
      const r = checkBudgets(v, "", 30);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toBe("งบต้องมากกว่า 0 — ถ้าไม่อยากจำกัดให้เว้นว่าง");
    }
  });

  it("refuses what is not a number, and what is absurdly large", () => {
    expect(checkBudgets("abc", "", 30).ok).toBe(false);
    expect(checkBudgets("1e3", "", 30).ok).toBe(false);
    expect(checkBudgets(String(MAX_BUDGET_THB + 1), "", 30).ok).toBe(false);
    expect(checkBudgets("500", "xyz", 30).ok).toBe(false);
    expect(checkBudgets("500", "-1", 30).ok).toBe(false);
  });

  it("accepts amounts a step of 50 or 10 used to block", () => {
    expect(checkBudgets("120", "25", 30)).toEqual({ ok: true, monthly: 120, content: 25 });
    expect(checkBudgets("1,000", "12.345", 30)).toEqual({ ok: true, monthly: 1000, content: 12.35 });
  });

  it("allows content 0, which stops the workbench and nothing else", () => {
    expect(checkBudgets("500", "0", 30)).toEqual({ ok: true, monthly: 500, content: 0 });
  });

  it("checks content against the month using the effective figure, default included", () => {
    const typed = checkBudgets("100", "250", 30);
    expect(typed.ok).toBe(false);
    if (!typed.ok) expect(typed.error).toContain("ต้องไม่เกินงบรวมต่อเดือน");

    // empty content means ฿30, which does not fit inside ฿20
    const empty = checkBudgets("20", "", 30);
    expect(empty.ok).toBe(false);
    if (!empty.ok) expect(empty.error).toContain("เว้นว่างไว้คือ ฿30");

    expect(checkBudgets("30", "", 30).ok).toBe(true);
    expect(checkBudgets("", "250", 30).ok).toBe(true);
  });
});
