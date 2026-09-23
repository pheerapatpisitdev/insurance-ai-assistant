import { describe, expect, it } from "vitest";
import { findWords, numbersIn, strayNumbers, type ContentWord } from "@/lib/content/check";

/**
 * The check that stands between a model's arithmetic and a post the owner puts their name to.
 *
 * A number in the output that was not in what the model was given is one it made up — or
 * worked out, which for a premium is the same thing, because this system's rule is that every
 * premium a customer sees comes from the tables and nothing else.
 */

describe("numbersIn", () => {
  it("reads the ways Thai copy writes an amount as the one value", () => {
    expect(numbersIn("ทุน 1,000,000 บาท")).toContain(1_000_000);
    expect(numbersIn("ทุน 1 ล้าน")).toContain(1_000_000);
    expect(numbersIn("ทุน 1.5 ล้านบาท")).toContain(1_500_000);
    expect(numbersIn("5 แสน")).toContain(500_000);
    expect(numbersIn("2 หมื่น")).toContain(20_000);
    expect(numbersIn("3 พันบาท")).toContain(3_000);
    expect(numbersIn("เบี้ย 12,345.50 บาท")).toContain(12_345.5);
  });

  it("does not read a time marker in a script as an amount", () => {
    expect(numbersIn("[0–3 วิ] สวัสดีครับ [3–20 วิ] เนื้อหา")).toEqual([]);
  });
});

describe("strayNumbers", () => {
  const brief = "หญิงอายุ 30 ทุน 100,000 บาท เบี้ย 1,234 บาทต่อปี วันละ 3.38 บาท คุ้มครองถึงอายุ 99 ปี จ่าย 200%";

  it("passes an output whose every amount came from the brief, however it is written", () => {
    expect(strayNumbers("ทุนแค่ 1 แสน จ่ายปีละ 1,234 บาท ตกวันละ 3.38 บาท คุ้มครองถึง 99", brief)).toEqual([]);
  });

  it("names an amount the brief never had", () => {
    expect(strayNumbers("จ่ายเดือนละ 89 บาท ได้ทุน 5 แสน", brief)).toEqual(["89 บาท", "5 แสน"]);
  });

  it("leaves small counts alone unless they are money or a percentage", () => {
    // "3 เหตุผล", "2 นาที" are the copy's own counting, not claims
    expect(strayNumbers("3 เหตุผลที่ควรมี ใช้เวลา 2 นาที", brief)).toEqual([]);
    expect(strayNumbers("คืนเงิน 150%", brief)).toEqual(["150%"]);
  });
});

describe("findWords", () => {
  const words: ContentWord[] = [
    { word: "การันตี", kind: "banned", fix: null },
    { word: "ดีที่สุด", kind: "banned", fix: null },
    { word: "คุ้มคลอง", kind: "misspelling", fix: "คุ้มครอง" },
  ];

  it("finds a banned word and a misspelling with its fix, in reading order", () => {
    const hits = findWords("แบบนี้การันตีดีที่สุด คุ้มคลองครบ", words);
    expect(hits.map((h) => h.word)).toEqual(["การันตี", "ดีที่สุด", "คุ้มคลอง"]);
    expect(hits[2].fix).toBe("คุ้มครอง");
  });

  it("lets a banned word through when the copy is denying it", () => {
    // "เงินปันผลไม่การันตี" is the honest sentence the rule exists to encourage
    expect(findWords("เงินปันผลไม่การันตี", words)).toEqual([]);
    expect(findWords("ไม่การันตี แต่การันตีทุน", words).map((h) => h.word)).toEqual(["การันตี"]);
  });

  it("finds nothing in clean copy", () => {
    expect(findWords("คุ้มครองชีวิตถึงอายุ 99 ปี", words)).toEqual([]);
  });
});
