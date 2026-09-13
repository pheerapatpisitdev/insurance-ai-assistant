import { describe, expect, it } from "vitest";
import benefits from "../../data/riders/ihealthy-ultra.json";

// The JSON holds two kinds of row — a bare section heading and a benefit — so TypeScript reads
// benefits.rows as a union in which "adult" may be missing. The lookup is by section number,
// which only a benefit row has, so the cast says what the find already guarantees.
type BenefitRow = {
  no: number | null;
  title: string;
  endorsement: boolean;
  adult: Record<string, string>;
  child?: Record<string, string>;
};
const rows = benefits.rows as unknown as Array<Partial<BenefitRow> & { heading?: string }>;
const row = (no: number) => benefits.rows.find((r) => "no" in r && r.no === no)! as unknown as BenefitRow;

describe("iHealthy Ultra benefit data", () => {
  it("carries the six plans with the company's annual maximum", () => {
    expect(benefits.plans.map((p) => [p.code, p.annualMax])).toEqual([
      ["SMART", 3_000_000],
      ["BRONZE", 10_000_000],
      ["SILVER", 15_000_000],
      ["GOLD", 25_000_000],
      ["DIAMOND", 70_000_000],
      ["PLATINUM", 100_000_000],
    ]);
  });

  it("ties the deductible to the plan the way the workbook's I4 does", () => {
    expect(benefits.plans.map((p) => p.deductible)).toEqual([30_000, 30_000, 50_000, 50_000, 100_000, 100_000]);
    expect(benefits.copayPercent).toBe(20);
  });

  it("reads the room rate of หมวด 1", () => {
    expect(row(1).adult).toMatchObject({
      SMART: "1,500 ต่อวัน", BRONZE: "3,000 ต่อวัน", SILVER: "5,500 ต่อวัน",
      GOLD: "9,000 ต่อวัน", DIAMOND: "15,000 ต่อวัน", PLATINUM: "21,000 ต่อวัน",
    });
  });

  it("keeps the child column only where it differs from the adult one", () => {
    expect(row(3).child).toEqual({
      SMART: "1,000 ต่อวัน*/ ตามที่จ่ายจริง",
      BRONZE: "3,000 ต่อวัน*/ ตามที่จ่ายจริง",
    });
    expect(row(1).child).toBeUndefined();
  });

  it("resolves the merged OPD cell that หมวด 18 and 19 share", () => {
    expect(row(18).adult).toEqual({
      SMART: "-", BRONZE: "-", SILVER: "6000",
      GOLD: "12000", DIAMOND: "60000", PLATINUM: "ตามที่จ่ายจริง",
    });
    expect(row(19).adult).toEqual(row(18).adult);
  });

  it("reads the benefits only แพลทินั่ม has", () => {
    expect(row(24).adult.PLATINUM).toBe("400000");
    expect(row(28).adult.PLATINUM).toBe("1000000");
    expect(row(24).adult.DIAMOND).toBe("-");
  });

  it("marks หมวด 8 as covered by nobody", () => {
    expect(Object.values(row(8).adult).every((v) => v === "ไม่คุ้มครอง")).toBe(true);
  });

  it("splits the contract into the sections the page shows", () => {
    expect(benefits.rows.filter((r) => "no" in r && r.endorsement).map((r) => r.no))
      .toEqual([14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28]);
  });

  it("keeps every row of the table, headings and sub-rows alike", () => {
    // A drifting LAST_ROW or SKIP_ROWS would drop a whole section without failing anything
    // else here, so the inventory is pinned: 5 group headings (หมวด 2, 4 and 6 carry no
    // figures of their own, and the two ผู้ป่วยใน/ผู้ป่วยนอก banners), 36 benefit rows, of
    // which 11 are the หมวดย่อย sub-rows that have no section number.
    expect(rows).toHaveLength(41);
    expect(rows.filter((r) => r.heading)).toHaveLength(5);
    expect(rows.filter((r) => r.adult)).toHaveLength(36);
    expect(rows.filter((r) => r.adult && r.no === null)).toHaveLength(11);
    expect(rows.filter((r) => r.adult && r.no !== null)).toHaveLength(25);
    // the two words each heading opens with: the banners in full, the หมวด rows by number
    expect(rows.filter((r) => r.heading).map((r) => r.heading!.split(" ").slice(0, 2).join(" "))).toEqual([
      "1. ผลประโยชน์กรณีผู้ป่วยใน",
      "หมวดที่ 2",
      "หมวดที่ 4",
      "2. ผลประโยชน์กรณีไม่ต้องเข้าพักรักษาตัวเป็นผู้ป่วยใน",
      "หมวดที่ 6",
    ]);
  });

  it("carries the waiting periods and the renewal rules as text", () => {
    expect(benefits.terms.renewalToAge).toBe(98);
    expect(benefits.terms.waitingDays).toBe(30);
    expect(benefits.terms.specialWaitingDays).toBe(120);
    expect(benefits.terms.specialWaitingDiseases).toEqual([
      "เนื้องอก ถุงน้ำ หรือมะเร็งทุกชนิด",
      "ริดสีดวงทวาร",
      "ไส้เลื่อนทุกชนิด",
      "ต้อเนื้อ หรือต้อกระจก",
      "การตัดทอนซิล หรืออดีนอยด์",
      "นิ่วทุกชนิด",
      "เส้นเลือดขอดที่ขา",
      "เยื่อบุโพรงมดลูกเจริญผิดที่",
    ]);
    expect(benefits.terms.noClaimDiscountPercent).toBe(10);
    expect(benefits.terms.outOfTerritoryDays).toBe(90);
    expect(benefits.disclaimer).toContain("เอกสารประกอบการเสนอขาย");
  });

  it("carries every contract paragraph the page prints", () => {
    const paragraphs = [
      "renewalCopay", "preExisting", "exclusions", "premiumChanges",
      "outOfTerritory", "noClaimDiscount", "sharedLimit", "participationNote",
    ] as const;
    for (const key of paragraphs) {
      expect(benefits.terms[key].length, `${key} is empty`).toBeGreaterThan(40);
    }
    // the figures the JSON states as numbers have to still be the ones the prose states
    expect(benefits.terms.renewalCopay).toContain("ต่ออายุได้ถึงอายุ 98 ปี");
    expect(benefits.terms.outOfTerritory).toContain("90 วัน");
    expect(benefits.terms.noClaimDiscount).toContain("ร้อยละ 10");
    expect(benefits.terms.exclusions).toContain("21 ข้อ");
  });
});

describe("the limits the sheet keeps in a column of its own", () => {
  const capped = rows.filter((r) => "limit" in r) as Array<BenefitRow & { limit: string }>;

  /**
   * Two rows say "ตามที่จ่ายจริง" and are capped by count rather than by money. The extract
   * read only the first column of each plan's triple, so both were published as cover with no
   * limit on them — on the wide table and on the printed sheet a customer is handed.
   */
  it("keeps the per-admission caps the contract sets", () => {
    expect(capped).toHaveLength(2);
    expect(capped[0].title).toContain("หมวดย่อยที่ 2.4");
    expect(capped[0].limit).toBe("15 วัน ต่อการเข้าพักรักษาตัวเป็นผู้ป่วยในแต่ละครั้ง");
    expect(capped[1].title).toContain("หมวดย่อยที่ 6.2");
    expect(capped[1].limit).toBe("2 ครั้ง ต่อการเข้าพักรักษาตัวเป็นผู้ป่วยในแต่ละครั้ง");
    // both pay as charged, which is exactly why the cap has to travel with them
    for (const one of capped) expect(one.adult.PLATINUM).toBe("ตามที่จ่ายจริง");
  });

  /**
   * The sheet marks three titles with "**" or "***" and defines neither anywhere on it; only
   * "*" has a note. A reference to a note that does not exist points at nothing on a page a
   * customer reads, so the extract drops those marks.
   */
  it("carries no reference mark the sheet has no note for", () => {
    for (const one of rows) expect(one.title ?? one.heading ?? "").not.toMatch(/\*{2,}/);
    expect(benefits.terms.participationNote.startsWith("*")).toBe(true);
  });
});
