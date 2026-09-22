import { describe, expect, it, vi } from "vitest";
import contract from "../../data/riders/ihealthy-ultra-contract.json";
import claims from "../../data/claims/admission-criteria.json";
import {
  claimRules, healthContract, healthKnowledgeDetail, healthKnowledgeSummary, healthTopicsFor,
} from "@/lib/health-knowledge";

/**
 * The health contract's own words, and the fact that the assistant can reach them.
 *
 * The benefit sheet has been in this repository from the start and the policy wording never
 * was: "ข้อยกเว้นมีอะไรบ้าง" could be answered with three examples and the sentence that there
 * were twenty-one, which is a true statement about what the model had been shown and a poor
 * one about a system that now holds all twenty-one. What is pinned here is that each block
 * reaches the model when it is asked for, and stays out of the prompt when it is not.
 */
vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({
    from: () => ({ select: () => ({ eq: () => ({ limit: async () => ({ data: [], error: null }) }) }) }),
  }),
}));
const { assembleKnowledge } = await import("@/lib/copilot/knowledge");

describe("the policy wording the contract carries", () => {
  it("is all twenty-one exclusions, numbered as the contract numbers them", () => {
    expect(contract.exclusions).toHaveLength(21);
    expect(contract.exclusions.map((e) => e.no)).toEqual(
      Array.from({ length: 21 }, (_, i) => i + 1),
    );
  });

  it("carries the company's sentences, not a summary of them", () => {
    // a shortened exclusion is a rewritten one, and the four longest run past 300 characters
    for (const e of contract.exclusions) {
      expect(e.text.length, `ข้อ ${e.no}`).toBeGreaterThan(50);
      expect(e.text.trim(), `ข้อ ${e.no}`).toBe(e.text);
      expect(e.text, `ข้อ ${e.no}`).not.toMatch(/^\d/);
    }
    // the AIDS clause is the long one; if it were trimmed this is what would go first
    expect(contract.exclusions[3].text).toContain("Kaposi");
    expect(contract.exclusions.some((e) => e.text.length > 300)).toBe(true);
  });

  it("keeps the numbers an agent is rung up about", () => {
    const c = healthContract();
    expect(c.gracePeriodDays).toBe(31);
    expect(c.incontestableYears).toBe(2);
    expect(c.claimEvidenceDays).toBe(90);
    expect(c.payoutDays).toBe(15);
    expect(c.lateInterestPercent).toBe(15);
    // the three grounds on which the company may decline to renew
    expect(c.conditions.find((x) => x.no === 7)?.items).toHaveLength(3);
  });
});

describe("the admission rules, which belong to no product", () => {
  it("is the regulator's table and the two-indicator threshold", () => {
    const { simpleDisease, byCondition } = claimRules();
    expect(simpleDisease.criteria).toHaveLength(8);
    expect(simpleDisease.threshold).toContain("2 ข้อ");
    expect(byCondition.map((c) => c.code)).toEqual(["RESPIRATORY", "GASTRO", "VERTIGO"]);
  });

  /**
   * The one assertion in this file that is about safety rather than accuracy.
   *
   * Eight numbered thresholds read like a test a customer can sit, and the honest answer is
   * that a doctor admits them and the company pays or does not. The warning is emitted from
   * the data file so the page, the bot and the web chat cannot drift into three different
   * ones — so what is pinned is that it travels with the numbers, every time.
   */
  it("never sends the thresholds without the warning that goes with them", () => {
    const detail = healthKnowledgeDetail("เกณฑ์แอดมิดเป็นยังไง");
    expect(detail).toContain(claims.simpleDisease.criteria[0]);
    expect(detail).toContain(claims.caution);
    expect(claims.caution).toContain("ห้ามบอกลูกค้าว่าเคสของเขาจะผ่านหรือไม่ผ่าน");
  });
});

describe("which question opens which block", () => {
  const opened = (q: string) => healthTopicsFor(q).map((t) => t.code);

  it("opens the block that was asked for", () => {
    for (const [q, code] of [
      ["ข้อยกเว้นมีอะไรบ้าง", "EXCLUSIONS"],
      ["อะไรบ้างที่ไม่คุ้มครอง", "EXCLUSIONS"],
      ["ถ้าค้างเบี้ยจะเป็นยังไง", "CONDITIONS"],
      ["บริษัทไม่ต่อสัญญาได้ไหม", "CONDITIONS"],
      ["ทำไมนอนโรงพยาบาลแล้วเคลมไม่ได้", "ADMISSION"],
      ["ท้องเสียแอดมิดได้ไหม", "ADMISSION"],
      ["ต้องสำรองจ่ายก่อนไหม", "CLAIMING"],
      ["ใช้บัตรประกันยังไง", "CLAIMING"],
    ] as const) {
      expect(opened(q), q).toContain(code);
    }
  });

  it("opens nothing for a question about something else", () => {
    for (const q of ["Life Protect ทุนขั้นต่ำเท่าไหร่", "สวัสดีครับ", "ขอเบี้ยผู้ชายอายุ 40"]) {
      expect(opened(q), q).toEqual([]);
    }
  });

  /**
   * The summary is what makes the split honest: a question that did not fetch a block still
   * has to leave the assistant able to say the block exists and offer it. Without this the
   * bot answers "ไม่มีในระบบ" about twenty-one exclusions it is holding.
   */
  it("still says the full text exists when it was not fetched", () => {
    const summary = healthKnowledgeSummary();
    expect(summary).toContain("21 ข้อ");
    expect(summary).toContain("ห้ามบอกว่าไม่มีในระบบ");
    expect(summary).toContain("8 ข้อ");
  });
});

describe("what the web chat is handed", () => {
  it("carries the summary on every question, whatever it opens", async () => {
    for (const q of ["สวัสดี", "ข้อยกเว้นมีอะไรบ้าง", "DCI คุ้มครองกี่โรค"]) {
      const k = await assembleKnowledge(q);
      expect(k, q).toContain("## เงื่อนไขและการเคลมประกันสุขภาพ — สรุป");
    }
  });

  it("puts the wording in front of the model when it is asked for", async () => {
    const k = await assembleKnowledge("ข้อยกเว้นของประกันสุขภาพมีอะไรบ้าง");
    expect(k).toContain(contract.exclusions[0].text);
    expect(k).toContain(contract.exclusions[20].text);
    expect(k).toContain(contract.exclusionsIntro);
  });

  it("keeps it out when the question is about something else", async () => {
    const k = await assembleKnowledge("Life Protect ทุนขั้นต่ำเท่าไหร่");
    expect(k).not.toContain("## เงื่อนไขและการเคลมประกันสุขภาพ — ฉบับเต็ม");
    expect(k).not.toContain(contract.exclusions[3].text);
    // but it still says the text is there to be had
    expect(k).toContain("ห้ามบอกว่าไม่มีในระบบ");
  });

  /**
   * `## รายชื่อโรค` is the last `##` of the document by design — `copilot-diseases` reads
   * every `### ` after it to see which illness lists a question opened. These blocks head
   * their sections the same way, so a question that opens both must not leave them on the
   * wrong side of it, or four contract headings are counted as four more illness lists.
   */
  it("sits before the illness blocks, whose headings are read positionally", async () => {
    const k = await assembleKnowledge("DCI คุ้มครองโรคอะไรบ้าง และข้อยกเว้นสุขภาพมีอะไร");
    const health = k.indexOf("## เงื่อนไขและการเคลมประกันสุขภาพ — ฉบับเต็ม");
    const diseases = k.indexOf("## รายชื่อโรค");
    expect(health).toBeGreaterThan(-1);
    expect(diseases).toBeGreaterThan(-1);
    expect(health).toBeLessThan(diseases);
    // and the positional read still finds exactly the one rider that was named
    const after = k.slice(diseases).split("\n").filter((l) => l.startsWith("### "));
    expect(after).toHaveLength(1);
  });
});
