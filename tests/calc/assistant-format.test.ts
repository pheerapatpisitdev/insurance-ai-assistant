import { describe, it, expect } from "vitest";
import { quote } from "@/calc/quote";
import type { QuoteInput } from "@/calc/types";
import { baht, citationLine, quoteFooter, quoteReply } from "@/lib/assistant/format";

const BASE: QuoteInput = {
  planCode: "LIFEPROTECT", variant: "WLF99H", age: 35, sex: "M",
  mode: "annual", sumAssured: 1_000_000, basis: "sumAssured", riders: [],
};

describe("money in a chat reply", () => {
  it("drops the decimals when a premium is a whole number of baht", () => {
    expect(baht(1_720_000)).toBe("17,200");
  });

  it("keeps satang when there are any", () => {
    expect(baht(127_850)).toBe("1,278.50");
  });

  it("pads a single satang digit", () => {
    expect(baht(100_005)).toBe("1,000.05");
  });
});

describe("quote reply", () => {
  it("says an annual premium once instead of twice", () => {
    const reply = quoteReply(BASE, quote(BASE));
    expect(reply).toContain("เบี้ยรายปี 17,200 บาท");
    expect(reply).not.toContain("รวมเบี้ยรายปี");
  });

  it("shows the year's total alongside a monthly premium, because they differ", () => {
    const input = { ...BASE, mode: "monthly" as const };
    const reply = quoteReply(input, quote(input));
    expect(reply).toContain("เบี้ยรายเดือน");
    expect(reply).toContain("รวมทั้งปี");
  });

  it("names the customer and the cover on one line", () => {
    expect(quoteReply(BASE, quote(BASE))).toContain("ชาย 35 ปี · ทุน 1,000,000 บาท");
  });

  it("keeps the death benefit split by age band", () => {
    const reply = quoteReply(BASE, quote(BASE));
    expect(reply).toContain("ก่อนอายุ 60 ปี 2,000,000 บาท");
    expect(reply).toContain("อายุ 60 ปีขึ้นไป 1,000,000 บาท");
  });

  it("leaves out a per-contract breakdown when the plan is the only thing priced", () => {
    const reply = quoteReply(BASE, quote(BASE));
    // the plan name appears as the heading; a breakdown would repeat it on its own line
    expect(reply.split("\n").filter((l) => l.startsWith("- Life Protect+"))).toHaveLength(0);
  });

  it("breaks the total down once a rider is added", () => {
    const input: QuoteInput = { ...BASE, riders: [{ code: "AP", sumAssured: 500_000 }] };
    const reply = quoteReply(input, quote(input));
    expect(reply).toMatch(/\n- .*AP.* บาท/);
  });
});

describe("quote footer", () => {
  it("always says the number is not a formal quotation", () => {
    expect(quoteFooter(false, "monthly")).toContain("ไม่ใช่ใบเสนอราคา");
  });

  it("offers other payment terms when one was assumed", () => {
    expect(quoteFooter(true, "annual")).toContain("ระยะเวลาชำระเบี้ยแบบอื่น");
  });

  it("offers other frequencies only when the term was the customer's own choice", () => {
    expect(quoteFooter(false, "annual")).toContain("ราย 6 เดือน");
    expect(quoteFooter(true, "annual")).not.toContain("ราย 6 เดือน");
  });

  it("stays at two lines so the premium is not buried", () => {
    for (const assumed of [true, false]) {
      for (const mode of ["annual", "semi", "monthly"] as const) {
        expect(quoteFooter(assumed, mode).split("\n").length).toBeLessThanOrEqual(2);
      }
    }
  });
});

describe("citations", () => {
  it("mentions a document once however many passages came from it", () => {
    const line = citationLine([
      { title: "HelloHealthy_EP3", page: 3 },
      { title: "HelloHealthy_EP3", page: 3 },
      { title: "HelloHealthy_EP3", page: 1 },
    ]);
    expect(line).toBe("ที่มา: HelloHealthy_EP3 หน้า 1, 3");
  });

  it("separates two documents", () => {
    expect(citationLine([{ title: "ก", page: 2 }, { title: "ข", page: 5 }]))
      .toBe("ที่มา: ก หน้า 2 · ข หน้า 5");
  });

  it("names a document that has no page number", () => {
    expect(citationLine([{ title: "ค", page: null }])).toBe("ที่มา: ค");
  });
});
