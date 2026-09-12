import { describe, expect, it } from "vitest";
import type { IHealthyShown } from "@/components/IHealthyCalculator";
import { iHealthyMessage, iHealthyQuoteText, type IHealthyCtaFacts } from "@/lib/ihealthy-cta";

/** หญิง 35 · ไลฟ์ โพรเทค+ x 2 ทุน 150,000 · โกลด์ · ประเทศไทย — what the page opens on. */
const SHOWN: IHealthyShown = {
  base: 213_000,
  rider: 4_380_000,
  total: 4_593_000,
  belowMinimum: false,
  others: [{ mode: "semi", total: 2_388_300 }, { mode: "monthly", total: 413_300 }],
};

const GOLD = {
  planName: "Gold", annualMax: 25_000_000, territory: "ประเทศไทย",
  coverage: "Full Coverage", deductible: 50_000,
};

const facts: IHealthyCtaFacts = {
  arrangement: GOLD,
  copayPercent: 20,
  age: 35,
  sex: "F",
  baseLabel: "ไลฟ์ โพรเทค+ x 2",
  sumAssured: 150_000,
  death: { beforeAge: 60, sumBefore: 300_000, sumFrom: 150_000, alreadyPastAge: false },
  mode: "annual",
  minMonthly: 1_000,
  shown: SHOWN,
};

describe("iHealthyMessage", () => {
  it("opens the chat with what is on screen", () => {
    expect(iHealthyMessage(facts)).toBe(
      "สนใจประกันสุขภาพ iHealthy Ultra Gold ประเทศไทย หญิง 35 ปี เบี้ยรวมประมาณ 45,930 บาท/ปี",
    );
  });

  it("says which instalment the figure is", () => {
    expect(iHealthyMessage({ ...facts, mode: "monthly", shown: { ...SHOWN, total: 413_300 } }))
      .toBe("สนใจประกันสุขภาพ iHealthy Ultra Gold ประเทศไทย หญิง 35 ปี เบี้ยรวมประมาณ 4,133 บาท/เดือน");
  });

  /** An arrangement paid for out of pocket up to a point is not the same product. */
  it("names a coverage that is not the plain one", () => {
    expect(iHealthyMessage({ ...facts, arrangement: { ...GOLD, coverage: "Co-Payment" }, sex: "M" })).toBe(
      "สนใจประกันสุขภาพ iHealthy Ultra Gold ประเทศไทย แบบร่วมจ่าย ชาย 35 ปี เบี้ยรวมประมาณ 45,930 บาท/ปี",
    );
  });

  it("asks for a price instead when none is being shown", () => {
    expect(iHealthyMessage({ ...facts, shown: undefined })).toBe(
      "สนใจประกันสุขภาพ iHealthy Ultra Gold ประเทศไทย หญิง 35 ปี ขอราคาปัจจุบัน",
    );
  });

  /** A rate revision that withdrew every plan at an age would land here. */
  it("asks for something that fits when the age has no arrangement at all", () => {
    const none = { ...facts, arrangement: undefined, shown: undefined };
    expect(iHealthyMessage({ ...none, age: 79 })).toBe(
      "สนใจประกันสุขภาพ iHealthy Ultra หญิง 79 ปี ขอแบบที่เหมาะกับอายุนี้",
    );
    expect(iHealthyQuoteText(none)).toBeUndefined();
  });
});

describe("iHealthyQuoteText", () => {
  it("writes the summary an agent pastes into a chat", () => {
    expect(iHealthyQuoteText(facts)).toBe([
      "🏥 iHealthy Ultra Gold",
      "วงเงินค่ารักษา 25,000,000 บาทต่อปี · อาณาเขตประเทศไทย",
      "",
      "หญิง อายุ 35 ปี",
      "💰 เบี้ยรวมประมาณ 45,930 บาท/ปี",
      "- ไลฟ์ โพรเทค+ x 2 ทุน 150,000 บาท · 2,130 บาท",
      "- ค่ารักษาพยาบาล · 43,800 บาท",
      "",
      "รายเดือน 4,133 บาท",
      "ราย 6 เดือน 23,883 บาท",
      "รายปี 45,930 บาท",
      "",
      "👪 ครอบครัวได้รับเมื่อเสียชีวิต",
      "- เสียชีวิตก่อนอายุ 60 ปี 300,000 บาท",
      "- อายุ 60 ปีขึ้นไป 150,000 บาท",
      "",
      "📌 เบี้ยปีแรก เบี้ยปีต่อไปคิดตามอายุที่เพิ่มขึ้น",
      "เบี้ยของอาชีพชั้น 1 · ไม่ใช่ใบเสนอราคา เบี้ยและความคุ้มครองจริงเป็นไปตามผลการพิจารณารับประกันและที่ระบุในกรมธรรม์",
    ].join("\n"));
  });

  /**
   * The sentence that has to outlive the page. A quote in a chat has nothing around it to
   * say that the rider is priced on attained age, and a customer who reads 45,930 as the
   * price of the plan will meet three times that at seventy.
   */
  it("always says the premium is a first-year one, of an occupation class", () => {
    for (const mode of ["annual", "semi", "monthly"] as const) {
      const text = iHealthyQuoteText({ ...facts, mode })!;
      expect(text).toContain("เบี้ยปีแรก เบี้ยปีต่อไปคิดตามอายุที่เพิ่มขึ้น");
      expect(text).toContain("อาชีพชั้น 1");
      // the sentence every sibling page carries: a pasted quote travels further than the
      // page it came from, and on this product underwriting most often moves the premium
      expect(text).toContain("ไม่ใช่ใบเสนอราคา");
    }
  });

  /** A per-day figure would read as a price that holds, on the one plan whose price does not. */
  it("offers no per-day figure to soften it", () => {
    expect(iHealthyQuoteText(facts)).not.toContain("วันละ");
  });

  it("prints what the customer carries themselves under each arrangement", () => {
    expect(iHealthyQuoteText({ ...facts, arrangement: { ...GOLD, coverage: "Deductible" } }))
      .toContain("วงเงินค่ารักษา 25,000,000 บาทต่อปี · รับผิดส่วนแรก 50,000 บาทต่อปี · อาณาเขตประเทศไทย");
    expect(iHealthyQuoteText({ ...facts, arrangement: { ...GOLD, coverage: "Co-Payment" } }))
      .toContain("· ร่วมจ่าย 20 เปอร์เซ็นต์ของค่าใช้จ่ายที่คุ้มครอง ·");
  });

  /** The cheapest arrangement the pickers reach is under the company's monthly floor. */
  it("names an instalment the company will not take, with the reason", () => {
    const text = iHealthyQuoteText({
      ...facts, mode: "monthly",
      shown: { ...SHOWN, total: 94_500, belowMinimum: true, others: [{ mode: "annual", total: 1_050_000 }, { mode: "semi", total: 546_000 }] },
    })!;
    expect(text).toContain("รายเดือน 945 บาท (ต่ำกว่าขั้นต่ำ 1,000 บาท บริษัทไม่รับชำระรายเดือน)");
    // and the two instalments the company does take are said plainly
    expect(text).toContain("ราย 6 เดือน 5,460 บาท\nรายปี 10,500 บาท");
  });

  it("promises no doubling to an insured already past the age it stops at", () => {
    const text = iHealthyQuoteText({
      ...facts, age: 65,
      death: { beforeAge: 60, sumBefore: 150_000, sumFrom: 150_000, alreadyPastAge: true },
    })!;
    expect(text).toContain("👪 ครอบครัวได้รับเมื่อเสียชีวิต\n- ทุกช่วงอายุ 150,000 บาท");
    expect(text).not.toContain("ก่อนอายุ");
  });

  it("has nothing to copy when no price may be shown", () => {
    expect(iHealthyQuoteText({ ...facts, shown: undefined })).toBeUndefined();
  });
});
