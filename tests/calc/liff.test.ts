import { describe, it, expect } from "vitest";
import { shareLinkUrl } from "@/lib/liff";

describe("the share link used outside LINE", () => {
  it("carries the quote in the URL LINE expects", () => {
    expect(shareLinkUrl("เบี้ยรายปี 17,200 บาท"))
      .toBe("https://line.me/R/share?text=%E0%B9%80%E0%B8%9A%E0%B8%B5%E0%B9%89%E0%B8%A2%E0%B8%A3%E0%B8%B2%E0%B8%A2%E0%B8%9B%E0%B8%B5%2017%2C200%20%E0%B8%9A%E0%B8%B2%E0%B8%97");
  });

  it("escapes the characters that would otherwise end the query", () => {
    const url = shareLinkUrl("a&b=c#d");
    expect(url).toContain("a%26b%3Dc%23d");
    expect(url.split("?")[1].split("&")).toHaveLength(1);
  });

  it("survives a whole quote, newlines and all", () => {
    const quote = "Life Protect+ 100\nชาย 35 ปี · ทุน 1,000,000 บาท\n\nเบี้ยรายปี 17,200 บาท";
    expect(decodeURIComponent(shareLinkUrl(quote).split("text=")[1])).toBe(quote);
  });
});
