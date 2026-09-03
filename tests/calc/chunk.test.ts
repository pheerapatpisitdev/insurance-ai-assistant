import { describe, it, expect } from "vitest";
import { chunkPage, chunkPages } from "@/lib/knowledge/chunk";

const thai = (n: number) => "ผู้เอาประกันภัยจะได้รับความคุ้มครองตามเงื่อนไขที่ระบุไว้ในกรมธรรม์ ".repeat(n);

describe("chunking PDF text", () => {
  it("keeps a short page as one chunk", () => {
    const chunks = chunkPage("ข้อยกเว้นความคุ้มครองมีดังนี้\n\nการฆ่าตัวตายภายในหนึ่งปี", 3);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toMatchObject({ page: 3, ordinal: 0 });
    expect(chunks[0].content).toContain("ข้อยกเว้น");
  });

  it("drops text too short to be worth searching", () => {
    expect(chunkPage("หน้า 12", 12)).toHaveLength(0);
  });

  it("splits a long page and overlaps the pieces", () => {
    const chunks = chunkPage(thai(60), 1);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) expect(c.content.length).toBeLessThanOrEqual(1600);
    // the next chunk repeats the tail of the previous one so a sentence is never cut in half
    const head = chunks[1].content.slice(0, 80);
    expect(chunks[0].content.slice(-260)).toContain(head.slice(0, 40));
  });

  it("splits a single paragraph with no breaks at all", () => {
    const chunks = chunkPage("ก".repeat(5000), 2);
    expect(chunks.length).toBeGreaterThan(2);
    expect(chunks.every((c) => c.page === 2)).toBe(true);
  });

  it("numbers pages and keeps ordinals rising across a document", () => {
    const chunks = chunkPages([thai(30), thai(30), "สั้นเกินไป"]);
    expect(chunks.filter((c) => c.page === 1).length).toBeGreaterThan(0);
    expect(chunks.filter((c) => c.page === 2).length).toBeGreaterThan(0);
    expect(chunks.map((c) => c.ordinal)).toEqual([...chunks.map((_, i) => i)]);
  });

  it("breaks on numbered clauses", () => {
    const text = "เงื่อนไขทั่วไป\n1) ผู้เอาประกันภัยต้องแจ้งบริษัท\n2) บริษัทจะพิจารณาภายในสามสิบวัน";
    expect(chunkPage(text, 1)[0].content).toContain("1)");
  });
});
