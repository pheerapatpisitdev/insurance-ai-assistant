import { describe, expect, it } from "vitest";
import { openingGuide, priceFollowUps, PRICED_FOLLOW_UPS } from "@/lib/copilot/guide";
import { planNamedIn, priceNamedPlan } from "@/lib/copilot/price";
import { getPlan } from "@/calc/plans/registry";
import {
  asksAboutDeathBenefit, asksForPrice, asksPayTerm, asksValueTable,
} from "@/lib/assistant/lifeprotect/route";
import { asksFullTable, asksOtherPlans, asksShareOfBill } from "@/lib/assistant/ihealthy/route";
import { asksCheaper } from "@/lib/assistant/common";

/**
 * Every button on the page, pressed.
 *
 * A guide button that leads nowhere is worse than no button: the reader learns the assistant
 * is useless from the one question the page itself put in their hand. So the test for this
 * feature is not that the buttons render — it is that each one, pressed, arrives somewhere
 * that can answer it.
 *
 * Two kinds of destination, checked two ways. A money question must reach the engine and
 * come back with a figure, which is checked exactly. A rule question reaches a model holding
 * the rule book, which cannot be called from a test — so what is checked there is that it is
 * NOT sent down the pricing path, where a question about a waiting period would be answered
 * with an apology about a missing age.
 */

/** The same test `answerFromKnowledge` applies, without needing a model or a network. */
function goesToTheEngine(text: string): boolean {
  return asksForPrice(text) || asksValueTable(text) || asksPayTerm(text)
    || asksAboutDeathBenefit(text) || asksFullTable(text) || asksOtherPlans(text)
    || asksShareOfBill(text) || asksCheaper(text)
    || /เบี้ย|ราคา|กี่บาท|ค่างวด|จ่ายเดือนละ|จ่ายปีละ|จ่ายเท่าไหร่|คิดให้|premium/i.test(text);
}

const guide = openingGuide();
const everyOpeningItem = guide.flatMap((g) => g.items);

describe("the guide the page opens with", () => {
  it("has a button for every plan the system sells", () => {
    const prices = guide.find((g) => g.title === "อยากรู้เบี้ยประกัน")!;
    for (const code of ["LIFEPROTECT", "ISMART", "LIFETREASURE", "ISHIELD", "PLB"]) {
      expect(prices.items.some((i) => planNamedIn(i.ask)?.code === code || i.ask.includes("Life Protect")), code)
        .toBe(true);
    }
  });

  it("says on the button exactly what pressing it asks", () => {
    // a button that quotes a 35-year-old man should say so, or the answer arrives about
    // somebody the reader never mentioned
    for (const item of everyOpeningItem) {
      expect(item.label.length, item.label).toBeLessThanOrEqual(46);
      expect(item.ask.trim(), item.label).not.toBe("");
    }
    const withAge = everyOpeningItem.filter((i) => /ชาย \d+/.test(i.ask));
    expect(withAge.length).toBeGreaterThan(0);
    for (const item of withAge) expect(item.label, item.ask).toMatch(/ชาย \d+/);
  });

  it("never offers a sum the plan would refuse", () => {
    for (const item of everyOpeningItem) {
      const named = planNamedIn(item.ask);
      if (!named) continue;
      const reply = priceNamedPlan(item.ask, named.code, named.label);
      const plan = getPlan(named.code)!;
      // iShield answers by explaining itself; every other plan must produce a figure
      if (plan.rules.base.premiumBasis) {
        expect(reply.text, item.label).toContain("/other-plans");
        continue;
      }
      expect(reply.priced, item.label).toBe(true);
      expect(reply.text, item.label).toMatch(/💰 เบี้ยปีละ \*\*[\d,]+ บาท\*\*/);
      expect(reply.cards?.length, item.label).toBeGreaterThan(0);
    }
  });

  it("sends each button to a place that can answer it", () => {
    for (const group of guide) {
      for (const item of group.items) {
        /**
         * The price group belongs to the engine, and the rule groups must not go there:
         * "iHealthy มีระยะเวลารอคอยกี่วัน" answered down the pricing path would come back as
         * an apology about a missing age.
         *
         * iShield's button is in the price group and is a price question — it just gets the
         * explanation rather than a figure, because it takes a premium and returns a sum.
         */
        const money = group.title === "อยากรู้เบี้ยประกัน";
        expect(goesToTheEngine(item.ask), `${item.label} → ${item.ask}`).toBe(money);
      }
    }
  });
});

describe("the buttons offered after an answer", () => {
  it("turns a refused quotation into one press", () => {
    // being told a paying term is needed, and being handed the four terms, are very
    // different experiences of the same sentence
    const asked = "PLB ชาย 35 ทุน 1 ล้าน เบี้ยเท่าไหร่";
    const reply = priceNamedPlan(asked, "PLB", "Protection Life (PLB)");
    expect(reply.priced).toBe(false);
    expect(reply.guide?.length).toBe(4);
    for (const item of reply.guide ?? []) {
      const next = priceNamedPlan(item.ask, "PLB", "Protection Life (PLB)");
      expect(next.priced, item.label).toBe(true);
      // and it kept what the reader had already said
      expect(next.text, item.label).toContain("ชาย อายุ 35 ปี");
      expect(next.text, item.label).toContain("ทุน 1,000,000 บาท");
      expect(next.text, item.label).toContain(item.label);
    }
  });

  it("fills the sum with something the plan accepts, for every plan", () => {
    for (const [code, label] of [
      ["PLB", "Protection Life (PLB)"],
      ["ISMART", "iSmart 80/6"],
      ["LIFETREASURE", "Life Treasure"],
    ] as const) {
      const plan = getPlan(code)!;
      const variant = plan.defaultVariant ?? plan.rates.base.variants?.[0];
      const items = priceFollowUps({ planCode: code, planLabel: label, variant, age: 40, sex: "M", needs: ["sum"] });
      expect(items.length, label).toBeGreaterThan(0);
      for (const item of items) {
        const next = priceNamedPlan(item.ask, code, label);
        expect(next.priced, `${label} · ${item.label}`).toBe(true);
      }
    }
  });

  it("offers the other lengths once a quotation is on the screen", () => {
    const priced = priceNamedPlan(
      "Life Treasure ชาย 40 ทุน 10 ล้าน จ่าย 6 ปี เบี้ยเท่าไหร่", "LIFETREASURE", "Life Treasure",
    );
    expect(priced.priced).toBe(true);
    // the six-year package it just quoted is not offered back
    expect(priced.guide?.map((g) => g.label)).toEqual(["ถ้าจ่าย 12 ปีล่ะ", "ถ้าจ่าย 18 ปีล่ะ"]);
    for (const item of priced.guide ?? []) {
      const next = priceNamedPlan(item.ask, "LIFETREASURE", "Life Treasure");
      expect(next.priced, item.label).toBe(true);
      expect(next.text, item.label).toContain("ทุน 10,000,000 บาท");
    }
  });

  it("gives a single-package plan nothing to compare against, rather than a dead button", () => {
    const priced = priceNamedPlan("iSmart ชาย 35 ทุน 1 ล้าน เบี้ยเท่าไหร่", "ISMART", "iSmart 80/6");
    expect(priced.priced).toBe(true);
    expect(priced.guide).toEqual([]);
  });

  it("offers iShield no buttons, because it is not asked for a sum", () => {
    const reply = priceNamedPlan("iShield ชาย 35 ทุน 1 ล้าน เบี้ยเท่าไหร่", "ISHIELD", "iShield");
    expect(reply.guide).toBeUndefined();
  });

  it("only offers the brains what the brains themselves recognise", () => {
    // these reach the dispatcher, which can draw a table; a model cannot
    for (const item of PRICED_FOLLOW_UPS) {
      expect(goesToTheEngine(item.ask), item.label).toBe(true);
    }
  });
});
