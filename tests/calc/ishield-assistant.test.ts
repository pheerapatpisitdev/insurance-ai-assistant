import { describe, expect, it } from "vitest";
import { answerIShield, savingIn, SAVING_CHOICES, sumFromSaving, termFor } from "@/lib/assistant/ishield/answer";
import { quote } from "@/calc/quote";
import { formatBaht } from "@/calc/money";

/** The rate table behind these figures is current on this date. */
const WHILE_CURRENT = new Date("2026-09-05");

const answer = (said: string, previous: Parameters<typeof answerIShield>[1] = null) =>
  answerIShield(said, previous, "facebook", WHILE_CURRENT);

const spoken = (a: ReturnType<typeof answerIShield>) => a.messages.map((m) => m.text).join("\n");

describe("the monthly saving a customer names", () => {
  it("reads the buttons it offers, and the ways a person types the same thing", () => {
    for (const said of SAVING_CHOICES) expect(savingIn(said)).toBeGreaterThan(0);
    expect(savingIn("เดือนละ 3000")).toBe(3000);
    expect(savingIn("3,000 บาท")).toBe(3000);
    expect(savingIn("5000")).toBe(5000);
  });

  /**
   * A bare two-digit number in this conversation is an age, not a premium.
   *
   * The plan asks for a saving where every other plan asks for a sum, so the reader that
   * fills that slot sits next to the one that reads "ชาย 35" — and a reader willing to take
   * any number at all would price a thirty-five-baht premium for a man of no stated age.
   */
  it("does not read an age as a saving", () => {
    expect(savingIn("ชาย 35")).toBeUndefined();
    expect(savingIn("35")).toBeUndefined();
    expect(savingIn("อายุ 40 ครับ")).toBeUndefined();
  });
});

describe("the paying term", () => {
  it("opens on the one the sales page opens on", () => {
    expect(termFor(35)).toBe("WLCI10");
  });

  /**
   * The terms do not all end at the same age — the ten-year stops at 51 and the fifteen
   * runs to 56 — so an age past the usual one is quoted on a term that takes it rather than
   * refused on the term that does not.
   */
  it("moves to a term that takes the customer rather than turning them away", () => {
    expect(termFor(55)).toBe("WLCI15");
  });

  it("gives up only when no term will have them", () => {
    expect(termFor(60)).toBeUndefined();
  });
});

describe("a saving turned into a sum", () => {
  it("buys a tidy sum, priced at what that sum actually costs", () => {
    const sum = sumFromSaving(3000, { age: 35, sex: "M", variant: "WLCI10" });
    expect(sum).toBeDefined();
    expect(sum! % 10_000).toBe(0);
    // rounding the sum down means the premium lands at or under what the customer said
    const priced = quote({
      planCode: "ISHIELD", variant: "WLCI10", age: 35, sex: "M", mode: "monthly",
      sumAssured: sum!, riders: [],
    }, WHILE_CURRENT);
    expect(priced.totalModal / 100).toBeLessThanOrEqual(3000);
  });

  it("never sells below the plan's own minimum", () => {
    const sum = sumFromSaving(500, { age: 35, sex: "M", variant: "WLCI10" });
    expect(sum).toBeGreaterThanOrEqual(100_000);
  });
});

describe("the conversation", () => {
  it("says what the plan is, then asks who they are", () => {
    const a = answer("สนใจครับ");
    expect(spoken(a)).toContain("70 โรค");
    expect(spoken(a)).toContain("85");
    expect(spoken(a)).toContain("เพศกับอายุ");
  });

  it("asks what they can save, not what cover they want", () => {
    const a = answer("ชาย 35");
    expect(spoken(a)).toContain("ออมเดือนละ");
    expect(spoken(a)).not.toContain("ทุนประกันเท่าไหร่");
    expect(a.replies).toEqual(SAVING_CHOICES);
  });

  it("turns away an age no term will take, and names one that would", () => {
    const a = answer("ชาย 60");
    expect(spoken(a)).toContain("สมัครแบบนี้ไม่ได้");
    expect(spoken(a)).toContain("เบี้ยไม่ทิ้ง");
    expect(a.slots.age).toBeUndefined();
  });

  const priced = answer("ออมเดือนละ 3,000 บาท", { product: "ishield", age: 35, sex: "M", variant: "WLCI10" });

  it("quotes the sum, the premium and what the contract pays back", () => {
    expect(priced.priced).toBe(true);
    expect(priced.messages[0].card).toContain("plan=ISHIELD");
    expect(spoken(priced)).toContain("ทุนประกัน");
    expect(spoken(priced)).toContain("85");
  });

  /**
   * The table is the argument, so it travels with the claim rather than behind a button.
   *
   * This is the plan whose whole case is that the premium comes back. The year-by-year cash
   * value against the premiums paid is where that case is actually made, and making the
   * customer ask for it is making them ask for the evidence of what they were just told.
   */
  it("sends the year-by-year value table beside the quotation", () => {
    const table = priced.messages.find((m) => m.card?.includes("/api/card/table"));
    expect(table).toBeDefined();
    expect(table!.text).toContain("เงินเวนคืน");
  });

  /**
   * What this contract does not do, said by this contract rather than left to be found out.
   *
   * It pays for an illness and it pays nothing towards a hospital bill: the room, the doctor
   * and the drugs arrive every time somebody is admitted, and they are a different contract.
   * The customer holding this quotation is the one person in the day who wants to hear it.
   */
  it("names the gap it leaves, in its own bubble, with the health plan under it", async () => {
    const { CHOOSE_HEALTH } = await import("@/lib/assistant/choose");
    expect(priced.messages.at(-1)?.text).toContain("ค่าห้อง");
    expect(priced.messages.at(-1)?.card).toBeUndefined();
    expect(priced.replies).toContain(CHOOSE_HEALTH);
  });

  it("says the same figure the engine says", () => {
    const sum = priced.slots.sumAssured!;
    const engine = quote({
      planCode: "ISHIELD", variant: "WLCI10", age: 35, sex: "M", mode: "annual",
      sumAssured: sum, riders: [],
    }, WHILE_CURRENT);
    expect(spoken(priced)).toContain(formatBaht(engine.totalAnnual));
  });

  /**
   * The customer carried across from the other arrangement arrives with an age and no term.
   *
   * The term is this plan's business and nothing outside it knows to set one, so a person
   * handed over by the dispatcher was being told the plan would not take them — at an age it
   * takes perfectly well. The slots below are exactly what the hand-over produces.
   */
  it("takes a person handed over from another plan without turning them away", () => {
    const a = answer("สนใจครับ", { product: "ishield", age: 35, sex: "M" });
    expect(spoken(a)).not.toContain("สมัครแบบนี้ไม่ได้");
    expect(a.slots.variant).toBe("WLCI10");
  });

  /** And is told what the plan is, which is the thing they pressed a button to find out. */
  it("introduces itself to that person rather than going straight to a question", () => {
    const a = answer("🌱 มรดก+ออม+โรคร้าย", { product: "ishield", age: 35, sex: "M" });
    expect(spoken(a)).toContain("70 โรค");
    expect(spoken(a)).toContain("ออมเดือนละ");
  });

  it("does not introduce itself twice", () => {
    const a = answer("ครับ", { product: "ishield", age: 35, sex: "M", variant: "WLCI10", told: true });
    expect(spoken(a)).not.toContain("70 โรค");
  });
});
