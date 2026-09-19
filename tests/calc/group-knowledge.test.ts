import { describe, expect, it, vi } from "vitest";

/**
 * What the assistant knows about ประกันภัยกลุ่ม, and where a question about it goes.
 *
 * Two halves of one thing, so they are tested together: knowledge nothing routes to is
 * knowledge nobody reads, and a route to an empty section is worse than no route at all.
 *
 * The figures are asserted against the same tables /group-insurance prices from, never
 * against a fixture — the whole claim of this module is that the two cannot disagree.
 */

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({
    from: () => ({ select: () => ({ eq: () => ({ limit: async () => ({ data: [], error: null }) }) }) }),
  }),
}));

const { assembleKnowledge } = await import("@/lib/copilot/knowledge");
const { groupPointer, groupSection, groupSpine, groupTablesFor } = await import("@/lib/copilot/group-knowledge");
const { aboutAGroup, productByTopic, productNamedIn } = await import("@/lib/assistant/choose");
const { GI, PRODUCT_LIMITS } = await import("@/lib/group-insurance/data");

describe("a question about a company's staff", () => {
  /**
   * The case this whole feature exists for.
   *
   * "ประกันสุขภาพ" is inside "ประกันสุขภาพกลุ่ม", so the individual health plan used to claim
   * it — and a company of thirty was asked its age and its sex and quoted one person's
   * premium. An answer that is wrong and looks right.
   */
  it("is not read as the individual plan whose name it contains", () => {
    expect(productNamedIn("ประกันสุขภาพกลุ่มมีไหม")).toBeUndefined();
    expect(productNamedIn("สนใจประกันชีวิตกลุ่มให้พนักงาน")).toBeUndefined();
    expect(productByTopic("ค่าห้องของประกันสุขภาพกลุ่มเท่าไหร่")).toBeUndefined();
  });

  it("is recognised however the customer happens to phrase it", () => {
    for (const said of [
      "ประกันกลุ่มมีไหม",
      "ประกันภัยกลุ่มคืออะไร",
      "อยากทำประกันอุบัติเหตุกลุ่ม",
      "บริษัทอยากทำให้พนักงานประจำ",
      "ทำประกันให้พนักงาน 30 คน",
      "มี group health ไหม",
      "ประกันแบบหมู่คณะ",
      "กลุ่มพนักงานฝ่ายผลิต",
    ]) {
      expect(aboutAGroup(said), said).toBe(true);
    }
  });

  /**
   * The other half of a guard, and the half that is easy to forget.
   *
   * "กลุ่ม" on its own is a word this business uses for กลุ่มโรค and กลุ่มอาการ, and a guard
   * that swallowed those would take an individual customer mid-quotation and drop them at a
   * product for companies.
   */
  it("does not swallow the individual customer who happens to say กลุ่ม", () => {
    for (const said of [
      "โรคร้ายแรงกลุ่มไหนบ้าง",
      "กลุ่มอาการนี้คุ้มครองไหม",
      "ประกันสุขภาพมีไหม",
      "ไลฟ์เทรเชอร์ทุน 1 ล้าน",
      "พนักงานออฟฟิศอายุ 35 ทำได้ไหม",
    ]) {
      expect(aboutAGroup(said), said).toBe(false);
    }
    // and the individual plans still answer to their own names
    expect(productNamedIn("ประกันสุขภาพมีไหม")).toBe("ihealthy");
    expect(productNamedIn("โรคร้ายแรงกลุ่มไหนบ้าง")).toBeUndefined();
  });
});

describe("the spine, which a question about a company opens", () => {
  it("says outright that this is for companies and not for one person", () => {
    const spine = groupSpine();
    expect(spine).toContain("ประกันภัยกลุ่ม");
    expect(spine).toContain("ไม่ใช่รายบุคคล");
    expect(spine).toContain("พนักงาน");
  });

  it("carries the head-count limits off the real tables", () => {
    const spine = groupSpine();
    const { health, pa } = PRODUCT_LIMITS;
    expect(spine).toContain(`${health.min}–${health.max} คน`);
    expect(spine).toContain(`${pa.min}–${pa.max.toLocaleString("en-US")} คน`);
  });

  /**
   * The bands are on purpose absent. They are how a premium is looked up, and the chat does
   * not look premiums up — a list of them in the prompt is an invitation to try, which is
   * the one thing this section spends four bullets forbidding.
   */
  it("leaves out the pricing bands, which are only useful for pricing", () => {
    const spine = groupSpine();
    for (const band of [...GI.healthEmployeeRanges, ...GI.paEmployeeRanges]) {
      expect(spine, band).not.toContain(band);
    }
  });

  it("names the three risk classes and says the fourth is not written", () => {
    const spine = groupSpine();
    for (const n of [1, 2, 3]) expect(spine).toContain(`ลักษณะธุรกิจ ${n}`);
    expect(spine).toContain("ขั้น 4");
    expect(spine).toContain("ไม่รับทำประกัน");
  });

  it("refuses to price, says where pricing happens, and says what to ask for", () => {
    const spine = groupSpine();
    expect(spine).toContain("คิดเบี้ยประกันกลุ่มให้ไม่ได้");
    expect(spine).toContain("/group-insurance");
    expect(spine).toContain("ลักษณะธุรกิจ, จำนวนพนักงาน, แผนที่สนใจ");
  });

  /**
   * The rule a model reading a rate table would never apply, written out so it does not have
   * to be inferred: the band comes from the total across every group on the quotation.
   */
  it("explains why a premium cannot be guessed from a table", () => {
    expect(groupSpine()).toContain("จำนวนคนรวมทั้งใบเสนอราคา");
  });

  /**
   * Without this line a question whose table was not fetched is answered "ไม่มีในระบบ" —
   * a lie about a system that has it. The illness lists carry the same sentence for the
   * same reason.
   */
  it("tells the assistant the full tables exist even when they were not sent", () => {
    const spine = groupSpine();
    expect(spine).toContain("มีอยู่ในระบบ");
    expect(spine).toContain("ห้ามบอกว่าไม่มีในระบบ");
  });
});

describe("the benefit tables, which wait to be asked for", () => {
  it("stay shut for a question that names neither product", () => {
    expect(groupTablesFor("ประกันกลุ่มคืออะไร")).toEqual([]);
    expect(groupSection("ประกันกลุ่มคืออะไร")).toBe(groupSpine());
  });

  it("open the one the question names", () => {
    expect(groupTablesFor("ประกันสุขภาพกลุ่มคุ้มครองค่าห้องเท่าไหร่")).toEqual(["health"]);
    expect(groupTablesFor("ประกันอุบัติเหตุกลุ่มคุ้มครองอะไรบ้าง")).toEqual(["pa"]);
    expect(groupTablesFor("สุขภาพกลุ่มกับอุบัติเหตุกลุ่มต่างกันยังไง")).toEqual(["health", "pa"]);
  });

  it("carry every line of the sheet, across all six plans", () => {
    const health = groupSection("ประกันสุขภาพกลุ่มคุ้มครองอะไรบ้าง");
    for (const row of GI.healthBenefits) {
      expect(health, row.key).toContain(row.label);
      // the sixth column is the one a truncated table loses first
      expect(health, row.key).toContain(row.values[5]);
    }
    const pa = groupSection("ประกันอุบัติเหตุกลุ่มคุ้มครองอะไรบ้าง");
    for (const row of GI.paMainBenefits) {
      expect(pa, row.key).toContain(row.label);
      expect(pa, row.key).toContain(row.values[5]);
    }
    for (const level of GI.paMeCoverLevels) expect(pa).toContain(level);
  });

  it("marks the rider's line as the rider's, not the main plan's", () => {
    expect(groupSection("ประกันสุขภาพกลุ่ม opd")).toContain("[สัญญาเพิ่มเติม OPD]");
    expect(groupSection("ประกันอุบัติเหตุกลุ่ม me")).toContain("[สัญญาเพิ่มเติม ME]");
  });

  it("says these are cover amounts and not premiums", () => {
    expect(groupSection("ประกันสุขภาพกลุ่ม")).toContain("ความคุ้มครอง ไม่ใช่เบี้ย");
  });
});

describe("no premium ever reaches a prompt", () => {
  /**
   * The rate tables are in this repository and a model handed one would read a number out of
   * it. This walks every premium the two products can charge and asserts none of them is in
   * the text — the same guarantee the life plans already have, and the reason `/group-insurance`
   * exists as the only place a group premium is produced.
   */
  it("holds not one figure that only the rate tables have", async () => {
    // everything asked for at once, so the biggest group section this can ever produce is
    // the one under test
    const text = await assembleKnowledge("ประกันสุขภาพกลุ่มกับอุบัติเหตุกลุ่ม ค่าห้อง opd me");

    const premiums = new Set<number>();
    for (const table of [GI.healthIpdPremiums, GI.paMainPremiums, GI.paMePremiums]) {
      for (const biz of Object.values(table)) for (const row of Object.values(biz)) for (const v of row) premiums.add(v);
    }
    for (const row of Object.values(GI.healthOpdPremiums)) for (const v of row) premiums.add(v);

    /**
     * Six of the 238 premiums are also cover amounts — 1,500 is a premium in one table and a
     * daily room limit in another — and the policy minimum is a seventh. Those are legitimately
     * on the page, so the assertion is made on the 232 that can only be premiums. A rate table
     * dumped into a prompt would bring all 232 with it; no innocent sentence brings one.
     */
    const cover = new Set<number>();
    for (const row of [...GI.healthBenefits, ...GI.paMainBenefits]) {
      for (const v of row.values) cover.add(Number(v.replace(/,/g, "")));
    }
    for (const v of GI.paMeCoverLevels) cover.add(Number(v.replace(/,/g, "")));
    cover.add(3000); // the minimum total premium, which the conditions state outright

    /**
     * Matched as a whole figure, not as a run of digits. A plain `includes` found "150"
     * inside the cover amount "150,000" and reported eight leaks that were not there — and a
     * test that cries wolf about this particular thing is worse than none, because the next
     * person to see it fail will assume the same.
     */
    const appears = (n: number) =>
      new RegExp(`(?<![\\d,])${n.toLocaleString("en-US").replace(/,/g, ",")}(?![\\d,])`).test(text);

    const premiumOnly = [...premiums].filter((n) => !cover.has(n));
    expect(premiumOnly.length).toBeGreaterThan(200);
    const leaked = premiumOnly.filter(appears);
    expect(leaked, `เบี้ยหลุดเข้า prompt: ${leaked.slice(0, 5).join(", ")}`).toEqual([]);
  });

  /**
   * The minimum is a condition of the policy and belongs on the page; what it must not be is
   * readable as the answer to "เบี้ยเท่าไหร่". The life plans' own minimum carries a note
   * saying so, having been got wrong there first.
   */
  it("states the policy minimum as a condition rather than as a price", () => {
    const spine = groupSpine();
    expect(spine).toContain("3,000 บาท");
    expect(spine).toContain("ไม่ใช่ราคาของแผนใดแผนหนึ่ง");
    expect(spine).not.toContain("เบี้ยประกันภัย รวมขั้นต่ำ: ไม่ต่ำกว่า 3,000");
  });
});

describe("the knowledge as a whole", () => {
  /**
   * Three tiers, and the cost is why. The knowledge is rebuilt into the prompt of every
   * question anybody asks, and most of them are about one person's life cover — so a group
   * question gets the whole section and everybody else pays for two lines.
   */
  it("gives an unrelated question the pointer and nothing more", async () => {
    const text = await assembleKnowledge("HIC ซื้อคู่กับ MEB ได้ไหม");
    expect(text).toContain(groupPointer());
    expect(text).not.toContain("### ลักษณะธุรกิจ");
    expect(text).not.toContain("วงเงินคุ้มครอง (บาท) แผน 1 → แผน 6");
  });

  it("opens the spine for a question about a company, and the table when it names one", async () => {
    const spine = await assembleKnowledge("ประกันกลุ่มให้พนักงานรับกี่คน");
    expect(spine).toContain("### ลักษณะธุรกิจ");
    expect(spine).not.toContain("วงเงินคุ้มครอง (บาท) แผน 1 → แผน 6");

    const table = await assembleKnowledge("ประกันสุขภาพกลุ่มคุ้มครองค่าห้องเท่าไหร่");
    expect(table).toContain("### ลักษณะธุรกิจ");
    expect(table).toContain("ประกันสุขภาพกลุ่ม (Group Health) — วงเงินคุ้มครอง");
  });

  /**
   * The mirror of the fault this feature closed: an individual customer naming health must
   * not be handed the company sheet.
   */
  it("keeps the group tables away from a question about one person", async () => {
    const text = await assembleKnowledge("ประกันสุขภาพค่าห้องเท่าไหร่");
    expect(text).not.toContain("วงเงินคุ้มครอง (บาท) แผน 1 → แผน 6");
    expect(groupTablesFor("ประกันสุขภาพค่าห้องเท่าไหร่")).toEqual([]);
  });

  /**
   * After the plans, before the illnesses — and the second half is load-bearing:
   * `copilot-diseases` reads every `### ` heading after `## รายชื่อโรค` to see which illness
   * lists a question opened, so a section placed after it is counted as four more of them.
   */
  it("sits after the individual plans and before the illness lists", async () => {
    const text = await assembleKnowledge("DCI คุ้มครองโรคอะไรบ้าง ประกันกลุ่มพนักงานด้วย");
    const groupAt = text.indexOf("## ประกันภัยกลุ่ม (Group Insurance)");
    expect(groupAt).toBeGreaterThan(0);
    expect(text.lastIndexOf("### สัญญาเพิ่มเติมที่ซื้อกับแบบนี้ได้")).toBeLessThan(groupAt);
    expect(groupAt).toBeLessThan(text.indexOf("## รายชื่อโรค"));
  });

  it("costs an unrelated question almost nothing", () => {
    // what every call pays for, against what a group question opens on top of it
    expect(groupPointer().length).toBeLessThan(500);
    expect(groupSpine().length).toBeLessThan(2500);
  });
});
