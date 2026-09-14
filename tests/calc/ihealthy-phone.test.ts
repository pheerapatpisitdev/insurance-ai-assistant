import { describe, expect, it } from "vitest";
import { phoneColumns, PHONE_PLANS } from "@/lib/ihealthy-phone";

/** The six plans in the order the company's own sheet lists them. */
const ORDER = ["SMART", "BRONZE", "SILVER", "GOLD", "DIAMOND", "PLATINUM"];
const ADULT = ORDER;
/** Ages 6–10 buy only these two; the rate table says so and `plansFor` reads it off. */
const CHILD = ["SMART", "BRONZE"];

describe("the columns a phone-width picture carries", () => {
  it("is the three the sales page shows on a phone", () => {
    expect(phoneColumns(ORDER, ADULT)).toEqual(PHONE_PLANS);
    expect(PHONE_PLANS).toEqual(["BRONZE", "SILVER", "GOLD"]);
  });

  it("keeps a chosen plan that is not one of the three, in the sheet's order", () => {
    expect(phoneColumns(ORDER, ADULT, "PLATINUM")).toEqual(["BRONZE", "SILVER", "GOLD", "PLATINUM"]);
    expect(phoneColumns(ORDER, ADULT, "SMART")).toEqual(["SMART", "BRONZE", "SILVER", "GOLD"]);
  });

  it("does not repeat a chosen plan that is already one of the three", () => {
    expect(phoneColumns(ORDER, ADULT, "GOLD")).toEqual(["BRONZE", "SILVER", "GOLD"]);
  });

  it("falls back to every plan on sale when fewer than two of the three are", () => {
    expect(phoneColumns(ORDER, CHILD)).toEqual(CHILD);
    expect(phoneColumns(ORDER, CHILD, "SMART")).toEqual(CHILD);
  });

  it("never carries a plan the company will not sell at this age", () => {
    expect(phoneColumns(ORDER, CHILD, "PLATINUM")).toEqual(CHILD);
  });
});
