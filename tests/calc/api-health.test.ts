import { describe, expect, it } from "vitest";
import { healthCatalogue, quoteHealth } from "@/lib/api/service";
import { iHealthyTable } from "@/lib/ihealthy-table";
import { iHealthyPricing, plansFor } from "@/lib/ihealthy-quote";
import { arrangementFor } from "@/lib/assistant/ihealthy/quote";

/**
 * Health cover, offered through the API the way the agency actually sells it.
 *
 * The other plans are one contract and a sum assured; health is not. iHealthy Ultra is a
 * rider, so quoting it is always quoting a life contract as well, plus the daily-cash rider
 * the agency attaches as standard. The owner's rule is that a chat — and now an API — quotes
 * only the packaged arrangement: the cheapest vehicle at its pinned sum, full cover, and the
 * standard rider. What a caller chooses is the plan, and nothing else.
 *
 * So the test that matters is not that a number comes back. It is that the number is the same
 * one the sales page and the Messenger bot would print for that customer, because three
 * quotations of one arrangement that disagree is the failure this whole system is built
 * against.
 */

describe("the health plans a caller can choose from", () => {
  it("lists only the plans this age can actually buy", () => {
    const table = iHealthyTable();
    const forAChild = healthCatalogue(5);
    const forAnAdult = healthCatalogue(35);

    expect(forAnAdult.plans.map((p) => p.code)).toEqual(plansFor(table, 35).map((p) => p.code));
    // the rate table has no ซิลเวอร์ for a child, and the catalogue must not offer one
    expect(forAChild.plans.length).toBeLessThan(forAnAdult.plans.length);
    expect(forAChild.plans.map((p) => p.code)).toEqual(plansFor(table, 5).map((p) => p.code));
  });

  it("says what each plan pays and what the customer wears first", () => {
    const gold = healthCatalogue(35).plans.find((p) => p.code === "GOLD");
    expect(gold).toBeDefined();
    expect(gold!.annualMax).toBeGreaterThan(0);
    expect(gold!.deductible).toBeGreaterThanOrEqual(0);
  });

  it("carries the ages, the table it came from, and the sentence beside it", () => {
    const table = iHealthyTable();
    const c = healthCatalogue();
    expect(c.ageMin).toBe(table.ageMin);
    expect(c.ageMax).toBe(table.ageMax);
    expect(c.version).toBe(table.rateVersion);
    expect(c.expiresOn).toBe(table.expiresOn);
    expect(c.territories.length).toBeGreaterThan(0);
  });
});

describe("a health premium", () => {
  it("is the figure the sales page prints for the same customer", () => {
    const table = iHealthyTable();
    const v = arrangementFor({ age: 35, sex: "M", plan: "GOLD" });
    const engine = iHealthyPricing(table, {
      base: v.base, sex: "M", age: 35, sumAssured: v.sumAssured,
      plan: v.plan, territory: v.territory, coverage: v.coverage,
    })!;

    const out = quoteHealth({ age: 35, sex: "M", plan: "GOLD" });
    expect(out.kind).toBe("ok");
    if (out.kind !== "ok") return;

    const annual = engine.total.find((m) => m.mode === "annual")!;
    expect(out.quote.premium.annual).toBe(Math.round(annual.total / 100));
  });

  it("shows what the total is made of, because the customer asked for a health price", () => {
    const out = quoteHealth({ age: 35, sex: "M", plan: "GOLD" });
    if (out.kind !== "ok") throw new Error("expected a quote");

    const parts = out.quote.partsOfPremium;
    // the health rider, the life contract it has to hang on, and the standard daily cash
    expect(parts.health).toBeGreaterThan(0);
    expect(parts.lifeBase).toBeGreaterThan(0);
    expect(parts.health + parts.lifeBase + (parts.dailyCash ?? 0)).toBe(out.quote.premium.annual);
  });

  it("is the packaged arrangement and says so, so nobody reads it as a bare health price", () => {
    const out = quoteHealth({ age: 35, sex: "F", plan: "GOLD" });
    if (out.kind !== "ok") throw new Error("expected a quote");
    expect(out.quote.arrangement.sumAssured).toBe(50_000);
    expect(out.quote.arrangement.coverage).toBe("Full Coverage");
    expect(out.quote.arrangement.baseLabel).toBeTruthy();
  });

  it("carries both pictures and the page, the same ones a customer is sent", () => {
    const out = quoteHealth({ age: 35, sex: "F", plan: "GOLD" });
    if (out.kind !== "ok") throw new Error("expected a quote");
    expect(out.quote.images.quote).toMatch(/^https?:\/\/\S+\/api\/ihealthy-card\?/);
    /**
     * Health has no surrender value, so its second picture is the one the bot actually
     * sends: the plans side by side. It answers the question that follows every health
     * quotation — "and what do the other plans cost" — which is why it travels with the
     * card rather than waiting to be asked for.
     */
    expect(out.quote.images.valueTable).toMatch(/^https?:\/\/\S+\/api\/ihealthy-card\/table\?/);
    expect(out.quote.page).toMatch(/^https?:\/\/\S+\/ihealthy-ultra\?/);
  });

  it("prices every instalment, and marks the one the company will not take", () => {
    const out = quoteHealth({ age: 35, sex: "F", plan: "GOLD" });
    if (out.kind !== "ok") throw new Error("expected a quote");
    expect(out.quote.premium.byMode.map((m) => m.mode)).toEqual(["annual", "semi", "monthly"]);
    for (const m of out.quote.premium.byMode) expect(m.amount).toBeGreaterThan(0);
  });
});

describe("a health request the company will not write", () => {
  it("refuses an age outside the rider's range, with the range in words", () => {
    const table = iHealthyTable();
    const out = quoteHealth({ age: table.ageMax + 1, sex: "M", plan: "GOLD" });
    expect(out.kind).toBe("not_issuable");
    if (out.kind !== "not_issuable") return;
    expect(out.reasons.join(" ")).toContain(String(table.ageMax));
  });

  it("names the plans on sale rather than failing silently on an unknown one", () => {
    const out = quoteHealth({ age: 35, sex: "M", plan: "PLATINUM_DELUXE" });
    expect(out.kind).toBe("unreadable");
    if (out.kind !== "unreadable") return;
    // the message has to carry the answer, because a model that gets only "no" will invent one
    expect(out.message).toContain("GOLD");
  });

  it("refuses an age or sex it cannot read before reaching the rate table", () => {
    for (const bad of [
      { age: 3.5, sex: "M", plan: "GOLD" },
      { age: -1, sex: "M", plan: "GOLD" },
      { age: 35, sex: "X", plan: "GOLD" },
    ]) {
      expect(quoteHealth(bad).kind, JSON.stringify(bad)).toBe("unreadable");
    }
  });

  it("refuses a territory this plan is not sold in, rather than quietly using another", () => {
    const out = quoteHealth({ age: 35, sex: "M", plan: "GOLD", territory: "ดาวอังคาร" });
    expect(out.kind).toBe("unreadable");
  });
});
