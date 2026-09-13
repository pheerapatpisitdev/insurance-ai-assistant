import { describe, expect, it } from "vitest";
import { iHealthyCard } from "@/lib/ihealthy-card";
import { cardPath, ridersFrom, riderParams } from "@/lib/ihealthy-link";
import { iHealthyTable } from "@/lib/ihealthy-table";
import { IHEALTHY_OPENING } from "@/lib/ihealthy-choice";
import { iHealthyPricing } from "@/lib/ihealthy-quote";

/** Pinned, as its four siblings are: these are price assertions, and a rate table that has
 *  lapsed has no price at all — an unpinned clock turns that into six red tests on a date
 *  with no code change, pointing at the card and meaning "renew the rate table". */
const WHILE_CURRENT = new Date("2026-09-12");
const table = iHealthyTable(WHILE_CURRENT);
/** The arrangement the page opens on, as an address. */
const OPENING = "age=35&sex=F&base=WLF99H&sa=150000&plan=GOLD&area=&cover=&mode=annual";
const query = (s: string) => new URLSearchParams(s);
const cardAt = (s: string) => iHealthyCard(query(s), WHILE_CURRENT);
const spanOf = (card: ReturnType<typeof iHealthyCard>, label: string) =>
  card.rows.find((r) => r.label === label)?.span;

describe("the riders in a card link", () => {
  it("writes each rider's fields in the order the engine takes them", () => {
    expect(riderParams([{ code: "MEB", plan: 1_000 }])).toEqual(["MEB:1000"]);
    expect(riderParams([{ code: "DCI", sumAssured: 500_000 }])).toEqual(["DCI::500000"]);
    expect(riderParams([{ code: "X", option: "แผน S" }])).toEqual(["X:::แผน S"]);
  });

  it("reads back what it wrote", () => {
    const riders = [{ code: "MEB", plan: 1_000 }, { code: "DCI", sumAssured: 500_000 }];
    expect(ridersFrom(riderParams(riders))).toEqual(riders);
  });

  it("keeps a colon inside a variant's own name", () => {
    expect(ridersFrom(["X:::a:b"])).toEqual([{ code: "X", option: "a:b" }]);
  });

  it("ignores a field that is not a whole number, and a rider with no code", () => {
    expect(ridersFrom(["MEB:many", ":1000", ""])).toEqual([{ code: "MEB" }]);
  });

  it("says nothing about riders until the fold has, and says so when it has nothing", () => {
    // silence and an empty answer are different arrangements, and the link has to tell them
    // apart or a card would put back the rider an agent had just taken off
    // as a whole key, since `cover=` ends in the same two characters
    expect(cardPath(table, IHEALTHY_OPENING)).not.toMatch(/[?&]r=/);
    expect(cardPath(table, { ...IHEALTHY_OPENING, riders: [] })).toMatch(/&r=(&|$)/);
    expect(cardPath(table, { ...IHEALTHY_OPENING, riders: [{ code: "MEB", plan: 1_000 }] }))
      .toContain("&r=MEB%3A1000");
  });
});

describe("iHealthyCard", () => {
  it("names the arrangement it is drawing", () => {
    const card = cardAt(OPENING);
    expect(card.planLine).toBe("iHealthy Ultra Gold");
    expect(card.insuredLine).toContain("หญิง 35 ปี");
    expect(card.insuredLine).toContain("150,000");
    expect(card.insuredLine).toContain("ประเทศไทย");
  });

  it("carries every plan as a column, with the one being priced marked", () => {
    const card = cardAt(OPENING);
    expect(card.columns.map((c) => c.name)).toEqual(
      ["Smart", "Bronze", "Silver", "Gold", "Diamond", "Platinum"],
    );
    expect(card.columns.filter((c) => c.selected).map((c) => c.name)).toEqual(["Gold"]);
    expect(card.columns.every((c) => c.sold)).toBe(true);
  });

  it("condenses the sheet to the rows the phone shows, and prices all three instalments", () => {
    const card = cardAt(OPENING);
    expect(card.rows.map((r) => r.label)).toEqual([
      "วงเงินค่ารักษาต่อปี",
      "ค่าห้องและค่าอาหาร",
      "Day Surgery",
      "อุบัติเหตุ OPD 24 ชม",
      "มะเร็ง รังสีรักษา",
      "ผู้ป่วยนอก OPD",
      "ค่าชดเชยรายวัน",
    ]);
    expect(card.premiumRows.map((r) => r.label)).toEqual(["รายปี", "ราย 6 เดือน", "รายเดือน"]);
    // every priced row answers for all six plans
    for (const row of card.premiumRows) expect(row.cells).toHaveLength(6);
  });

  it("prices exactly what the page's own card prices", () => {
    const card = cardAt(OPENING);
    const priced = iHealthyPricing(table, {
      base: "WLF99H", sex: "F", age: 35, sumAssured: 150_000,
      plan: "GOLD", territory: "ประเทศไทย", coverage: "Full Coverage",
    })!;
    const annual = priced.total.find((m) => m.mode === "annual")!.total;
    expect(card.premium?.amount).toBe(Math.floor(annual / 100).toLocaleString("en-US"));
    // and the table under it says the same figure in the column the card is pricing
    expect(card.premiumRows[0].cells[3].text).toBe(card.premium?.amount);
  });

  it("quotes the agency's standard daily cash where the fold has not spoken", () => {
    const card = cardAt(OPENING);
    expect(spanOf(card, "ค่าชดเชยรายวัน")).toContain("1,000 ต่อวัน");
    expect(card.lines.some((l) => l.label.includes("ค่าชดเชยรายวัน"))).toBe(true);
  });

  it("takes it off when the fold says it is off, and charges less", () => {
    const on = cardAt(OPENING);
    const off = cardAt(`${OPENING}&r=`);
    expect(spanOf(off, "ค่าชดเชยรายวัน")).toBe("-");
    expect(off.lines.some((l) => l.label.includes("ค่าชดเชยรายวัน"))).toBe(false);
    // an emptied fold subtotals to nothing, and no line is printed for nothing
    expect(off.lines).toHaveLength(2);
    expect(Number(off.premium!.amount.replace(/,/g, ""))).toBeLessThan(
      Number(on.premium!.amount.replace(/,/g, "")),
    );
  });

  it("counts the riders rather than listing them, once there is more than one", () => {
    const card = cardAt(`${OPENING}&r=MEB%3A1000&r=DCI%3A%3A500000`);
    expect(card.lines.some((l) => l.label === "สัญญาเพิ่มเติม 2 รายการ")).toBe(true);
    const bare = cardAt(`${OPENING}&r=MEB%3A1000`);
    expect(Number(card.premium!.amount.replace(/,/g, ""))).toBeGreaterThan(
      Number(bare.premium!.amount.replace(/,/g, "")),
    );
  });

  it("refuses a rider the age cannot buy rather than pricing it", () => {
    // DCI is written from 20; the link may ask for it at 8 and the engine still will not
    const card = cardAt("age=8&sex=M&base=WLF99H&sa=150000&plan=BRONZE&r=DCI%3A%3A500000");
    expect(card.lines.some((l) => l.label.includes("สัญญาเพิ่มเติม"))).toBe(false);
    expect(spanOf(card, "ค่าชดเชยรายวัน")).toBe("-");
  });

  it("withholds the figures in a column the company will not sell at this age", () => {
    const card = cardAt("age=8&sex=M&base=WLF99H&sa=150000&plan=BRONZE");
    const dim = card.columns.filter((c) => !c.sold).map((c) => c.name);
    expect(dim).toContain("Gold");
    const room = card.rows.find((r) => r.label === "ค่าห้องและค่าอาหาร")!;
    expect(room.cells[3]).toEqual({ text: "-", dim: true });
    expect(room.cells[1].dim).toBe(false);
  });

  it("still describes the cover once the rate table has lapsed, and quotes no price", () => {
    const card = iHealthyCard(query(OPENING), new Date("2099-01-01"));
    expect(card.premium).toBeUndefined();
    expect(card.lines).toEqual([]);
    expect(card.premiumRows).toEqual([]);
    expect(card.rows.find((r) => r.label === "ค่าห้องและค่าอาหาร")!.cells[3].text).toBe("9,000 ต่อวัน");
  });

  it("answers a query that asks for nothing at all", () => {
    const card = cardAt("");
    expect(card.planLine).toBe("iHealthy Ultra Gold");
    expect(card.premium).toBeDefined();
  });

  it("names the daily cash by the plan attached, not by the agency's own", () => {
    // The fold offers 500 to 5,000 at this age. Reading the name off the agency's standard
    // put "1,000 บาท" over a 5,000-a-day premium, two rows above its own table saying 5,000.
    const big = cardAt(`${OPENING}&r=MEB%3A5000`);
    expect(big.lines.map((l) => l.label)).toContain("ค่าชดเชยรายวัน 5,000 บาท");
    expect(spanOf(big, "ค่าชดเชยรายวัน")).toContain("5,000 ต่อวัน");
    const small = cardAt(`${OPENING}&r=MEB%3A500`);
    expect(small.lines.map((l) => l.label)).toContain("ค่าชดเชยรายวัน 500 บาท");
    expect(spanOf(small, "ค่าชดเชยรายวัน")).toContain("500 ต่อวัน");
    // and the three prices differ, which is what makes naming them apart matter
    const amounts = [small, cardAt(`${OPENING}&r=MEB%3A1000`), big]
      .map((c) => Number(c.premium!.amount.replace(/,/g, "")));
    expect(amounts[0]).toBeLessThan(amounts[1]);
    expect(amounts[1]).toBeLessThan(amounts[2]);
  });

  it("adds what a rider pays on death to what the family receives", () => {
    const bare = cardAt(`${OPENING}&sa=1000000&r=MEB%3A1000`);
    const withDci = cardAt(`${OPENING}&sa=1000000&r=MEB%3A1000&r=DCI%3A%3A1000000`);
    // the base pays double before 60; DCI's own million rides on top of that
    expect(bare.death).toContain("2,000,000");
    expect(withDci.death).toContain("3,000,000");
  });

  it("dashes an instalment the company will not accept", () => {
    // male 18 on the package, สมาร์ท with a deductible and an emptied fold: the monthly
    // instalment falls under the company's floor, and a figure in that column would be an
    // offer to be paid a way that cannot be bought
    const card = cardAt("age=18&sex=M&base=WLF99HX&plan=SMART&cover=D&r=");
    const monthly = card.premiumRows.find((r) => r.label === "รายเดือน")!;
    expect(monthly.cells[0].text).toBe("-");
    // the yearly instalment for the same plan is still a real figure
    expect(card.premiumRows.find((r) => r.label === "รายปี")!.cells[0].text).not.toBe("-");
  });

  it("counts the categories the picture leaves out, headings included", () => {
    // 28 in the contract, 5 on the picture; the three that live as headings were missed
    expect(cardAt(OPENING).notes[0]).toContain("อีก 23 หมวด");
  });

  it("says it is not a quotation", () => {
    const notes = cardAt(OPENING).notes.join(" ");
    expect(notes).toContain("ไม่ใช่ใบเสนอราคา");
    expect(notes).toContain("เบี้ยปีแรก");
  });
});
