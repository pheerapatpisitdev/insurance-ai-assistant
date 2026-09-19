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

describe("which question opens which list", () => {
  /**
   * The index is declared rather than searched, so every route in it can be pressed. These
   * are those presses.
   *
   * The rule the split rests on: a block may be fetched rather than always sent only when its
   * absence makes the assistant say so. The illness names qualify — the summary that always
   * travels carries the counts and an instruction to offer the full list — where the plan
   * rules never could, which is why they are not in here.
   */
  it("opens the rider that was named, and only that one", async () => {
    /**
     * Checked by which list was opened, not by a disease name: the same illness appears in
     * several of these contracts — อัลไซเมอร์ opens both DCI's list and CI 123's — so a name
     * proves nothing about which block travelled.
     */
    const opened = (k: string) => {
      const at = k.indexOf("## รายชื่อโรค");
      if (at < 0) return [];
      // the plan sections head their rider and pairing lists the same way, so only the
      // detail block's own headings count
      return k.slice(at).split("\n").filter((l) => l.startsWith("### ")).map((l) => l.slice(4));
    };
    for (const [q, rider] of [
      ["DCI คุ้มครองโรคอะไรบ้าง", dci.name],
      ["iShield คุ้มครองโรคอะไร", "iShield"],
      ["CI 123 มีโรคอะไรบ้าง", ci123.name],
      ["โรคร้ายโซชิลด์ คุ้มครองอะไร", rrss.name],
    ] as const) {
      const listed = opened(await assembleKnowledge(q));
      expect(listed, q).toHaveLength(1);
      expect(listed[0], q).toContain(rider);
    }
  });

  it("answers “โรคร้ายแรงมีอะไรบ้าง” with the products, not with 239 diagnoses", async () => {
    /**
     * The question a customer is actually asking there is which contracts cover critical
     * illness. It used to open all four name lists — twelve thousand characters, and the
     * wrong answer besides.
     */
    /**
     * Measured against the spine every question carries rather than against a number: a
     * fixed ceiling here is a number each new plan walks into — the sixth one already did,
     * at 11,316 characters of spine against a limit of 11,000 — while what is actually
     * being pinned is that no illness list travelled, which is exactly "no longer than the
     * spine".
     */
    const spine = (await assembleKnowledge("สวัสดี")).length;
    for (const q of ["โรคร้ายแรงมีอะไรบ้าง", "โรคร้ายแรงมีแบบไหนบ้าง", "อยากได้ประกันโรคร้ายแรง"]) {
      const k = await assembleKnowledge(q);
      expect(k, q).toContain("## คุ้มครองโรคร้ายแรง");
      expect(k, q).not.toContain("## รายชื่อโรค");
      // the four products are named, with what each one is
      expect(k, q).toContain("iShield");
      expect(k, q).toContain("(DCI)");
      expect(k, q).toContain("(CI 123)");
      expect(k, q).toContain("โรคร้ายโซชิลด์");
      expect(k.length, q).toBeLessThanOrEqual(spine);
    }
  });

  it("names which plans each rider is sold with, so the answer can be acted on", async () => {
    const k = await assembleKnowledge("โรคร้ายแรงมีแบบไหนบ้าง");
    expect(k).toContain("ซื้อพ่วงกับ Life Protect x 1.5 / x 2, iSmart 80/6, Life Treasure");
    // and iShield is not described as a rider, because it is a plan
    expect(k).toContain("**iShield** — เป็น**แบบประกันหลัก** ไม่ใช่สัญญาเพิ่มเติม");
  });

  it("opens none of them for a question about something else", async () => {
    const k = await assembleKnowledge("Life Protect ทุนขั้นต่ำเท่าไหร่");
    expect(k).not.toContain("## รายชื่อโรค");
    expect(k).not.toContain(ci123.groups[4].diseases[0]);
    // but it still says how many there are, and that the names can be had
    expect(k).toContain("(DCI) — 31 โรค");
    expect(k).toContain("รวม 124 โรค");
    expect(k).toContain("ขอรายชื่อเต็มได้ครับ");
  });

  it("keeps the whole spine on every question, whatever it opens", async () => {
    for (const q of ["DCI คุ้มครองกี่โรค", "จ่ายรายเดือนได้ไหม", "สวัสดี"]) {
      const k = await assembleKnowledge(q);
      // the pairing rules are the ones a miss would answer wrongly rather than not at all
      expect(k, q).toContain("HIC");
      expect(k, q).toContain("ไม่สามารถซื้อคู่กับ MEX, MEB หรือ iHealthy Ultra");
      for (const plan of ["LIFEPROTECT", "ISMART", "LIFETREASURE", "ISHIELD", "PLB"]) {
        expect(k, `${q} · ${plan}`).toContain(`รหัส ${plan}`);
      }
    }
  });

  it("sends a standard answer only when its own recogniser fires", async () => {
    const waiting = await assembleKnowledge("มีระยะเวลารอคอยกี่วัน");
    expect(waiting).toContain("iHealthy Ultra · waiting");
    const unrelated = await assembleKnowledge("PLB รับประกันถึงอายุเท่าไหร่");
    expect(unrelated).not.toContain("· waiting");
  });

  it("costs about half of what it did, on the questions people actually ask", async () => {
    const everything = (await assembleKnowledge()).length;
    const ordinary = (await assembleKnowledge("HIC ซื้อคู่กับ MEB ได้ไหม")).length;
    expect(ordinary).toBeLessThan(everything * 0.5);
    // and nothing is routed away on a call that names no question at all
    expect(everything).toBeGreaterThan(20000);
  });
});
