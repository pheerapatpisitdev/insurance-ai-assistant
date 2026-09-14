import { describe, expect, it } from "vitest";
import { CHOOSE_HEALTH, CHOOSE_LIFE, productByTopic, productNamedIn } from "@/lib/assistant/choose";

describe("a message that names a plan", () => {
  it("recognises the health one", () => {
    for (const said of ["สนใจประกันสุขภาพค่ะ", "ไอเฮลท์ตี้ อัลตร้า ราคาเท่าไหร่", "iHealthy Ultra"]) {
      expect(productNamedIn(said)).toBe("ihealthy");
    }
  });

  it("recognises the life one", () => {
    for (const said of ["Life Protect x 2", "ไลฟ์โพรเทค", "สนใจประกันมรดก ทุน 1,000,000", "ประกันชีวิต"]) {
      expect(productNamedIn(said)).toBe("lifeprotect");
    }
  });

  it("recognises the two buttons it offers", () => {
    expect(productNamedIn(CHOOSE_HEALTH)).toBe("ihealthy");
    expect(productNamedIn(CHOOSE_LIFE)).toBe("lifeprotect");
  });

  it("names nothing when a message names both", () => {
    expect(productNamedIn("ประกันสุขภาพกับประกันชีวิต ต่างกันยังไง")).toBeUndefined();
  });

  it("names nothing when a message names neither", () => {
    for (const said of ["สนใจค่ะ", "สวัสดีครับ", "หญิง 35", "เท่าไหร่"]) {
      expect(productNamedIn(said)).toBeUndefined();
    }
  });
});

describe("a message that names no plan but says what it is about", () => {
  it("hears the health topics", () => {
    for (const said of ["ค่ารักษาเท่าไหร่", "ค่าห้องวันละเท่าไหร่", "เหมาจ่ายไหม", "OPD ได้ไหม", "แอดมิทเบิกได้ไหม"]) {
      expect(productByTopic(said)).toBe("ihealthy");
    }
  });

  it("hears the life ones", () => {
    for (const said of ["ทุน 1 ล้าน เท่าไหร่", "ขอทุน 5 แสน", "จ่าย 19 ปี", "เวนคืนได้เท่าไหร่"]) {
      expect(productByTopic(said)).toBe("lifeprotect");
    }
  });

  it("does not mistake a health declaration for a health plan", () => {
    // someone buying life cover is asked to declare, and asks about it
    for (const said of ["ต้องตรวจสุขภาพไหม", "แถลงสุขภาพยังไง", "สุขภาพไม่ดีทำได้ไหม"]) {
      expect(productByTopic(said)).toBeUndefined();
      expect(productNamedIn(said)).toBeUndefined();
    }
  });

  it("says nothing about a greeting", () => {
    for (const said of ["สนใจค่ะ", "สวัสดีครับ", "หญิง 35"]) {
      expect(productByTopic(said)).toBeUndefined();
    }
  });
});
