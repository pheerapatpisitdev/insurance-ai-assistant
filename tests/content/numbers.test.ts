import { describe, expect, it } from "vitest";
import { anglesFor, NUMBERS_HREFS } from "@/lib/content/prompt";

describe("anglesFor", () => {
  it("offers ตัวเลขชัดๆ only for a post on a plan that has number cases", () => {
    expect(anglesFor("post", "/lifeprotect").some((a) => a.id === "numbers")).toBe(true);
    expect(anglesFor("ad", "/lifeprotect").some((a) => a.id === "numbers")).toBe(false);
    expect(anglesFor("script", "/lifeprotect").some((a) => a.id === "numbers")).toBe(false);
    expect(anglesFor("post", "/plb").some((a) => a.id === "numbers")).toBe(false);
  });
  it("keeps every other angle everywhere", () => {
    expect(anglesFor("ad", "/plb").map((a) => a.id)).toContain("family");
  });
  it("names Life Protect in phase 1", () => {
    expect(NUMBERS_HREFS).toEqual(["/lifeprotect"]);
  });
});

import { numbersBody, numbersPoster, numbersYardstick, safeHeadline, type NumberSheet } from "@/lib/content/numbers";
import { strayNumbers } from "@/lib/content/check";
import { MAX_CHARS } from "@/lib/content/poster";

const sheet: NumberSheet = {
  product: "Life Protect x 2",
  sumLine: "ประกันชีวิตทุน 1,000,000 บาท",
  premiumLine: "เบี้ย 1,548 บาท ต่อเดือน",
  perDayLine: "ตกวันละ 48 บาท",
  claims: ["เบี้ยไม่เพิ่ม", "เสียชีวิตก่อน 60 รับ 2,000,000 บาท"],
  who: "ชาย 35 ปี จ่ายถึงอายุ 99",
  poster: { big: "เบี้ย 1,548 บาท/เดือน", small: "ทุน 1,000,000 บาท · ตกวันละ 48 บาท" },
};

describe("a number sheet", () => {
  it("reads as the owner's example", () => {
    expect(numbersBody(sheet)).toBe(
      "ประกันชีวิตทุน 1,000,000 บาท\nเบี้ย 1,548 บาท ต่อเดือน\nตกวันละ 48 บาท\nเบี้ยไม่เพิ่ม\nเสียชีวิตก่อน 60 รับ 2,000,000 บาท\n(ชาย 35 ปี จ่ายถึงอายุ 99)",
    );
  });
  it("hands the number check every figure it wrote", () => {
    expect(strayNumbers(numbersBody(sheet) + "\n" + sheet.poster.big + "\n" + sheet.poster.small, numbersYardstick([sheet]))).toEqual([]);
  });
  it("fits the poster's line limits", () => {
    const p = numbersPoster(sheet);
    for (const b of p.blocks) expect(b.text.length).toBeLessThanOrEqual(MAX_CHARS[b.kind]);
    expect(p.blocks.find((b) => b.kind === "headline")?.text).toBe("เบี้ย 1,548 บาท/เดือน");
  });
});

describe("safeHeadline", () => {
  it("keeps a headline without digits", () => {
    expect(safeHeadline("ความคุ้มครองก้อนใหญ่ ในเบี้ยที่จ่ายไหว", "สำรอง")).toBe("ความคุ้มครองก้อนใหญ่ ในเบี้ยที่จ่ายไหว");
  });
  it("falls back on any digit, Thai digits too, or on nothing", () => {
    expect(safeHeadline("วันละ 48 บาทเอง", "สำรอง")).toBe("สำรอง");
    expect(safeHeadline("วันละ ๔๘ บาท", "สำรอง")).toBe("สำรอง");
    expect(safeHeadline("  ", "สำรอง")).toBe("สำรอง");
  });
});
