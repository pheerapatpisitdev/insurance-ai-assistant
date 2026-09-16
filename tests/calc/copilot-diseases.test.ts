import { describe, expect, it, vi } from "vitest";
import dci from "../../data/riders/dci-diseases.json";
import ishield from "../../data/riders/ishield-diseases.json";
import ci123 from "../../data/riders/ci123-diseases.json";
import rrss from "../../data/riders/rrss-diseases.json";

/**
 * The illness lists, and the fact that the assistant can actually see them.
 *
 * They sat in this repository for a long time without being in the knowledge, so "DCI
 * คุ้มครองกี่โรค" came back "ข้อมูลนี้ไม่มีในระบบ" — an answer that was true of what the model
 * had been shown and false of the system. What is pinned here is that every list reaches it,
 * with the count the company's own sheet gives.
 */
vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({
    from: () => ({ select: () => ({ eq: () => ({ limit: async () => ({ data: [], error: null }) }) }) }),
  }),
}));
const { assembleKnowledge } = await import("@/lib/copilot/knowledge");

describe("the illness lists the riders name", () => {
  it("are the counts the workbooks carry", () => {
    expect(dci.diseases).toHaveLength(31);
    expect(ishield.early).toHaveLength(20);
    expect(ishield.major).toHaveLength(50);
    expect(ci123.groups.map((g) => g.diseases.length)).toEqual([53, 2, 17, 6, 42, 4]);
    expect(rrss.groups.map((g) => g.diseases.length)).toEqual([10, 4]);
  });

  it("carry names and never a definition", () => {
    // the contract's wording is the contract's; a summarised definition is a rewritten one
    const every = [
      ...dci.diseases, ...ishield.early, ...ishield.major,
      ...ci123.groups.flatMap((g) => g.diseases), ...rrss.groups.flatMap((g) => g.diseases),
    ];
    expect(every.length).toBe(239);
    for (const name of every) {
      expect(name, name).not.toMatch(/หมายถึง/);
      expect(name.length, name).toBeLessThan(160);
      expect(name.trim()).toBe(name);
    }
  });

  it("all reach the model, with their totals", async () => {
    const k = await assembleKnowledge();
    expect(k).toContain("(DCI) — 31 โรค");
    expect(k).toContain("iShield — รวม 70 โรค");
    expect(k).toContain("(CI 123) — รวม 124 โรค");
    expect(k).toContain("(MCI) — รวม 14 โรค");
    // a name from the far end of the longest list, to prove nothing is truncated on the way
    expect(k).toContain(ci123.groups[4].diseases[41]);
    expect(k).toContain("ห้ามสรุปหรือย่อคำนิยามเอง");
  });
});
