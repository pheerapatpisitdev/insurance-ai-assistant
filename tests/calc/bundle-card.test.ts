import { describe, expect, it } from "vitest";
import { cardInputFrom, cardPath, type BundleCardInput } from "@/lib/quote-card";

const MAN40: BundleCardInput = {
  kind: "bundle", bundleCode: "LEGACY_FAMILY", tier: 1, age: 40, sex: "M", mode: "annual",
};

const params = (q: string) => new URLSearchParams(q);

describe("cardInputFrom, for a bundle", () => {
  it("reads a bundle and tier the registry knows", () => {
    expect(cardInputFrom(params("bundle=LEGACY_FAMILY&tier=1&age=40&sex=M&mode=annual"))).toEqual(MAN40);
  });

  /**
   * A card is a public URL. Everything in it is checked before anything is drawn, so a
   * hand-edited link either names an arrangement the agency sells or gets nothing.
   */
  it("refuses anything the registry does not recognise", () => {
    expect(cardInputFrom(params("bundle=NOPE&tier=1&age=40&sex=M"))).toBeUndefined();
    expect(cardInputFrom(params("bundle=LEGACY_FAMILY&tier=11&age=40&sex=M"))).toBeUndefined();
    expect(cardInputFrom(params("bundle=LEGACY_FAMILY&tier=0&age=40&sex=M"))).toBeUndefined();
    expect(cardInputFrom(params("bundle=LEGACY_FAMILY&age=40&sex=M"))).toBeUndefined();
    expect(cardInputFrom(params("bundle=LEGACY_FAMILY&tier=1.5&age=40&sex=M"))).toBeUndefined();
    expect(cardInputFrom(params("bundle=LEGACY_FAMILY&tier=1&age=120&sex=M"))).toBeUndefined();
    expect(cardInputFrom(params("bundle=LEGACY_FAMILY&tier=1&age=40&sex=X"))).toBeUndefined();
  });

  it("ignores a payment mode it does not sell", () => {
    expect(cardInputFrom(params("bundle=LEGACY_FAMILY&tier=1&age=40&sex=M&mode=weekly"))?.mode)
      .toBeUndefined();
  });
});

describe("cardPath, for a bundle", () => {
  it("writes the arrangement into the address", () => {
    expect(cardPath(MAN40)).toBe("/api/card?bundle=LEGACY_FAMILY&tier=1&age=40&sex=M&mode=annual");
  });

  it("survives the round trip back into an input", () => {
    expect(cardInputFrom(new URLSearchParams(cardPath(MAN40).split("?")[1]))).toEqual(MAN40);
  });
});
