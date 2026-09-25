import { describe, expect, it } from "vitest";
import { briefFor } from "@/lib/content/brief";
import { CONTENT_PRODUCTS } from "@/lib/content/products";
import { lifelong, lifelongOutput } from "@/lib/content/wording";

describe("ตลอดชีพ for cover to 99 (owner, 2026-09-25)", () => {
  it("says the verb, then ตลอดชีพ", () => {
    expect(lifelong("คุ้มครองถึงอายุ 99")).toBe("คุ้มครองตลอดชีพ");
    expect(lifelong("ชาย 35 ปี จ่ายถึงอายุ 99")).toBe("ชาย 35 ปี จ่ายตลอดชีพ");
    expect(lifelong("(หรือจ่ายถึงอายุ 99 ปี)")).toBe("(หรือจ่ายตลอดชีพ)");
    expect(lifelong("จ่าย 9 ปี ประหยัดกว่าจ่ายถึง 99 ปี")).toBe("จ่าย 9 ปี ประหยัดกว่าจ่ายตลอดชีพ");
    expect(lifelong("คุ้มครองยาว 99 ปี")).toBe("คุ้มครองยาว ตลอดชีพ");
  });

  it("leaves other nineties and other ages alone", () => {
    for (const t of ["คุ้มครองถึงอายุ 85", "ทุน 1,099 บาท", "199 ปี", "อายุ 9 ปี", "WLF99H"]) expect(lifelong(t)).toBe(t);
  });

  it("reaches every line of a piece, the poster's too", () => {
    const o = lifelongOutput({
      hooks: ["คุ้มครองถึงอายุ 99"], body: "จ่ายถึงอายุ 99", closing: "x",
      poster: { blocks: [{ kind: "headline", text: "ถึง 99 ปี" }] },
    });
    expect([...o.hooks, o.body, o.poster!.blocks[0].text]).toEqual(["คุ้มครองตลอดชีพ", "จ่ายตลอดชีพ", "ตลอดชีพ"]);
  });
});

describe("what the writers are given about each plan", () => {
  const today = new Date("2026-09-25T12:00:00+07:00");
  for (const p of CONTENT_PRODUCTS) {
    it(`${p.name}: sums and premiums a month or a day — no totals, no year's premium, no 99`, () => {
      const text = briefFor(p.href, today)!.text;
      expect(text).not.toMatch(/รวมทั้งสัญญา|ถ้าจ่ายรายปี|เบี้ยปีแรกรวม/);
      expect(text).not.toMatch(/เบี้ย(?:ปีแรก)?\s*[\d,]+\s*บาท\s*(?:ต่อปี|\/ปี)|เบี้ยปีละ|บาท\/ปี/);
      expect(text).not.toMatch(/(?<![\d,.])99(?![\d,])/);
    });
  }
});
