import { describe, expect, it } from "vitest";
import { businessDate, hasExpired } from "@/calc/calendar";

describe("the day it is where the company is", () => {
  it("reads the Bangkok calendar, not the UTC one", () => {
    // 2027-03-31 17:00 UTC is already the first of April in Bangkok
    expect(businessDate(new Date("2027-03-31T17:00:00Z"))).toBe("2027-04-01");
    expect(businessDate(new Date("2027-03-31T16:59:59Z"))).toBe("2027-03-31");
  });

  it("lapses a rate table at Bangkok midnight and not seven hours later", () => {
    const expiresOn = "2027-03-31";
    // the seven hours a UTC comparison went on quoting from a table the agency had retired
    expect(hasExpired(new Date("2027-03-31T17:00:00Z"), expiresOn)).toBe(true);
    expect(hasExpired(new Date("2027-03-31T23:00:00Z"), expiresOn)).toBe(true);
    // and the last day of its life is still its own
    expect(hasExpired(new Date("2027-03-31T10:00:00Z"), expiresOn)).toBe(false);
  });
});
