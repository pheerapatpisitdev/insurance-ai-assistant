import { describe, expect, it } from "vitest";
import { peopleIn } from "@/lib/assistant/common";
import { openingGuide } from "@/lib/copilot/guide";

/**
 * A plan's own name must never be read as a customer.
 *
 * Product names carry numbers — "Life Protect x 1.5 / x 2", "iSmart 80/6" — and the reader
 * pairs a number with the sex word beside it in either order. "…x 2 ชาย 35" therefore came
 * back as a two-year-old man, and the quotation was refused for an age outside the plan's
 * range.
 *
 * This was found once before and fixed in the wrong place: the stripping went into
 * `price.ts`, which is the path for the plans with no Messenger brain, so Life Protect —
 * which has one — never saw it, and the dispatcher's own reading of the same message never
 * saw it either. It is fixed here, inside the reader, because there is no call site that
 * wants a plan's model number read as somebody's age.
 *
 * The guide buttons make it worse rather than rarer. The owner asked for buttons a customer
 * can press, and each one is built from the plan's registry name, so the two worst-affected
 * names are exactly what the button sends. Two of the five price buttons were broken.
 */

describe("a plan's name is not a person", () => {
  it("reads the customer's age, not the model number beside it", () => {
    for (const [asked, age] of [
      ["Life Protect x 1.5 / x 2 ชาย 35 ทุน 1 ล้าน เบี้ยเท่าไหร่", 35],
      ["iSmart 80/6 ชาย 35 ทุน 1 ล้าน เบี้ยเท่าไหร่", 35],
      ["Life Protect x 2 หญิง 42", 42],
      ["ไลฟ์ โพรเทค x 1.5 ชาย 28", 28],
      ["iSmart 80/6 ญ 45", 45],
    ] as const) {
      expect(peopleIn(asked), asked).toEqual([{ age, sex: asked.includes("ญ") || asked.includes("หญิง") ? "F" : "M" }]);
    }
  });

  it("reads every price button the page offers as the person it names", () => {
    // the buttons are generated from the registry, so this fails the day a plan is added
    // whose name pairs a number with a sex word in some way nobody thought of
    const asks = openingGuide().flatMap((g) => g.items.map((i) => i.ask));
    const priced = asks.filter((a) => /ชาย|หญิง/.test(a));
    expect(priced.length).toBeGreaterThan(2);
    for (const ask of priced) {
      const [person] = peopleIn(ask);
      expect(person, ask).toBeDefined();
      // every example button quotes somebody of working age; none of them quotes an infant
      expect(person.age, ask).toBeGreaterThanOrEqual(18);
    }
  });

  it("still reads a person when no plan is named at all", () => {
    expect(peopleIn("ชาย 35 ทุน 1 ล้าน")).toEqual([{ age: 35, sex: "M" }]);
    expect(peopleIn("ผญ 32 ผช 33")).toEqual([{ age: 32, sex: "F" }, { age: 33, sex: "M" }]);
  });

  it("does not swallow a number that merely sits near a plan's name", () => {
    // the sum is not part of the name and the age is not either; only the model number is
    expect(peopleIn("Life Protect ชาย 35")).toEqual([{ age: 35, sex: "M" }]);
    expect(peopleIn("iShield หญิง 30")).toEqual([{ age: 30, sex: "F" }]);
  });
});
