import { describe, expect, it } from "vitest";
import { avoidSection, parsePlans, planMessages } from "@/lib/content/plan";
import { hookTemplateSection, parseTemplatize } from "@/lib/content/hooks";

describe("parsePlans", () => {
  it("reads angles and hooks, and uses the hook as the angle when none came", () => {
    const reply = JSON.stringify({ plans: [{ angle: "มุมพ่อแม่", hook: "ถ้าพรุ่งนี้…" }, { hook: "วันละ 20 บาท" }] });
    expect(parsePlans(reply, 2)).toEqual([
      { angle: "มุมพ่อแม่", hook: "ถ้าพรุ่งนี้…" },
      { angle: "วันละ 20 บาท", hook: "วันละ 20 บาท" },
    ]);
  });

  it("cuts a generous planner down to what was asked", () => {
    const reply = JSON.stringify({ plans: [{ hook: "a" }, { hook: "b" }, { hook: "c" }] });
    expect(parsePlans(reply, 2)).toHaveLength(2);
  });

  it("drops a plan with no hook, and gives up when none is left", () => {
    expect(parsePlans(JSON.stringify({ plans: [{ angle: "x" }, { hook: "b" }] }), 2)).toEqual([{ angle: "b", hook: "b" }]);
    expect(parsePlans(JSON.stringify({ plans: [{ angle: "x" }] }), 1)).toBeNull();
    expect(parsePlans("ไม่ใช่ JSON", 1)).toBeNull();
  });
});

describe("planMessages", () => {
  it("carries the formula and the hooks already used, when there are any", () => {
    const [, user] = planMessages({
      brief: "ข้อมูล", count: 3, angle: "",
      avoid: ["ถ้าพรุ่งนี้ไม่มีเรา"],
      template: { template: "[N] เรื่องที่ควรรู้ก่อนซื้อ[ผลิตภัณฑ์]", category: "LIST" },
    });
    expect(user.content).toContain("- ถ้าพรุ่งนี้ไม่มีเรา");
    expect(user.content).toContain("[N] เรื่องที่ควรรู้ก่อนซื้อ[ผลิตภัณฑ์]");
    expect(user.content).toContain("วางแผน 3 ชิ้น");
  });

  it("plans hooks for the reader and the story the owner gave", () => {
    const [, user] = planMessages({ brief: "ข้อมูล", count: 2, angle: "", avoid: [], template: null, reader: "ฟรีแลนซ์", fact: "ลูกค้าถามว่าป่วยแล้วซื้อได้ไหม" });
    expect(user.content).toContain("คนอ่านคือ: ฟรีแลนซ์");
    expect(user.content).toContain("ลูกค้าถามว่าป่วยแล้วซื้อได้ไหม");
  });

  it("says nothing about avoiding when nothing has been used yet", () => {
    expect(avoidSection([])).toBe("");
    const [, user] = planMessages({ brief: "ข้อมูล", count: 1, angle: "", avoid: [], template: null });
    expect(user.content).not.toContain("ใช้ไปแล้ว");
  });
});

describe("hook formulas", () => {
  it("draws a formula with slots out of a hook", () => {
    expect(parseTemplatize(JSON.stringify({ template: "[N] เรื่องที่ควรรู้ก่อนซื้อ[ผลิตภัณฑ์]", category: "LIST" })))
      .toEqual({ template: "[N] เรื่องที่ควรรู้ก่อนซื้อ[ผลิตภัณฑ์]", category: "LIST" });
  });

  it("refuses a copy with no slot, an unknown category, or a skip", () => {
    expect(parseTemplatize(JSON.stringify({ template: "ถ้าพรุ่งนี้ไม่มีเรา", category: "CLAIM" }))).toBeNull();
    expect(parseTemplatize(JSON.stringify({ template: "[N] ข้อ", category: "OTHER" }))).toBeNull();
    expect(parseTemplatize(JSON.stringify({ skip: true }))).toBeNull();
  });

  it("binds the round to the formula, and tells a count from a figure", () => {
    // the first formula round filled "[N] เรื่องที่ควรรู้" with the 9 of "จ่าย 9 ปี"
    const s = hookTemplateSection({ template: "[N] ข้อ", category: "LIST" });
    expect(s).toContain("ห้ามเปลี่ยนโครงประโยค");
    expect(s).toContain("ไม่ใช่ตัวเลขจากข้อมูลผลิตภัณฑ์");
    expect(s).toContain("ต้องคัดลอกจากข้อมูลผลิตภัณฑ์ตรงตัว");
  });
});
