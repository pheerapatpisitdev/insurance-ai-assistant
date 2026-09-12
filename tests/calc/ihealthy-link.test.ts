import { describe, expect, it } from "vitest";
import { iHealthyTable } from "@/lib/ihealthy-table";
import { coveragesFor, iHealthyPricing, plansFor, territoriesFor } from "@/lib/ihealthy-quote";
import { IHEALTHY_OPENING, baseFor, sumsFor, type IHealthyInitial } from "@/lib/ihealthy-choice";
import { initialFrom, queryFrom, type IHealthyQuery } from "@/lib/ihealthy-link";

const table = iHealthyTable(new Date("2026-09-12"));

/**
 * A query string the way Next hands one over, repeated keys and all. `Object.fromEntries`
 * rather than assignment, so that `?__proto__=x` arrives as an own property — assigning it
 * would silently set the prototype instead and the hostile cases below would test nothing.
 */
function queryOf(search: string): IHealthyQuery {
  const params = new URLSearchParams(search);
  return Object.fromEntries(
    [...new Set(params.keys())].map((key) => {
      const all = params.getAll(key);
      return [key, all.length === 1 ? all[0] : all];
    }),
  );
}

/** What the page would charge for the arrangement a link settled on, or nothing. */
function priceOf(v: IHealthyInitial) {
  const { base, sex, age, sumAssured, plan, territory, coverage } = v;
  return iHealthyPricing(table, { base, sex, age, sumAssured, plan, territory, coverage });
}

/** Every arrangement the pickers can reach at one age, with the rest of the form held still. */
function sellableAt(age: number): IHealthyInitial[] {
  const out: IHealthyInitial[] = [];
  for (const plan of plansFor(table, age)) {
    for (const territory of territoriesFor(table, plan.code, age)) {
      for (const coverage of coveragesFor(table, territory, age)) {
        const v = { ...IHEALTHY_OPENING, age, plan: plan.code, territory, coverage };
        if (priceOf(v) !== undefined) out.push(v);
      }
    }
  }
  return out;
}

describe("a link the page wrote", () => {
  it("opens on the page's own arrangement when it carries nothing", () => {
    expect(initialFrom(table, {})).toEqual(IHEALTHY_OPENING);
  });

  it("says the same thing as saying nothing, for the arrangement the page opens on", () => {
    expect(queryFrom(table, IHEALTHY_OPENING)).toBe(
      "age=35&sex=F&base=WLF99H&sa=150000&plan=GOLD&area=&cover=&mode=annual",
    );
    expect(initialFrom(table, queryOf(queryFrom(table, IHEALTHY_OPENING)))).toEqual(IHEALTHY_OPENING);
  });

  /**
   * The whole point of the letters. A link is pasted into LINE and Messenger, and their
   * linkifiers end a URL at the first character they do not recognise; nothing here is
   * outside the ASCII a bare query string is allowed to carry unescaped.
   */
  it("writes nothing a chat app could stop at", () => {
    for (const age of [6, 35, 80]) {
      for (const v of sellableAt(age)) {
        expect(queryFrom(table, v)).toMatch(/^[A-Za-z0-9_.~=&-]*$/);
      }
    }
  });

  it("names territory and coverage by the rate key's own letter", () => {
    const worldwide = { ...IHEALTHY_OPENING, plan: "PLATINUM", territory: "ทั่วโลก" };
    expect(queryFrom(table, worldwide)).toContain("area=W");
    const deductible = { ...IHEALTHY_OPENING, coverage: "Deductible" };
    expect(queryFrom(table, deductible)).toContain("cover=D");
  });

  it("comes back as the arrangement it was written from, at every age", () => {
    for (let age = table.ageMin; age <= table.ageMax; age += 1) {
      for (const v of sellableAt(age)) {
        expect(initialFrom(table, queryOf(queryFrom(table, v)))).toEqual(v);
      }
    }
  });

  it("carries the rest of the form too", () => {
    for (const base of table.bases) {
      for (const sumAssured of sumsFor(base)) {
        for (const sex of ["M", "F"] as const) {
          for (const mode of ["annual", "semi", "monthly"] as const) {
            const v = { ...IHEALTHY_OPENING, base: base.variant, sumAssured, sex, mode };
            expect(initialFrom(table, queryOf(queryFrom(table, v)))).toEqual(v);
          }
        }
      }
    }
  });
});

describe("a link written by hand", () => {
  it("refuses an arrangement the company does not sell", () => {
    // there is no MHP6J: nobody sells a child แพลตินัม, and สมาร์ท is what is left
    const child = initialFrom(table, { age: "8", plan: "PLATINUM", area: "W" });
    expect(child.plan).toBe("SMART");
    expect(child.territory).toBe("ประเทศไทย");
    // โกลด์ is written for Thailand only, however loudly the link asks for เอเชีย
    expect(initialFrom(table, { plan: "GOLD", area: "A" }).territory).toBe("ประเทศไทย");
  });

  it("pulls an age onto the range the rider is issued at", () => {
    expect(initialFrom(table, { age: "3" }).age).toBe(table.ageMin);
    expect(initialFrom(table, { age: "99" }).age).toBe(table.ageMax);
    expect(initialFrom(table, { age: "35.6" }).age).toBe(36);
    expect(initialFrom(table, { age: "ห้าสิบ" }).age).toBe(IHEALTHY_OPENING.age);
  });

  it("pins the sum a package does not let anyone choose", () => {
    expect(initialFrom(table, { base: "WLF99HX", sa: "900000" }).sumAssured).toBe(50_000);
    expect(initialFrom(table, { base: "WLF99H", sa: "50000" }).sumAssured).toBe(150_000);
    expect(initialFrom(table, { base: "WLF99H", sa: "3000000" }).sumAssured).toBe(3_000_000);
  });

  it("reads the first of a repeated key", () => {
    expect(initialFrom(table, { age: ["8", "70"] }).age).toBe(8);
    expect(initialFrom(table, queryOf("age=8&age=70")).age).toBe(8);
  });

  /**
   * None of this is an arrangement anyone can reach through the form; all of it is what a
   * query string looks like once it has been through a chat app, a spreadsheet, or someone
   * with an idea. The page has to price something for every one of them.
   */
  const HOSTILE = [
    "",
    "?",
    "age=-1&plan=%3Cscript%3Ealert(1)%3C/script%3E&sa=1e308",
    "age=NaN&sex=X&base=../../../etc/passwd&sa=-5&plan=&area=&cover=&mode=",
    "age=99999999999999999999&mode=constructor&base=toString&plan=__proto__&area=__proto__",
    "age=&sex=&base=&sa=&plan=&area=&cover=&mode=",
    "age[]=8&sa[]=1&mode[]=annual",
    "age=0x1f&sa=0b11&mode=MONTHLY&sex=f",
    "age=8&age=70&plan=SILVER&plan=SMART",
    "__proto__=polluted&constructor=polluted&toString=polluted",
    "area=%E0%B8%97%E0%B8%B1%E0%B9%88%E0%B8%A7%E0%B9%82%E0%B8%A5%E0%B8%81&cover=Deductible",
    "age=Infinity&sa=Infinity",
    "sa=150000.0000001&age=6&plan=PLATINUM&area=W&cover=C",
    "mode=annual%00&sex=M%00",
    "plan=GOLD&plan=GOLD&area=A&cover=D&age=80&base=WLF99HX&sa=50000&mode=monthly",
  ];

  it.each(HOSTILE)("prices something the company sells: ?%s", (search) => {
    const v = initialFrom(table, queryOf(search));
    expect(Number.isInteger(v.age)).toBe(true);
    expect(v.age).toBeGreaterThanOrEqual(table.ageMin);
    expect(v.age).toBeLessThanOrEqual(table.ageMax);
    expect(["M", "F"]).toContain(v.sex);
    expect(table.bases.map((b) => b.variant)).toContain(v.base);
    expect(sumsFor(baseFor(table, v.base))).toContain(v.sumAssured);
    expect(Object.hasOwn(table.modeFactors, v.mode)).toBe(true);
    expect(priceOf(v)?.total[0].total).toBeGreaterThan(0);
  });

  /**
   * What the address bar does with a hand-written link, said as a property: one pass through
   * the resolvers is the whole correction. The effect in the calculator writes the parsed
   * arrangement back out, so a second parse that disagreed would rewrite the link again, and
   * again, on every render.
   */
  it.each(HOSTILE)("settles in a single rewrite: ?%s", (search) => {
    const once = initialFrom(table, queryOf(search));
    expect(initialFrom(table, queryOf(queryFrom(table, once)))).toEqual(once);
  });

  it("leaves Object.prototype alone", () => {
    initialFrom(table, queryOf("__proto__=polluted&constructor=polluted"));
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});
