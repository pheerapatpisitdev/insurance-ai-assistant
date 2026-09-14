import { describe, expect, it } from "vitest";
import { healthMenu, otherPlansReply } from "@/lib/assistant/ihealthy/menu";
import { formatBaht } from "@/calc/money";
import { iHealthyTable } from "@/lib/ihealthy-table";
import { iHealthyPricing } from "@/lib/ihealthy-quote";
import { initialFrom } from "@/lib/ihealthy-link";

/** The engine's own answer, so the menu is asserted against it rather than against a figure. */
const priceOf = (plan: string, age = 35, sex: "M" | "F" = "F") => {
  const table = iHealthyTable();
  const priced = iHealthyPricing(table, {
    base: "WLF99H", sex, age, sumAssured: 150_000,
    plan, territory: "ประเทศไทย", coverage: "Full Coverage",
  })!;
  return formatBaht(priced.total.find((m) => m.mode === "annual")!.total);
};

describe("the menu an age and a sex earn", () => {
  it("offers the three plans the adverts sell, priced by the engine", () => {
    const reply = healthMenu(35, "F");
    const text = reply.messages[0].text;
    expect(reply.replies).toEqual(["Bronze", "Silver", "Gold"]);
    for (const [name, code] of [["Bronze", "BRONZE"], ["Silver", "SILVER"], ["Gold", "GOLD"]]) {
      expect(text).toContain(`${name} ${priceOf(code)}`);
    }
    expect(text).toContain("หญิง 35 ปี");
  });

  it("says what the total is made of, because the menu is a total", () => {
    expect(healthMenu(35, "F").messages[0].text).toContain("รวมสัญญาหลัก");
  });

  it("sends the comparison table as a picture of the same three", () => {
    const card = healthMenu(35, "F").messages[0].card!;
    expect(card).toContain("/api/ihealthy-card/table?");
    expect(card).toContain("fit=phone");
    const asked = initialFrom(iHealthyTable(), Object.fromEntries(new URLSearchParams(card.split("?")[1])));
    expect(asked).toMatchObject({ age: 35, sex: "F" });
  });

  it("offers a child only the two plans a child may buy", () => {
    const reply = healthMenu(8, "M");
    expect(reply.replies).toEqual(["Smart", "Bronze"]);
    expect(reply.messages[0].text).toContain(`Smart ${priceOf("SMART", 8, "M")}`);
  });

  it("never carries a price, and never a picture, for an age off the table", () => {
    for (const age of [5, 81]) {
      const reply = healthMenu(age, "F");
      expect(reply.messages[0].card).toBeUndefined();
      expect(reply.messages[0].text).toContain("6-80");
    }
  });

  it("shows no price at all once the rate table has lapsed", () => {
    const reply = healthMenu(35, "F", new Date("2099-01-01"));
    expect(reply.messages[0].card).toBeUndefined();
    expect(reply.messages[0].text).toContain("ขอราคาปัจจุบัน");
  });
});

describe("the plans the menu did not offer", () => {
  it("names them with their prices and puts them on buttons", () => {
    const reply = otherPlansReply(35, "F");
    expect(reply.replies).toEqual(["Smart", "Diamond", "Platinum"]);
    expect(reply.messages[0].text).toContain(`Smart ${priceOf("SMART")}`);
  });

  it("says so plainly when an age has no others", () => {
    const reply = otherPlansReply(8, "M");
    expect(reply.replies).toEqual(["Smart", "Bronze"]);
    expect(reply.messages[0].text).toContain("อายุ 8");
  });
});
