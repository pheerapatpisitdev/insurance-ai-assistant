import { describe, expect, it } from "vitest";
import { priceWithRiders, type RiderQuoteInput } from "@/app/ihealthy-ultra/actions";
import { arrangementKey, attachedRiders } from "@/components/ihealthy/rider-request";

const ADULT: Omit<RiderQuoteInput, "riders"> = {
  base: "WLF99H", age: 35, sex: "F", sumAssured: 1_000_000, mode: "annual",
  plan: "GOLD", territory: "ประเทศไทย", coverage: "Full Coverage",
};
const PACKAGE: Omit<RiderQuoteInput, "riders"> = {
  base: "WLF99HX", age: 35, sex: "F", sumAssured: 50_000, mode: "annual",
  plan: "BRONZE", territory: "ประเทศไทย", coverage: "Full Coverage",
};

const offered = (r: { available: { code: string; eligible: boolean }[] }) =>
  r.available.filter((a) => a.eligible).map((a) => a.code);

describe("priceWithRiders", () => {
  it("offers the four riders the agency sells here, and no others", async () => {
    const r = await priceWithRiders({ ...ADULT, riders: [] });
    // The company sells thirteen with this base. Four are the agency's choice for this page;
    // the back-office calculator still offers the rest.
    expect(r.available.map((a) => a.code)).toEqual(["MEB", "DCI", "RRSS", "CI123"]);
    expect(offered(r)).toEqual(["MEB", "DCI", "RRSS", "CI123"]);
  });

  it("will not price a rider this page does not offer, however it is asked for", async () => {
    const r = await priceWithRiders({ ...ADULT, riders: [{ code: "AP", sumAssured: 1_000_000 }] });
    expect(r.items.some((i) => i.code === "AP")).toBe(false);
    expect(r.totalModal).toBe(r.items.reduce((sum, i) => sum + i.modal, 0));
  });

  it("drops the riders the health package refuses", async () => {
    const r = await priceWithRiders({ ...PACKAGE, riders: [] });
    // CI 123 is one of the four, but the package will not sell it
    expect(r.available.map((a) => a.code)).toEqual(["MEB", "DCI", "RRSS"]);
  });

  it("greys the rider a child is too young for", async () => {
    const r = await priceWithRiders({ ...ADULT, age: 8, sex: "M", riders: [] });
    const greyed = r.available.filter((a) => !a.eligible);
    expect(greyed.map((a) => a.code)).toEqual(["DCI"]);
    // greyed, not gone: the agent asked whether the rider can be added, and "20 - 65 ปี"
    // beside the reason is the answer
    for (const a of greyed) {
      expect(a.reason).toBeTruthy();
      expect(a.ageRange).toMatch(/\d+ - \d+ ปี/);
    }
    expect(offered(r)).toEqual(["MEB", "RRSS", "CI123"]);
  });

  it("keeps the package's three at age 8, with the one he is too young for greyed", async () => {
    const r = await priceWithRiders({ ...PACKAGE, age: 8, sex: "M", riders: [] });
    expect(r.available.map((a) => a.code)).toEqual(["MEB", "DCI", "RRSS"]);
    expect(offered(r)).toEqual(["MEB", "RRSS"]);
  });

  it("prices an attached rider on top of the base and the health plan", async () => {
    const bare = await priceWithRiders({ ...ADULT, riders: [] });
    const withDci = await priceWithRiders({
      ...ADULT, riders: [{ code: "DCI", sumAssured: 500_000 }],
    });
    expect(withDci.totalModal).toBeGreaterThan(bare.totalModal);
    expect(withDci.items.find((i) => i.code === "DCI")!.eligible).toBe(true);
  });

  it("adds up to exactly the rows it is showing", async () => {
    const r = await priceWithRiders({
      ...ADULT, riders: [{ code: "MEB", plan: 500 }, { code: "DCI", sumAssured: 500_000 }],
    });
    expect(r.totalModal).toBe(r.items.reduce((sum, i) => sum + i.modal, 0));
  });

  it("says which of the two reasons left a ticked rider out", async () => {
    const byPackage = await priceWithRiders({ ...PACKAGE, riders: [{ code: "CI123", sumAssured: 500_000 }] });
    expect(byPackage.items.some((i) => i.code === "CI123")).toBe(false);
    expect(byPackage.warnings.some((w) => w.includes("ไม่ขายกับ package นี้"))).toBe(true);
    expect(byPackage.totalModal).toBe(byPackage.items.reduce((sum, i) => sum + i.modal, 0));

    const byAge = await priceWithRiders({
      ...PACKAGE, age: 8, sex: "M", riders: [{ code: "DCI", sumAssured: 200_000 }],
    });
    expect(byAge.items.some((i) => i.code === "DCI")).toBe(false);
    expect(byAge.warnings).toContain("สัญญาเพิ่มเติมโรคร้ายแรง (DCI) ไม่สามารถซื้อได้ จึงไม่ได้คิดเบี้ยให้");
  });

  it("prices DCI at the sum the package pins it to, whatever it is asked for", async () => {
    const pinned = await priceWithRiders({ ...PACKAGE, riders: [{ code: "DCI", sumAssured: 200_000 }] });
    const greedy = await priceWithRiders({ ...PACKAGE, riders: [{ code: "DCI", sumAssured: 5_000_000 }] });
    const choice = pinned.available.find((a) => a.code === "DCI")!;
    expect(choice.exactSumAssured).toBe(200_000);
    // the sentence the fold prints is the company's own, from the rules
    expect(choice.exactMessage).toBe("ต้องระบุทุน DCI 2 แสนบาทเท่านั้น");
    expect(greedy.items.find((i) => i.code === "DCI")!.eligible).toBe(true);
    expect(greedy.totalModal).toBe(pinned.totalModal);
  });

  it("passes the engine's own objection through to the fold", async () => {
    // Not reachable from the pickers, which only offer sums the base is written for, but the
    // wire is open to anything: the answer is the engine's warning, not a priced arrangement.
    const r = await priceWithRiders({ ...ADULT, sumAssured: 60_000, riders: [] });
    expect(r.warnings).toContain("จำนวนเงินเอาประกันภัยขั้นต่ำ 150,000 บาท");
    expect(r.totalModal).toBe(0);
  });

  it("quotes nothing for a request this page could not have made", async () => {
    const bad = [
      { ...ADULT, age: 500, riders: [] },
      { ...ADULT, base: "WLCI05", riders: [] },
      { ...ADULT, sumAssured: -1, riders: [] },
      { ...ADULT, riders: [{ code: "AP", sumAssured: Number.MAX_VALUE }] },
      { ...ADULT, riders: "AP" } as unknown as RiderQuoteInput,
      { ...ADULT, mode: "weekly" } as unknown as RiderQuoteInput,
    ];
    for (const input of bad) {
      const r = await priceWithRiders(input as RiderQuoteInput);
      expect(r).toEqual({ available: [], items: [], totalModal: 0, warnings: ["คำขอไม่ถูกต้อง"] });
    }
  });
});

describe("arrangementKey", () => {
  it("changes when anything the engine would price on changes", () => {
    const changes: Partial<RiderQuoteInput>[] = [
      { base: "WLF99L" }, { age: 36 }, { sex: "M" }, { sumAssured: 2_000_000 },
      { mode: "monthly" }, { plan: "SILVER" }, { territory: "เอเชีย" }, { coverage: "Deductible" },
    ];
    for (const change of changes) {
      expect(arrangementKey({ ...ADULT, ...change })).not.toBe(arrangementKey(ADULT));
    }
  });

  it("is the same key for the same arrangement asked twice", () => {
    expect(arrangementKey({ ...ADULT })).toBe(arrangementKey(ADULT));
  });

  it("does not change when only the attached riders do", () => {
    // The answer stays on screen while another is priced, so a tick must not read as a
    // different arrangement; an age change must.
    const ticked: RiderQuoteInput = { ...ADULT, riders: [{ code: "AP", sumAssured: 100_000 }] };
    expect(arrangementKey(ticked)).toBe(arrangementKey(ADULT));
  });
});

describe("attachedRiders", () => {
  it("sends a rider's sum, plan and option as they were picked", () => {
    expect(attachedRiders({
      AP: { sumAssured: 750_000 },
      MEB: { plan: 500 },
      PLS: { option: "PLS10", sumAssured: 300_000 },
    })).toEqual([
      { code: "AP", sumAssured: 750_000 },
      { code: "MEB", plan: 500 },
      { code: "PLS", option: "PLS10", sumAssured: 300_000 },
    ]);
  });

  it("sends no sum at all for a field the agent has emptied", () => {
    const [ap] = attachedRiders({ AP: { sumAssured: "" } });
    expect(ap).toEqual({ code: "AP" });
    expect("sumAssured" in ap).toBe(false);
  });

  it("sends nothing when nothing is ticked", () => {
    expect(attachedRiders({})).toEqual([]);
  });
});
