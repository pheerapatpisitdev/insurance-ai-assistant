import { describe, expect, it } from "vitest";
import { strayNumbers } from "@/lib/content/check";
import { numbersBody, numbersPoster, numbersYardstick } from "@/lib/content/numbers";
import { NUMBERS_PLANS, numberSheets } from "@/lib/content/numbers-plans";
import { MAX_CHARS } from "@/lib/content/poster";
import { CONTENT_PRODUCTS } from "@/lib/content/products";

const today = new Date("2026-09-24T12:00:00+07:00");
const RISING = ["/legacy", "/ci123", "/cancer", "/ihealthy-ultra"];

describe("every plan's number sheets", () => {
  it("covers every content plan", () => {
    expect(Object.keys(NUMBERS_PLANS).sort()).toEqual(CONTENT_PRODUCTS.map((p) => p.href).sort());
  });

  for (const href of Object.keys(NUMBERS_PLANS)) {
    describe(href, () => {
      const plan = NUMBERS_PLANS[href];
      it("prices all three people today", () => {
        for (let i = 0; i < plan.caseCount; i++) expect(plan.price(i, plan.claims.slice(0, 2), today)).not.toBeNull();
      });
      it("writes only figures it hands the number check, within the poster's limits", () => {
        for (const s of numberSheets(href, 3, today)) {
          expect(strayNumbers(`${numbersBody(s)}\n${s.poster.big}\n${s.poster.small}`, numbersYardstick([s]))).toEqual([]);
          for (const b of numbersPoster(s).blocks) expect(b.text.length).toBeLessThanOrEqual(MAX_CHARS[b.kind]);
        }
      });
      it("leaves no placeholder unfilled", () => {
        for (const s of numberSheets(href, 3, today)) expect(numbersBody(s)).not.toMatch(/[{}]/);
      });
      it(RISING.includes(href) ? "says เบี้ยปีแรก, its premium rises with age" : "says a level premium plainly", () => {
        for (const s of numberSheets(href, 3, today)) {
          expect(s.premiumLine.startsWith("เบี้ยปีแรก")).toBe(RISING.includes(href));
          expect(s.perDayLine.startsWith("ปีแรก")).toBe(RISING.includes(href));
        }
      });
    });
  }
});

describe("figures that match each sales page", () => {
  const first = (href: string) => numberSheets(href, 3, today);
  it("Protection Life: ชาย 35 ทุน 1 ล้าน 10 ปี = 5,130 บาท/ปี", () => {
    expect(first("/plb")[0].premiumLine).toBe("เบี้ย 5,130 บาท ต่อปี");
  });
  it("Easy Protect 6: ชาย 35 ทุน 5 แสน = 3,060 บาท/เดือน", () => {
    expect(first("/easyprotect")[0].premiumLine).toBe("เบี้ย 3,060 บาท ต่อเดือน");
  });
  it("Life Treasure: ชาย 45 ทุน 10 ล้าน 12 ปี = 42,750 บาท/เดือน", () => {
    expect(first("/lifetreasure")[0].premiumLine).toBe("เบี้ย 42,750 บาท ต่อเดือน");
  });
  it("Family Legacy: a critical illness pays 850,000 and a death before 60 1,150,000 on the 1-million plan", () => {
    const all = first("/legacy").flatMap((s) => s.claims).join("\n");
    expect(all).toContain("ป่วยโรคร้ายแรงรับเงินสด 850,000 บาท");
    expect(all).toContain("เสียชีวิตก่อน 60 รับ 1,150,000 บาท");
  });
  it("iShield: ชาย 35 ทุน 1 ล้าน 10 ปี = 6,028 บาท/เดือน", () => {
    expect(first("/ishield")[0].premiumLine).toBe("เบี้ย 6,028 บาท ต่อเดือน");
  });
  it("CI 123: หญิง 30 ทุน 5 แสน = เบี้ยปีแรก 3,613", () => {
    expect(first("/ci123")[0].premiumLine).toBe("เบี้ยปีแรก 3,613 บาท ต่อปี");
  });
  it("Cancer: หญิง 30 ทุน 3 แสน = เบี้ยปีแรก 2,176", () => {
    expect(first("/cancer")[0].premiumLine).toBe("เบี้ยปีแรก 2,176 บาท ต่อปี");
  });
  it("iHealthy: the package's yearly limit leads", () => {
    expect(first("/ihealthy-ultra")[0].sumLine).toBe("ประกันสุขภาพวงเงินค่ารักษาปีละ 3,000,000 บาท");
  });
  it("Pension: ชาย 40 เดือนละ 10,000 from 60 — 136,220.54 a year, so 374 a day", () => {
    const [s] = first("/bumnan95");
    expect(s.sumLine).toBe("บำนาญเดือนละ 10,000 บาท");
    expect(s.perDayLine).toBe("ตกวันละ 374 บาท");
  });
});
