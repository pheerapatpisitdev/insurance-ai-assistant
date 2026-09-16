import { describe, expect, it } from "vitest";
import { scrubForLearning } from "@/lib/assistant/unanswered";

/**
 * What may be written down when a customer asks something this system could not answer.
 *
 * The published policy is the specification, not a nicety. advisortool.app/privacy tells
 * customers that a question the assistant cannot answer is kept "ในรูปประโยคที่ระบบเรียบเรียง
 * ใหม่" for thirty days and tied to nobody — and that anything personal they type is removed.
 * The owner chose to keep collecting on exactly those terms rather than widen them, so the
 * rewriting is the whole of what this module does and these are the tests that hold it there.
 *
 * Insurance is the reason it matters more here than elsewhere. Nobody is asked for a medical
 * history, and customers give one anyway: "ผมเป็นเบาหวานมา 5 ปี ทำได้ไหม" is an ordinary
 * opening message and it is health data, which PDPA treats more strictly than a name.
 */

describe("what is taken out before a question is written down", () => {
  it("removes a phone number, however it is spaced", () => {
    for (const written of ["0812345678", "081-234-5678", "081 234 5678", "+66812345678"]) {
      const out = scrubForLearning(`สนใจครับ โทร ${written} ได้เลย`);
      expect(out, written).not.toContain("81234");
      expect(out, written).toContain("[เบอร์]");
    }
  });

  it("removes an email and a national id", () => {
    expect(scrubForLearning("ส่งมาที่ somchai@gmail.com นะ")).toContain("[อีเมล]");
    expect(scrubForLearning("ส่งมาที่ somchai@gmail.com นะ")).not.toContain("somchai");
    expect(scrubForLearning("เลขบัตร 1234567890123")).toContain("[เลขบัตร]");
  });

  it("removes a line id, which customers give more often than an email", () => {
    const out = scrubForLearning("แอดไลน์มาได้ครับ line id: somchai_2535");
    expect(out).toContain("[ไลน์]");
    expect(out).not.toContain("somchai_2535");
  });

  /**
   * An age and a sum assured are the question. Stripping them would leave "ผู้ชาย [เลข] ปี ทุน
   * [เลข]", which cannot be told apart from any other quotation and is no use for improving
   * an answer — so the scrub has to be narrower than "remove every number".
   */
  it("keeps the numbers that are the question", () => {
    const out = scrubForLearning("ชาย 40 ทุน 1 ล้าน เบี้ยเท่าไหร่");
    expect(out).toContain("40");
    expect(out).toContain("1 ล้าน");
  });

  it("keeps a plan's own code, which is not personal and is the point", () => {
    expect(scrubForLearning("PLB10 กับ W80F06 ต่างกันยังไง")).toContain("PLB10");
    expect(scrubForLearning("PLB10 กับ W80F06 ต่างกันยังไง")).toContain("W80F06");
  });

  it("caps the length, so a pasted policy document cannot be stored whole", () => {
    const out = scrubForLearning("ก".repeat(900));
    expect(out).toBeDefined();
    expect(out!.length).toBeLessThanOrEqual(300);
  });

  it("collapses whitespace so the same question counts as the same question", () => {
    expect(scrubForLearning("  เบี้ย   เท่าไหร่  \n\n ครับ ")).toBe("เบี้ย เท่าไหร่ ครับ");
  });

  it("gives back nothing for a question with nothing left in it", () => {
    // a message that was only a phone number teaches nothing and is not worth keeping
    expect(scrubForLearning("0812345678")).toBeUndefined();
    expect(scrubForLearning("   ")).toBeUndefined();
  });
});
