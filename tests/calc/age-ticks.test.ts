import { describe, expect, it } from "vitest";
import { ageTicks } from "@/lib/age-ticks";

/** the sales pages' chart: 286 units of drawing from the quoted age to the end of the contract */
const page = (from: number, to: number) => (at: number) => 46 + ((at - from) / (to - from)) * 286;

describe("the ages under a chart", () => {
  it("writes every tenth birthday between the age quoted and the end of the contract", () => {
    expect(ageTicks(35, 99, page(35, 99), 18)).toEqual([35, 40, 50, 60, 70, 80, 90, 99]);
  });

  it("drops a decade that would sit on top of the age quoted", () => {
    expect(ageTicks(38, 99, page(38, 99), 18)).toEqual([38, 50, 60, 70, 80, 90, 99]);
  });

  it("drops a decade that would sit on top of the age the contract ends", () => {
    expect(ageTicks(20, 91, page(20, 91), 18)).toEqual([20, 30, 40, 50, 60, 70, 80, 91]);
  });
});
