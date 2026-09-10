import { describe, expect, it } from "vitest";
import { cardInputFrom, cardPath, cardUrl, quoteCard, type CardInput, type QuoteCard } from "@/lib/quote-card";

/** The rate table behind these figures lapses on 2027-03-31. */
const WHILE_CURRENT = new Date("2026-09-05");

const MAN35: CardInput = {
  kind: "plan",
  planCode: "LIFEPROTECT", variant: "WLF19H", age: 35, sex: "M", sumAssured: 1_000_000, mode: "monthly",
};

const params = (q: string) => new URLSearchParams(q);

describe("cardInputFrom", () => {
  it("reads an arrangement the registry knows", () => {
    expect(cardInputFrom(params("plan=LIFEPROTECT&variant=WLF19H&age=35&sex=M&sum=1000000&mode=monthly")))
      .toEqual(MAN35);
  });

  it("falls back to the plan's own default term", () => {
    expect(cardInputFrom(params("plan=LIFEPROTECT&age=35&sex=M&sum=1000000")))
      .toMatchObject({ kind: "plan", variant: "WLF99H" });
  });

  /** A card is a public URL, so everything in it is checked before anything is drawn. */
  it("refuses anything the registry does not recognise", () => {
    expect(cardInputFrom(params("plan=NOPE&age=35&sex=M&sum=1000000"))).toBeUndefined();
    // a term that belongs to another plan
    expect(cardInputFrom(params("plan=LIFEPROTECT&variant=WLCI10&age=35&sex=M&sum=1000000"))).toBeUndefined();
    expect(cardInputFrom(params("plan=LIFEPROTECT&age=120&sex=M&sum=1000000"))).toBeUndefined();
    expect(cardInputFrom(params("plan=LIFEPROTECT&age=35&sex=X&sum=1000000"))).toBeUndefined();
    expect(cardInputFrom(params("plan=LIFEPROTECT&age=35&sex=M&sum=0"))).toBeUndefined();
    expect(cardInputFrom(params("plan=LIFEPROTECT&age=35.5&sex=M&sum=1000000"))).toBeUndefined();
  });

  it("ignores a payment mode it does not sell", () => {
    expect(cardInputFrom(params("plan=LIFEPROTECT&age=35&sex=M&sum=1000000&mode=weekly"))?.mode).toBeUndefined();
  });
});

describe("cardPath and cardUrl", () => {
  it("writes the arrangement into the address", () => {
    expect(cardPath(MAN35)).toBe("/api/card?plan=LIFEPROTECT&variant=WLF19H&age=35&sex=M&sum=1000000&mode=monthly");
  });

  it("survives the round trip back into an input", () => {
    const path = cardPath(MAN35);
    expect(cardInputFrom(new URLSearchParams(path.split("?")[1]))).toEqual(MAN35);
  });

  it("hangs the same path off a host, for the channels that fetch it themselves", () => {
    expect(cardUrl("https://www.advisortool.app", MAN35))
      .toBe(`https://www.advisortool.app${cardPath(MAN35)}`);
  });
});

const section = (card: QuoteCard, title: string) => card.sections.find((s) => s.title === title);

const DEATH = "ครอบครัวได้รับเมื่อเสียชีวิต";
const CASH = "มูลค่าเงินสดสะสม (หากเวนคืน)";

describe("quoteCard", () => {
  it("draws what the sales page shows for the same insured", () => {
    const card = quoteCard(MAN35, WHILE_CURRENT)!;
    expect(card.planLine).toBe("Life Protect x 2 · ชำระเบี้ย 19 ปี");
    expect(card.insuredLine).toBe("ชาย 35 ปี · ทุน 1,000,000 บาท");
    expect(card.premium).toEqual({ amount: "2,583", per: "ต่อเดือน" });
    expect(card.perDay).toBe("ตกวันละ 79 บาท");
    expect(card.others).toBe("รายปี 28,700 บาท · ราย 6 เดือน 14,924 บาท");
  });

  it("bands the death benefit the way every other surface does", () => {
    expect(section(quoteCard(MAN35, WHILE_CURRENT)!, DEATH)).toEqual({
      title: DEATH,
      rows: [
        { label: "เสียชีวิตก่อนอายุ 60 ปี", amount: "2,000,000" },
        { label: "อายุ 60 ปีขึ้นไป", amount: "1,000,000" },
      ],
    });
  });

  it("quotes the surrender value at the milestones still ahead", () => {
    expect(section(quoteCard(MAN35, WHILE_CURRENT)!, CASH)!.rows).toEqual([
      { label: "อายุ 60 ปี", amount: "504,000" },
      { label: "อายุ 70 ปี", amount: "633,000" },
      { label: "อายุ 80 ปี", amount: "777,000" },
      { label: "อายุ 99 ปี", amount: "1,000,000" },
    ]);
  });

  /** The order the bands are drawn in is the order the customer reads them. */
  it("puts what the family receives above what surrender would return", () => {
    expect(quoteCard(MAN35, WHILE_CURRENT)!.sections.map((s) => s.title)).toEqual([DEATH, CASH]);
  });

  it("leaves out the milestones an older insured has already passed", () => {
    const rows = section(quoteCard({ ...MAN35, age: 72 }, WHILE_CURRENT)!, CASH)!.rows;
    expect(rows.map((r) => r.label)).toEqual(["อายุ 80 ปี", "อายุ 99 ปี"]);
  });

  it("names the rate table it priced from", () => {
    expect(quoteCard(MAN35, WHILE_CURRENT)!.notes[0]).toBe("เบี้ยมาตรฐานโดยประมาณ · ตารางเบี้ยฉบับ A2026-1");
  });

  /** A card is a picture of a price, and a lapsed table has no price to show. */
  it("shows no premium once the rate table has lapsed", () => {
    const card = quoteCard(MAN35, new Date("2027-04-01"))!;
    expect(card.premium).toBeNull();
    expect(card.perDay).toBeNull();
    expect(card.notes[0]).toContain("หมดอายุ");
    // the benefits do not come from the rate table, so they are still true and still drawn
    expect(section(card, DEATH)!.rows[0].amount).toBe("2,000,000");
  });

  it("draws nothing for an arrangement the company will not issue", () => {
    // iShield stops at 5,000,000, so a card for ten million is a card for nothing
    expect(quoteCard(
      { kind: "plan", planCode: "ISHIELD", variant: "WLCI10", age: 35, sex: "M", sumAssured: 10_000_000 },
      WHILE_CURRENT,
    )).toBeUndefined();
  });

  it("prices a plan whose labels carry no product name", () => {
    const card = quoteCard(
      { kind: "plan", planCode: "PLB", variant: "PLB10", age: 35, sex: "F", sumAssured: 500_000 },
      WHILE_CURRENT,
    )!;
    expect(card.planLine).toBe("Protection Life (PLB) · Protection Life (ชำระเบี้ย 10 ปี)");
    // PLB has no cash-value table extracted, so the card simply has no such section
    expect(section(card, CASH)).toBeUndefined();
  });
});
