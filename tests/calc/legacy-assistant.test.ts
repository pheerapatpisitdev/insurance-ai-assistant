import { describe, expect, it } from "vitest";
import { answerLegacy, LEGACY_OPENING, LEGACY_TIERS, tierIn } from "@/lib/assistant/legacy/answer";

/** The rate tables behind these figures are current on this date. */
const WHILE_CURRENT = new Date("2026-09-05");

const answer = (said: string, previous: Parameters<typeof answerLegacy>[1] = null) =>
  answerLegacy(said, previous, "facebook", WHILE_CURRENT);

const spoken = (a: ReturnType<typeof answerLegacy>) => a.messages.map((m) => m.text).join("\n");

describe("the tier a customer names", () => {
  it("reads the sum they say and the button they tap as the same thing", () => {
    expect(tierIn("3 ล้าน")).toBe(3);
    expect(tierIn("มรดก 3 ล้าน")).toBe(3);
    expect(tierIn("เอา 10 ล้านเลยครับ")).toBe(10);
    for (const said of LEGACY_TIERS) expect(tierIn(said)).toBeDefined();
  });

  it("refuses a sum the arrangement is not sold in", () => {
    // the tiers are whole millions, one to ten, and nothing between or beyond them
    expect(tierIn("1.5 ล้าน")).toBeUndefined();
    expect(tierIn("5 แสน")).toBeUndefined();
    expect(tierIn("20 ล้าน")).toBeUndefined();
    expect(tierIn("อายุ 35")).toBeUndefined();
  });
});

describe("the first turn", () => {
  /**
   * The question is the whole of the first answer.
   *
   * The leaflet used to come first and the question under it, which spent a customer's one
   * willing moment on reading. It is still said — on the turn after, once they have answered.
   */
  it("asks who they are first, and says what the plan is once they have answered", () => {
    const first = answer("สนใจครับ");
    expect(spoken(first)).toContain("เพศกับอายุ");
    expect(spoken(first)).not.toContain("31 โรคร้ายแรง");
    expect(first.priced).toBeFalsy();

    const next = answer("ชาย 40", first.slots);
    expect(spoken(next)).toContain("31 โรคร้ายแรง");
  });

  it("does not hand the same leaflet over twice", () => {
    const a = answer("สนใจครับ", { product: "legacy", told: true });
    expect(spoken(a)).not.toContain(LEGACY_OPENING.slice(0, 20));
    expect(spoken(a)).toContain("เพศกับอายุ");
  });

  /**
   * A customer who crossed over from another quotation has never seen this leaflet.
   *
   * They arrive carrying an age and a sex, which used to read as a conversation already under
   * way — so pressing a button naming a plan they had been told nothing about got them a
   * question and no answer. The slots below are exactly what the hand-over produces.
   */
  it("introduces itself to a customer handed over from another plan", () => {
    const a = answer("🛡 มรดก+โรคร้ายแรง", { product: "legacy", age: 40, sex: "M" });
    expect(spoken(a)).toContain("31 โรคร้ายแรง");
    expect(spoken(a)).toContain("วงเงิน");
  });

  it("skips straight past the question when the customer answered it unasked", () => {
    const a = answer("ชาย 35 ครับ");
    expect(a.slots).toMatchObject({ age: 35, sex: "M" });
    expect(a.messages.at(-1)?.text).toContain("วงเงิน");
    expect(a.replies).toEqual(LEGACY_TIERS);
  });
});

describe("an age the critical-illness contract cannot be issued at", () => {
  it("is turned away at once, and sent to the plan that would take them", () => {
    const a = answer("ชาย 70");
    expect(spoken(a)).toContain("20–65");
    expect(spoken(a)).toContain("เบี้ยไม่ทิ้ง");
    expect(a.priced).toBeFalsy();
    // nothing about that person is carried forward into an arrangement they cannot buy
    expect(a.slots.age).toBeUndefined();
  });

  it("takes the ages it does sell", () => {
    for (const age of [20, 65]) {
      expect(spoken(answer(`ชาย ${age}`))).not.toContain("สมัครแบบนี้ไม่ได้");
    }
  });
});

describe("the quotation", () => {
  const priced = answer("มรดก 3 ล้าน", { product: "legacy", age: 35, sex: "M" });

  it("prices the tier from the engine and draws the card beside it", () => {
    expect(priced.priced).toBe(true);
    expect(priced.messages[0].card).toContain("bundle=LEGACY_FAMILY");
    expect(priced.messages[0].card).toContain("tier=3");
  });

  /** The bill this arrangement does not pay, named by the arrangement that does not pay it. */
  it("names the gap it leaves, with the health plan under it", async () => {
    const { CHOOSE_HEALTH } = await import("@/lib/assistant/choose");
    expect(priced.messages.at(-1)?.text).toContain("ค่าห้อง");
    expect(priced.replies).toContain(CHOOSE_HEALTH);
  });

  /** And the way out of the conversation the whole campaign is for. */
  it("hands over the application form when the customer asks to go ahead", async () => {
    const { WANTS_IN, APPLICATION_FORM } = await import("@/lib/assistant/common");
    const a = answer(WANTS_IN, { product: "legacy", age: 35, sex: "M", tier: 3, told: true });
    expect(spoken(a)).toContain(APPLICATION_FORM);
  });

  /**
   * The one sentence this brain may not leave out.
   *
   * DCI is priced on the age attained each year, so every figure quoted here is the first
   * year's. Saying the premium without saying that is a promise the next renewal breaks.
   */
  it("never says a premium without saying it is the first year's", () => {
    expect(spoken(priced)).toContain("ปีแรก");
    expect(spoken(priced)).toContain("ปีถัดไป");
  });

  it("writes it for the inbox, which renders no markdown", () => {
    expect(spoken(priced)).not.toContain("**");
  });

  it("asks again rather than quoting nothing when the arrangement will not issue", () => {
    const a = answer("มรดก 10 ล้าน", { product: "legacy", age: 65, sex: "M" });
    if (!a.priced) {
      expect(a.replies).toEqual(LEGACY_TIERS);
      expect(a.slots.tier).toBeUndefined();
    }
  });
});

describe("what is offered after a premium", () => {
  const priced = answer("มรดก 3 ล้าน", { product: "legacy", age: 35, sex: "M" });

  /**
   * The life plan's follow-ups are wrong here and were what the page offered.
   *
   * "ขอตารางมูลค่า" after this quotation is a button with a page's authority behind it
   * leading nowhere: the premium on this arrangement is spent, and there is no surrender
   * value to show. What follows is a larger legacy, or the other way of leaving one.
   */
  it("offers its own next questions, not the life plan's", () => {
    expect(priced.replies).toBeDefined();
    expect(priced.replies?.join(" ")).not.toContain("ตารางมูลค่า");
  });

  it("offers the tiers the customer did not pick, and never the one they did", () => {
    expect(priced.replies).toContain("มรดก 1 ล้าน");
    expect(priced.replies).not.toContain("มรดก 3 ล้าน");
  });

  /**
   * The comparison is free to ask for, so it is offered.
   *
   * Both arrangements are priced from the same age and sex, and this one has just collected
   * them. The button says the other plan's name because that is how the dispatcher hears a
   * change of product — the customer is carried across without being asked anything twice.
   */
  it("offers the other arrangement by a name the dispatcher will route on", async () => {
    const { productNamedIn, CHOOSE_LIFE } = await import("@/lib/assistant/choose");
    const cross = priced.replies?.find((r) => r === CHOOSE_LIFE);
    expect(cross).toBeDefined();
    expect(productNamedIn(cross!)).toBe("lifeprotect");
  });
});
