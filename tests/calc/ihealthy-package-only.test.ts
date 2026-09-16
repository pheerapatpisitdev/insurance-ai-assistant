import { describe, expect, it } from "vitest";
import { arrangementFor } from "@/lib/assistant/ihealthy/quote";
import { iHealthyTable } from "@/lib/ihealthy-table";
import { IHEALTHY_OPENING } from "@/lib/ihealthy-choice";
import { plansFor } from "@/lib/ihealthy-quote";

/**
 * Health cover is quoted on the ready-made package and on nothing else.
 *
 * The owner's rule, and a rule rather than a preference: somebody asking what health cover
 * costs is asking for the health price, and every baht of life cover underneath it is a baht
 * they did not ask about. The package exists for this — its sum is pinned, and it cannot be
 * bought without the health cover riding on it.
 *
 * It is true today because the page's opening happens to name the package. That is exactly
 * the kind of accident that comes undone quietly, which is what this file is for: whoever
 * changes the opening next will be told what else they changed.
 */

const table = iHealthyTable();
/** the base whose sum the company pins — there is one, and it is the package */
const PACKAGE = table.bases.find((b) => b.fixedSum !== undefined)!;

describe("every health quotation the bot produces", () => {
  it("rides on the package, whoever is asking and for whichever plan", () => {
    for (const age of [6, 20, 35, 55, 70, 80]) {
      for (const sex of ["M", "F"] as const) {
        for (const plan of plansFor(table, age)) {
          const v = arrangementFor({ age, sex, plan: plan.code });
          expect(v.base, `${age} ${sex} ${plan.code}`).toBe(PACKAGE.variant);
          expect(v.sumAssured, `${age} ${sex} ${plan.code}`).toBe(PACKAGE.fixedSum);
        }
      }
    }
  });

  it("cannot be talked into another base by what the customer said", () => {
    // the shape of the call is the guarantee: there is nowhere to pass a base through it
    const v = arrangementFor({ age: 35, sex: "F", plan: "GOLD", territory: "ทั่วโลก" });
    expect(v.base).toBe(PACKAGE.variant);
    expect(v.territory).toBe("ทั่วโลก");
  });

  it("is the arrangement the sales page opens on, so the two never quote differently", () => {
    expect(IHEALTHY_OPENING.base).toBe(PACKAGE.variant);
    expect(IHEALTHY_OPENING.sumAssured).toBe(PACKAGE.fixedSum);
  });

  it("leaves the other base on the page, where an agent can still reach it", () => {
    // the rule is about what a question is answered with, not about what the agency sells
    expect(table.bases.length).toBeGreaterThan(1);
    expect(table.bases.some((b) => b.fixedSum === undefined)).toBe(true);
  });
});
