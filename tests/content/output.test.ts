import { describe, expect, it } from "vitest";
import { DISCLAIMER, INSURER_LINE, TAX_LINE, footer, fullText } from "@/lib/content/output";

const piece = { hooks: ["เปิด"], body: "เนื้อ", closing: "ปิด", hashtags: ["#a"], imagePrompt: "", disclaimer: DISCLAIMER };

describe("the lines under a piece", () => {
  it("names the insurer under every piece, old ones included", () => {
    expect(fullText(piece)).toContain("รับประกันภัยโดย บมจ. กรุงไทย-แอกซ่า ประกันชีวิต");
    expect(fullText(piece).endsWith(INSURER_LINE)).toBe(true);
  });

  it("adds the tax line when the words talk about tax, whatever angle was picked", () => {
    expect(footer({ ...piece, body: "ลดหย่อนภาษีได้" })).toContain(TAX_LINE);
    expect(footer(piece)).not.toContain(TAX_LINE);
  });

  it("does not repeat a tax line the piece already carries", () => {
    const f = footer({ ...piece, body: "ภาษี", disclaimer: `${DISCLAIMER}\n${TAX_LINE}` });
    expect(f.split(TAX_LINE).length - 1).toBe(1);
  });
});
