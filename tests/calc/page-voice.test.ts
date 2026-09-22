import { describe, expect, it } from "vitest";
import { spokenBy, voiceOf } from "@/lib/assistant/voice";
import { CHOICES } from "@/lib/assistant/choose";

const LUCKY = "105982528649026";
const TALK = "1431905706931225";
const WORKING = "103716981993581";

describe("the voice a Page answers in", () => {
  it("is ค่ะ everywhere except the one Page that kept ครับ", () => {
    expect(voiceOf(LUCKY)).toBe("female");
    expect(voiceOf(TALK)).toBe("female");
    expect(voiceOf(WORKING)).toBe("male");
  });

  /** A Page connected tomorrow speaks like the two that are, not like nothing. */
  it("gives a Page it has never seen the voice the others use", () => {
    expect(voiceOf("999999999")).toBe("female");
    expect(voiceOf(undefined)).toBe("female");
  });

  it("leaves the copy alone for the Page it was written for", () => {
    expect(spokenBy("male", CHOICES)).toBe(CHOICES);
  });

  /** คะ ends a question and ค่ะ ends a statement; writing ค่ะ on both is the visible mistake. */
  it("ends a question with คะ and a statement with ค่ะ", () => {
    expect(spokenBy("female", "สนใจแบบไหนครับ")).toBe("สนใจแบบไหนคะ");
    expect(spokenBy("female", "มีแบบนี้ไหมครับ")).toBe("มีแบบนี้ไหมคะ");
    expect(spokenBy("female", "ขออภัยครับ")).toBe("ขออภัยค่ะ");
    expect(spokenBy("female", "รอสักครู่นะครับ")).toBe("รอสักครู่นะคะ");
    expect(spokenBy("female", "ยินดีครับผม")).toBe("ยินดีค่ะ");
  });

  it("says เรา where the copy says ผม", () => {
    expect(spokenBy("female", "ผมคิดให้ได้เฉพาะแบบนี้ครับ")).toBe("เราคิดให้ได้เฉพาะแบบนี้ค่ะ");
  });

  /**
   * Hair, not a pronoun. Critical illness is three of the arrangements sold here, and what a
   * customer asks after chemotherapy is exactly this word.
   */
  it("does not rewrite the hair on somebody's head", () => {
    expect(spokenBy("female", "ผมร่วงเคลมได้ไหมครับ")).toBe("ผมร่วงเคลมได้ไหมคะ");
    expect(spokenBy("female", "เส้นผมไม่เกี่ยวครับ")).toBe("เส้นผมไม่เกี่ยวค่ะ");
  });

  it("turns the whole menu over without leaving a ครับ behind", () => {
    const said = spokenBy("female", CHOICES);
    expect(said).not.toContain("ครับ");
    expect(said).toContain("สวัสดีค่ะ");
  });
});
