import { describe, expect, it } from "vitest";
import { diseaseListCodes, diseaseListFor } from "@/lib/copilot/knowledge";

/**
 * The picture of a list and the words of one come from the same place.
 *
 * A card drawn from a second copy of these names would go on saying fifty after the benefit
 * sheet moved to fifty-two, and nothing would say which of the two was lying.
 */
describe("the lists a card can be drawn of", () => {
  it("names every contract the agency sells against critical illness", () => {
    expect(diseaseListCodes().map((l) => l.code).sort())
      .toEqual(["CI123", "DCI", "ISHIELD", "RRSS"]);
  });

  it("carries the counts the sales pages quote", () => {
    const shield = diseaseListFor("ISHIELD")!;
    expect(shield.groups.map((g) => g.diseases.length)).toEqual([20, 50]);
    expect(diseaseListFor("DCI")!.groups[0].diseases).toHaveLength(31);
  });

  /** an unknown code draws nothing rather than an empty card with a heading on it */
  it("says nothing about a contract it has no list for", () => {
    expect(diseaseListFor("NOPE")).toBeUndefined();
    expect(diseaseListFor("")).toBeUndefined();
  });

  /**
   * Every name carries the sentence that has to travel with it.
   *
   * The card prints `note` under the list, and a list whose note was empty would be a picture
   * of thirty diagnoses with no word about the definitions they are judged by.
   */
  it("keeps a note on every list, because the card prints it", () => {
    for (const { code } of diseaseListCodes()) {
      expect(diseaseListFor(code)!.note.length, code).toBeGreaterThan(10);
    }
  });
});

describe("a customer asking to see the names", () => {
  it("is sent the picture, by either brain, without paying a model", async () => {
    const { answerLegacy } = await import("@/lib/assistant/legacy/answer");
    const { answerIShield } = await import("@/lib/assistant/ishield/answer");
    const day = new Date("2026-09-19");

    const l = answerLegacy("ขอดูรายชื่อโรคหน่อยครับ", { product: "legacy", age: 40, sex: "M", told: true }, "facebook", day);
    expect(l.messages[0].card).toBe("/api/card/diseases?of=DCI");

    const i = answerIShield("คุ้มครองโรคอะไรบ้าง", { product: "ishield", age: 35, sex: "M", variant: "WLCI10", told: true }, "facebook", day);
    expect(i.messages[0].card).toBe("/api/card/diseases?of=ISHIELD");
  });

  /**
   * "กี่โรค" is a different question and has a one-line answer.
   *
   * Sending seventy diagnoses to somebody who asked for a number is the mistake the knowledge
   * base already had to be talked out of once — the owner watched it happen.
   */
  it("is not sent the picture for asking how many there are", async () => {
    const { asksDiseaseList } = await import("@/lib/assistant/common");
    expect(asksDiseaseList("กี่โรค")).toBe(false);
    expect(asksDiseaseList("คุ้มครองกี่โรคครับ")).toBe(false);
    expect(asksDiseaseList("ขอดูรายชื่อโรค")).toBe(true);
  });
});
