import { describe, expect, it } from "vitest";
import { priceWithRiders, type RiderQuoteInput } from "@/app/ihealthy/actions";

const ADULT: Omit<RiderQuoteInput, "riders"> = {
  base: "WLF99H", age: 35, sex: "F", sumAssured: 1_000_000, mode: "annual",
  plan: "GOLD", territory: "ประเทศไทย", coverage: "Full Coverage",
};
const PACKAGE: Omit<RiderQuoteInput, "riders"> = {
  base: "WLF99HX", age: 35, sex: "F", sumAssured: 50_000, mode: "annual",
  plan: "BRONZE", territory: "ประเทศไทย", coverage: "Full Coverage",
};

describe("priceWithRiders", () => {
  it("lists what an adult may attach to the x 2 base", async () => {
    const r = await priceWithRiders({ ...ADULT, riders: [] });
    const codes = r.available.map((a) => a.code);
    expect(codes).toContain("AP");
    expect(codes).toContain("DCI");
    expect(codes).not.toContain("IHU");
  });

  it("drops the riders the health package refuses", async () => {
    const r = await priceWithRiders({ ...PACKAGE, riders: [] });
    const codes = r.available.map((a) => a.code);
    expect(codes).toEqual(["AP", "MEX", "MEB", "DCI", "RRSS"]);
  });

  it("greys the four riders a child is too young for", async () => {
    const r = await priceWithRiders({ ...PACKAGE, age: 8, sex: "M", riders: [] });
    expect(r.available.map((a) => a.code)).toEqual(["AP", "MEX", "MEB", "RRSS"]);
  });

  it("prices an attached rider on top of the base and the health plan", async () => {
    const bare = await priceWithRiders({ ...ADULT, riders: [] });
    const withAp = await priceWithRiders({
      ...ADULT, riders: [{ code: "AP", sumAssured: 1_000_000 }],
    });
    expect(withAp.totalModal).toBeGreaterThan(bare.totalModal);
    expect(withAp.items.find((i) => i.code === "AP")!.eligible).toBe(true);
  });

  it("adds up to exactly the rows it is showing", async () => {
    const r = await priceWithRiders({
      ...ADULT, riders: [{ code: "AP", sumAssured: 1_000_000 }, { code: "DCI", sumAssured: 500_000 }],
    });
    expect(r.totalModal).toBe(r.items.reduce((sum, i) => sum + i.modal, 0));
  });

  it("leaves out a rider the package refuses, and says why", async () => {
    const r = await priceWithRiders({ ...PACKAGE, riders: [{ code: "ECARE", sumAssured: 500_000 }] });
    expect(r.items.some((i) => i.code === "ECARE")).toBe(false);
    expect(r.warnings.some((w) => w.includes("ECARE"))).toBe(true);
    expect(r.totalModal).toBe(r.items.reduce((sum, i) => sum + i.modal, 0));
  });

  it("prices DCI at the sum the package pins it to, whatever it is asked for", async () => {
    const pinned = await priceWithRiders({ ...PACKAGE, riders: [{ code: "DCI", sumAssured: 200_000 }] });
    const greedy = await priceWithRiders({ ...PACKAGE, riders: [{ code: "DCI", sumAssured: 5_000_000 }] });
    expect(pinned.available.find((a) => a.code === "DCI")!.exactSumAssured).toBe(200_000);
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
