import { describe, expect, it } from "vitest";
import { pickedFromMenu } from "@/lib/assistant/choose";

describe("a number typed at a numbered menu", () => {
  it("picks the line it counts to", () => {
    expect(pickedFromMenu("1")).toBe("lifeprotect");
    expect(pickedFromMenu("2")).toBe("legacy");
    expect(pickedFromMenu("3")).toBe("ishield");
  });

  it("reads the ways a customer actually writes it", () => {
    for (const said of ["2 ครับ", "ข้อ 2", "แบบที่ 2", "เอาข้อ 2", "ขอแบบ 2", "สนใจ 2 ค่ะ", "2.", " 2 "]) {
      expect(pickedFromMenu(said), said).toBe("legacy");
    }
  });

  /** A Thai keyboard offers these, and a customer of sixty uses them. */
  it("reads Thai numerals", () => {
    expect(pickedFromMenu("๓")).toBe("ishield");
  });

  it("takes no number the list does not have", () => {
    expect(pickedFromMenu("4")).toBeUndefined();
    expect(pickedFromMenu("9")).toBeUndefined();
    expect(pickedFromMenu("0")).toBeUndefined();
  });

  /**
   * Everything else a customer types here carries a unit or a second digit, which is why a
   * bare 1 to 3 can be read as a choice at all.
   */
  it("is not a sum, an age, a term or a question", () => {
    for (const said of ["2 ล้าน", "อายุ 2 ขวบ", "35", "จ่าย 2 ปี", "2 คน", "ราคา 2", "มี 2 แบบไหม"]) {
      expect(pickedFromMenu(said), said).toBeUndefined();
    }
  });
});
