# Premium Calculator — iShield Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the iShield plan (WLCI05/10/15/20) with riders PB Fit / PB Beyond (payor benefit), AP, ECARE, MEB and PLS to the calculator, plus "premium → sum assured" mode, matching `ไฟล์คำนวน/iShield_A2026-1_01042026.xlsx` to the satang.

**Architecture:** Same three layers as PLB. The engine grows three rider kinds (`flatRateByClass`, `ratePerThousandByVariantAgeSex`, `payorBenefit`), per-variant base age limits, optional payer input and an optional premium-basis input. `quote.ts` dispatches on `rider.kind` so no plan-specific code lives in the engine.

**Tech Stack:** unchanged (Next.js 15, TypeScript, Vitest, Python + openpyxl, LibreOffice headless).

**Spec:** `docs/superpowers/specs/2026-09-03-premium-calculator-design.md`. **Previous plan:** `docs/superpowers/plans/2026-09-03-premium-calculator-plb.md` (read its "Facts" table for conventions).

---

## Facts established from the Excel file (do not re-derive)

File: `ไฟล์คำนวน/iShield_A2026-1_01042026.xlsx`. Sheet `กรอกข้อมูล` = input, `Cal` = calc.

| Item | Location | Value |
|---|---|---|
| Version / expiry / effective text / Thai name | `กรอกข้อมูล!E58`, `G57`, `E57`, `E59` | `A2026-1`, 2027-03-31, `1 มกราคม 2569 ถึง 31 มีนาคม 2570`, `iShield` |
| Product select | `C14` list `J9:M9` → `D14` | `iShield 05/10/15/20` → plancode `WLCI05/10/15/20`; pay term = last 2 digits |
| Max issue age per product | `J7:M7` | WLCI05 52, WLCI10 51, WLCI15 56, WLCI20 52; min age 0 (`C6` whole 0..I7) |
| Sex / mode | `C7`, `C8` list `F60:F62` | `ชาย/หญิง`; `รายปี, ราย 6 เดือน, รายเดือน`; factors `Cal!I2:J5` 1 / 0.52 / 0.09 |
| Calc basis | `C16` list `G16:H16` | `จำนวนเงินเอาประกันภัย` (SA in `C19`, whole 100000..5000000) or `เบี้ยประกันภัย` (modal premium in `C22`) |
| Base rate | `Premium&Maturity!P2:W68`, `HLOOKUP(plancode+sex, …, age+2)` | header row 2 `WLCI05M … WLCI20F`; sheet row = age + 3; rates for ages 0–56; e.g. WLCI10M age 35 = 66.98 |
| Base discount | `Cal!A23:R30` cols O–R | all 0 for WLCI → discount 0 (thresholds 350k,500k,700k,1M,3M,5M) |
| Extra loading `Cal!E13` | empty | 0 |
| Base premium | `Cal!G13,H13` | `ROUNDDOWN((rate-disc)*SA/1000,2)`, modal `ROUNDDOWN(…*factor,2)` |
| Premium → SA | `Cal!G37,G40,H40,I40,C38` | annual = modalInput / factor; `SA = ROUNDUP(annual*1000/(rate - disc),0)` where disc = max(disc at SA-before-discount, disc at SA-after) — 0 for WLCI. Then `D26` = SA if 100,000 ≤ SA ≤ 5,000,000 else 0 (`F22` messages `จำนวนเงินเอาประกันภัยขั้นต่ำ 100,000 บาท` / `จำนวนเงินเอาประกันภัยสูงสุด 5 ล้านบาท`); premium recomputed from that SA |
| PB rider select | `A27` list `PB Fit, PB Beyond`; `D27` ซื้อ/ไม่ซื้อ | plancode `J27`: insured age ≤15 → parent `PBPDD` (Fit) / `PBPDDCI` (Beyond); ≥16 → spouse `PBSDD` / `PBSDDCI`. Thai names `สัญญาเพิ่มเติมพีบี ฟิต` / `สัญญาเพิ่มเติมพีบี บียอนด์` |
| Payer | `C11` whole 20..70, `C12` ชาย/หญิง | messages `B27`: `กรอกอายุผู้ชำระเบี้ย`, `อายุผู้ชำระเบี้ยไม่อยู่ในเกณฑ์`, `กรอกเพศผู้ชำระเบี้ย`; insured age > 70 → `ไม่สามารถซื้อได้` |
| PB waive period | `Cal!F10` | insured ≤15: `MIN(payTerm, 25 - insuredAge)`; ≥16: `payTerm` |
| PB rate table | `Rate PB` | key col C = plancode+sex+payerAge (e.g. `PBPDDM35`); parent block rows 5–227 header row 4 (cols F.. = periods 3..25), spouse block rows 231–437 header row 230 (periods 3..83). Payer ages 16–19 in parent block are empty; valid payer age 20–70. Rate per 100 baht of base premium |
| PB premium | `Cal!C14,D14,G14,H14` | `C14 = I13 = ROUNDDOWN(rate_base * ROUNDDOWN(MIN(SA,30M)/1000,3),2)` (= base annual for integer SA); `D14 = ROUND(rate_pb,2)`; `G14 = TRUNC(D14 * TRUNC(C14/100,3),2)`; `H14 = TRUNC(G14 * factor,2)` (modal from **rounded** annual) |
| AP / ECARE rate | `Rate Rider!AB3:AD6` | flat by class: AP `[3,4.05,5.1,6]`, ECARE `[6.5,7.5,8.5,10.5]`; premium `ROUNDDOWN(rate*SA/1000,2)`, modal from unrounded |
| AP rule | `B28,C28,F28` | age 0–60; min 100,000; max: age <16 → `MIN(1M, 2*SA)` (message `AP เกินกว่าที่กำหนด`), else `MIN(5*SA, 10M)`; combined `AP+ECARE > MIN(5*SA,10M)` → `AP+ECARE เกินกว่าที่กำหนด` |
| ECARE rule | `B29,C29` | age 16–60; min 100,000; max `MIN(10M, 5*SA)` |
| MEB | `Rate Rider!A4:G73` | identical table to PLB (ages 6–74, plans 500..5000); rules identical to PLB |
| PLS | `A31` list `PLS05,PLS10,PLS12,PLS15`; `D31` SA | rate `Rate Rider!X2:Z257` key `PLS10-35`, col Y = M, Z = F, ages 20–59; discount `Cal!F21`: SA ≥1M → 1, ≥500k → 0.5; premium `ROUNDDOWN((rate-disc)*SA/1000,2)`; age 20–59; min 300,000; max `5*SA`; over max → `PLS10 เกินกว่าที่กำหนด` |
| Total | `F32` | `IF(D26=0, 0, SUM(F26:F31))`; monthly < 1000 → `เบี้ยรายเดือนน้อยกว่า 1,000` |
| Golden input cells | `กรอกข้อมูล` | `C6` age, `C7` sex, `C8` mode, `C11` payer age, `C12` payer sex, `C14` product name, `C16` basis, `C19` SA, `C22` premium, `A27` PB type, `D27` ซื้อ/ไม่ซื้อ, `D28` AP, `D29` ECARE, `D30` MEB plan or `ไม่ซื้อ`, `A31` PLS variant, `D31` PLS SA |
| Golden output cells | | `D26` SA used, `F26` base modal, `F27` PB, `F28` AP, `F29` ECARE, `F30` MEB, `F31` PLS, `F32` total; `Cal!G13,G14,G16,G17,G19,G21` annual |

No hidden rider rows: all five riders are offered.

---

## File structure

```
scripts/extract_rates.py         # refactor into per-plan functions; add extract_ishield()
data/rates/ishield.json          # generated
data/rules/ishield.json          # hand-written
src/calc/types.ts                # + rider kinds, payer, basis, options
src/calc/lookup.ts               # + flat/variant/payor lookups
src/calc/riders/rate-per-thousand.ts   # accepts flatRateByClass too (via lookup)
src/calc/riders/variant-rate.ts        # PLS
src/calc/riders/payor-benefit.ts       # PB
src/calc/sa-from-premium.ts            # premium → SA
src/calc/rules.ts                # + per-variant age, juvenile max, options, payer
src/calc/quote.ts                # dispatch by kind, basis handling
src/calc/plans/registry.ts       # + ISHIELD
src/components/QuoteForm.tsx, RiderRow.tsx, src/app/page.tsx   # payer fields, basis toggle, option selects
src/lib/summary.ts               # option names, derived SA
tests/calc/*.test.ts, tests/golden/cases-ishield.json, tests/golden/ishield.json, tests/golden/ishield.test.ts
scripts/make_golden.py           # per-plan; add ishield writer/reader
```

---

### Task 1: Extract iShield rates

**Files:** Modify `scripts/extract_rates.py`; Create `data/rates/ishield.json`; Test `tests/calc/rates-ishield.test.ts`

- [ ] **Step 1: Failing test** `tests/calc/rates-ishield.test.ts`

```ts
import { describe, it, expect } from "vitest";
import d from "../../data/rates/ishield.json";

describe("data/rates/ishield.json", () => {
  it("metadata", () => {
    expect(d.planCode).toBe("ISHIELD");
    expect(d.planName).toBe("iShield");
    expect(d.version).toBe("A2026-1");
    expect(d.expiresOn).toBe("2027-03-31");
    expect(d.base.variants).toEqual(["WLCI05", "WLCI10", "WLCI15", "WLCI20"]);
    expect(d.base.payTerm).toEqual({ WLCI05: 5, WLCI10: 10, WLCI15: 15, WLCI20: 20 });
  });
  it("base rates ages 0-56", () => {
    expect(Object.keys(d.base.rates.WLCI10.M)).toHaveLength(57);
    expect(d.base.rates.WLCI10.M["35"]).toBe(66.98);
    expect(d.base.rates.WLCI05.M["0"]).toBe(75.46);
    expect(d.base.rates.WLCI20.F["0"]).toBe(18.97);
  });
  it("discount all zero", () => {
    expect(d.discount.byVariant.WLCI10.every((x: number) => x === 0)).toBe(true);
  });
  it("riders", () => {
    expect(d.riders.AP).toEqual({ kind: "flatRateByClass", rates: [3, 4.05, 5.1, 6] });
    expect(d.riders.ECARE).toEqual({ kind: "flatRateByClass", rates: [6.5, 7.5, 8.5, 10.5] });
    expect(d.riders.MEB.premiums["6"]).toEqual([475, 950, 0, 0, 0, 0]);
    expect(d.riders.PLS.kind).toBe("ratePerThousandByVariantAgeSex");
    expect(d.riders.PLS.variants).toEqual(["PLS05", "PLS10", "PLS12", "PLS15"]);
    expect(d.riders.PLS.rates.PLS10.M["35"]).toBe(5.13);
    expect(d.riders.PLS.rates.PLS10.F["35"]).toBe(2.53);
    expect(d.riders.PLS.discountThresholds).toEqual([500000, 1000000]);
    expect(d.riders.PLS.discountValues).toEqual([0.5, 1]);
    expect(d.riders.PB.kind).toBe("payorBenefit");
    expect(d.riders.PB.rates.PBPDD.M["20"]["3"]).toBe(0.21);
    expect(d.riders.PB.rates.PBPDD.M["35"]["10"]).toBe(1.63);
    expect(d.riders.PB.rates.PBSDD.M["40"]["20"]).toBe(6.45);
    expect(d.riders.PB.rates.PBPDD.M["19"]).toBeUndefined();
    expect(Object.keys(d.riders.PB.rates.PBSDDCI.F)).toHaveLength(51);
    expect(d.riders.PB.options).toEqual({
      FIT: { name: "สัญญาเพิ่มเติมพีบี ฟิต", parent: "PBPDD", spouse: "PBSDD" },
      BEYOND: { name: "สัญญาเพิ่มเติมพีบี บียอนด์", parent: "PBPDDCI", spouse: "PBSDDCI" },
    });
  });
});
```

- [ ] **Step 2:** `npx vitest run tests/calc/rates-ishield.test.ts` → FAIL (missing JSON).

- [ ] **Step 3: Refactor `scripts/extract_rates.py`** — keep `extract_plb()` as the current body, add `extract_ishield()`:

```python
def extract_ishield():
    src = ROOT / "ไฟล์คำนวน" / "iShield_A2026-1_01042026.xlsx"
    wb = openpyxl.load_workbook(src, data_only=True)
    inp, cal, pm, rr, pb = wb["กรอกข้อมูล"], wb["Cal"], wb["Premium&Maturity"], wb["Rate Rider"], wb["Rate PB"]
    variants = ["WLCI05", "WLCI10", "WLCI15", "WLCI20"]
    meta = {
        "planCode": "ISHIELD", "planName": inp["E59"].value, "version": inp["E58"].value,
        "effectiveText": inp["E57"].value, "expiresOn": inp["G57"].value.strftime("%Y-%m-%d"), "sourceFile": src.name,
    }
    mode_factors = {MODE_MAP[cell(cal, r, 9)]: cell(cal, r, 10) for r in range(2, 6) if cell(cal, r, 9) in MODE_MAP}
    # base: header row 2 cols P..W, sheet row = age + 3
    header = {cell(pm, 2, c): c for c in range(16, 24)}
    rates = {}
    for v in variants:
        rates[v] = {}
        for sex in "MF":
            col = header[f"{v}{sex}"]
            table = {}
            for r in range(3, 69):
                val = cell(pm, r, col)
                if val is not None:
                    assert cell(pm, r, 15) == r - 3
                    table[str(r - 3)] = val
            assert len(table) == 57, (v, sex, len(table))
            rates[v][sex] = table
    # discount Cal A23:R29
    disc_header = {cell(cal, 23, c): c for c in range(2, 19)}
    thresholds = [cell(cal, r, 1) for r in range(24, 30)]
    by_variant = {v: [cell(cal, r, disc_header[v]) or 0 for r in range(24, 30)] for v in variants}
    # AP / ECARE flat by class: Rate Rider AB3:AD6
    ap = [cell(rr, r, 29) for r in range(3, 7)]
    ecare = [cell(rr, r, 30) for r in range(3, 7)]
    # MEB Rate Rider A4:G73
    meb_plans = [cell(rr, 4, c) for c in range(2, 8)]
    meb = {str(int(cell(rr, r, 1))): [cell(rr, r, c) for c in range(2, 8)] for r in range(5, 74)}
    # PLS Rate Rider X3:Z257 key "PLS10-35"
    pls = {v: {"M": {}, "F": {}} for v in ["PLS05", "PLS10", "PLS12", "PLS15"]}
    for r in range(3, 258):
        key = cell(rr, r, 24)
        if not key or "-" not in key:
            continue
        code, age = key.split("-")
        if code in pls:
            pls[code]["M"][age] = cell(rr, r, 25)
            pls[code]["F"][age] = cell(rr, r, 26)
    for v in pls:
        assert len(pls[v]["M"]) == 40, v
    # PB: Rate PB, keep periods 3..25
    def pb_block(first, last, header_row):
        periods = {c: cell(pb, header_row, c) for c in range(6, 87) if isinstance(cell(pb, header_row, c), (int, float))}
        out = {}
        for r in range(first, last + 1):
            code, sex, age = cell(pb, r, 1), cell(pb, r, 2), cell(pb, r, 4)
            if not isinstance(age, (int, float)) or sex not in ("M", "F"):
                continue
            row = {str(int(p)): cell(pb, r, c) for c, p in periods.items() if p <= 25 and cell(pb, r, c) is not None}
            if row:
                out.setdefault(code, {}).setdefault(sex, {})[str(int(age))] = row
        return out
    pb_rates = pb_block(5, 227, 4)
    pb_rates.update(pb_block(231, 437, 230))
    assert set(pb_rates) == {"PBPDD", "PBPDDCI", "PBSDD", "PBSDDCI"}, set(pb_rates)
    out = {
        **meta, "modeFactors": mode_factors,
        "base": {"variants": variants, "payTerm": {v: int(v[-2:]) for v in variants}, "rates": rates},
        "discount": {"thresholds": thresholds, "byVariant": by_variant},
        "riders": {
            "PB": {"kind": "payorBenefit", "rates": pb_rates, "options": {
                "FIT": {"name": inp["I68"].value, "parent": inp["K68"].value, "spouse": inp["K70"].value},
                "BEYOND": {"name": inp["I69"].value, "parent": inp["K69"].value, "spouse": inp["K71"].value},
            }},
            "AP": {"kind": "flatRateByClass", "rates": ap},
            "ECARE": {"kind": "flatRateByClass", "rates": ecare},
            "MEB": {"kind": "fixedByAgePlan", "plans": meb_plans, "premiums": meb},
            "PLS": {"kind": "ratePerThousandByVariantAgeSex", "variants": list(pls), "rates": pls,
                    "discountThresholds": [500000, 1000000], "discountValues": [0.5, 1]},
        },
    }
    write_json(ROOT / "data" / "rates" / "ishield.json", out)
```
`main()` runs both extractors; `write_json` is the shared writer.

- [ ] **Step 4:** `npm run extract` → both files written. **Step 5:** test PASS. **Step 6:** determinism diff. **Step 7:** commit `feat: extract iShield rate tables`.

---

### Task 2: Types, lookups, new rider modules, premium→SA

**Files:** Modify `src/calc/types.ts`, `src/calc/lookup.ts`; Create `src/calc/riders/variant-rate.ts`, `src/calc/riders/payor-benefit.ts`, `src/calc/sa-from-premium.ts`; Tests `tests/calc/riders-ishield.test.ts`, `tests/calc/sa-from-premium.test.ts`

Type additions (`types.ts`):
```ts
export interface FlatRateByClass { kind: "flatRateByClass"; rates: number[] }               // [class1..4]
export interface RatePerThousandByVariantAgeSex {
  kind: "ratePerThousandByVariantAgeSex"; variants: string[];
  rates: Record<string, Record<Sex, Record<string, number>>>;
  discountThresholds: number[]; discountValues: number[];
}
export interface PayorBenefit {
  kind: "payorBenefit";
  /** plancode → sex → payerAge → waivePeriod → rate per 100 baht of base premium */
  rates: Record<string, Record<Sex, Record<string, Record<string, number>>>>;
  options: Record<string, { name: string; parent: string; spouse: string }>;
}
export type RiderRates = RatePerThousandByAgeClass | FixedByAgePlan | FlatRateByClass | RatePerThousandByVariantAgeSex | PayorBenefit;
// PlanRates.base gains: payTerm?: Record<string, number>
// RiderRule gains: juvenile?: { ageMax: number; saMaxMultipleOfBase: number; saMaxCap: number }; payer?: { ageMin: number; ageMax: number }
// PlanRules.base gains: saMax?: number; ageMaxByVariant?: Record<string, number>; premiumBasis?: boolean
// RiderInput gains: option?: string   (PB: "FIT"|"BEYOND"; PLS: "PLS10" …)
// QuoteInput gains: payer?: { age: number; sex: Sex }; basis?: "sumAssured" | "premium"; targetPremium?: number (modal, baht)
// QuoteResult gains: derivedSumAssured?: number
// Availability gains: options?: { code: string; name: string }[]; needsPayer?: boolean
```

Tests (abridged — full expectations in the file): PLS `PLS10 M 35 SA 1,000,000 annual` → rate 5.13, disc 1 → 4130.00; PB parent `insured 11, iShield 10, payer M 35, FIT` with base annual 22105.00 → key PBPDDM35 period min(10, 14)=10 → rate 1.63 → TRUNC(1.63*TRUNC(221.05,3),2) = TRUNC(360.3115,2)=360.31; monthly → TRUNC(360.31*0.09,2)=32.42; SA-from-premium: `WLCI10 M 35 annual 100000` → ceil(100000*1000/66.98)=1,493,0? (compute in test from rate); semi 52,000 → annual 100000 → same.

Modules:
- `lookup.ts`: `riderRateByAgeClass` also handles `flatRateByClass` (ignores age); add `variantRate(rates, code, variant, sex, age)`, `payorRate(rates, code, plancode, sex, payerAge, period)`.
- `riders/variant-rate.ts`: `variantRiderPremium(rates, code, {variant, sex, age, sumAssured, mode})` → discount from thresholds (highest ≤ SA), `premiumPerThousand(rate100 - disc100, SA)`, modal via `applyModeFactor`.
- `riders/payor-benefit.ts`: `payorBenefitPremium(rates, code, {option, insuredAge, payer, payTerm, baseAnnual (satang), mode})` → plancode = insuredAge ≤ 15 ? parent : spouse; period = insuredAge ≤ 15 ? min(payTerm, 25 - insuredAge) : payTerm; rate100 = toHundredths(rate); `t = Math.floor(baseAnnual / 10)` (= TRUNC(annual/100,3) × 1000); `annual = floorDiv(rate100 * t, 1000)`; `modal = applyModeFactorToFixed(annual, factor100)`.
- `sa-from-premium.ts`: `sumAssuredFromPremium(rates, {variant, sex, age, mode, targetPremium})` → annual = targetPremium / factor (float); rate; disc1 = discount(ceil(annual*1000/rate)); sa2 = ceil(annual*1000/(rate-disc1)); disc = max(disc1, discount(sa2)); return `Math.ceil(annual * 1000 / (rate - disc))`; undefined if no rate.

Commit `feat(calc): PLS, payor-benefit riders and premium→SA`.

---

### Task 3: Rules + quote dispatch + registry

**Files:** Create `data/rules/ishield.json`; Modify `src/calc/rules.ts`, `src/calc/quote.ts`, `src/calc/plans/registry.ts`; Tests `tests/calc/rules-ishield.test.ts`, `tests/calc/quote-ishield.test.ts`

`data/rules/ishield.json`:
```json
{
  "planCode": "ISHIELD",
  "base": { "ageMin": 0, "ageMax": 56, "saMin": 100000, "saMax": 5000000, "premiumBasis": true,
            "ageMaxByVariant": { "WLCI05": 52, "WLCI10": 51, "WLCI15": 56, "WLCI20": 52 } },
  "minMonthlyTotal": 1000,
  "riders": {
    "PB":    { "name": "สัญญาเพิ่มเติมพีบี (ผู้ชำระเบี้ย)", "ageMin": 0, "ageMax": 70, "payer": { "ageMin": 20, "ageMax": 70 } },
    "AP":    { "name": "สัญญาเพิ่มเติมอุบัติเหตุ (AP)", "ageMin": 0, "ageMax": 60, "saMin": 100000, "saMaxMultipleOfBase": 5, "saMaxCap": 10000000,
               "juvenile": { "ageMax": 15, "saMaxMultipleOfBase": 2, "saMaxCap": 1000000 } },
    "ECARE": { "name": "สัญญาเพิ่มเติมอุบัติเหตุ (ECARE)", "ageMin": 16, "ageMax": 60, "saMin": 100000, "saMaxMultipleOfBase": 5, "saMaxCap": 10000000 },
    "MEB":   { "name": "สัญญาเพิ่มเติมค่ารักษาพยาบาล (MEB)", "ageMin": 6, "ageMax": 65,
               "planMaxByAge": [ { "ageMax": 10, "planMax": 500 }, { "ageMax": 15, "planMax": 1000 }, { "ageMax": 65, "planMax": 5000 } ] },
    "PLS":   { "name": "สัญญาเพิ่มเติม PLS", "ageMin": 20, "ageMax": 59, "saMin": 300000, "saMaxMultipleOfBase": 5 }
  },
  "combined": [ { "code": "AP_ECARE_5X", "riders": ["AP", "ECARE"], "maxMultipleOfBase": 5, "cap": 10000000, "message": "AP+ECARE เกินกว่าที่กำหนด" } ]
}
```

`rules.ts` changes: `baseAgeRange(rules, variant)` (uses `ageMaxByVariant`); `riderAvailability` adds `options` (PB from `rates.riders.PB.options`, PLS from `variants`), `needsPayer`, juvenile max; `checkRiderInput(rules, rates, code, ctx, input, payer?)` adds: PB → `กรอกอายุผู้ชำระเบี้ย` when payer missing, `อายุผู้ชำระเบี้ยไม่อยู่ในเกณฑ์` when out of range; option required for PB/PLS (`เลือกแบบ` message `กรุณาเลือกแบบ`); message code for PLS uses the variant (`PLS10 เกินกว่าที่กำหนด`).

`quote.ts`: resolve `sumAssured` from `basis` first (with `BASE_SA_MIN`/`BASE_SA_MAX` warnings: `จำนวนเงินเอาประกันภัยขั้นต่ำ 100,000 บาท`, `จำนวนเงินเอาประกันภัยสูงสุด 5 ล้านบาท`; set SA 0 → base ineligible like Excel); base age range by variant; rider dispatch by kind; PB needs base annual (0 → `ไม่คุ้มครอง`); total = 0 when base ineligible (Excel `F32`), keep item rows.

`registry.ts`: add `ISHIELD` with `riderOrder: ["PB","AP","ECARE","MEB","PLS"]`, `variantLabels: { WLCI05: "iShield 05 (ชำระเบี้ย 5 ปี)", … }`.

Tests: quote iShield 10 M 35 SA 500,000 annual → base 500×(66.98)=33,490.00; with PB FIT payer F 40 → key PBSDDF40 period 10; AP juvenile over 2×SA → message; premium basis semi 52,000 → derivedSumAssured; PLB tests unchanged and green.

Commit `feat(calc): iShield rules and quote dispatch`.

---

### Task 4: Golden tests (LibreOffice)

**Files:** Modify `scripts/make_golden.py` (per-plan writers/readers, `--plan` arg); Create `tests/golden/cases-ishield.json`, `tests/golden/ishield.json`, `tests/golden/ishield.test.ts`

Writer for iShield sets: `C6,C7,C8,C11,C12,C14,C16,C19,C22,A27,D27,D28,D29,D30,A31,D31`. Reader: `D26,F26..F32,D22` and `Cal!G13,G14,G16,G17,G19,G21`. Random generator respects Excel validations (age ≤ variant max; AP ≤ juvenile/adult max; ECARE only ≥16; PLS only 20–59 with SA in [300k, 5×SA]; payer age 20–70 whenever PB bought; MEB plan within age band). 15 explicit + 45 random = 60 cases. Test compares base/PB/AP/ECARE/MEB/PLS modal, base annual, total, derived SA (premium basis), MIN_MONTHLY flag. Text cells → 0.

Commit `test: golden tests for iShield (60 cases)`.

---

### Task 5: UI

**Files:** Modify `src/components/QuoteForm.tsx`, `src/components/RiderRow.tsx`, `src/app/page.tsx`, `src/lib/summary.ts`

- Plan select switches variant list and resets riders; variant select shows per-variant age max.
- Basis toggle (radio) only when `rules.base.premiumBasis`: "คำนวณจากทุนประกัน" / "คำนวณจากเบี้ยที่ต้องการ" + premium input (per selected mode); result panel shows `ทุนประกันที่ได้ …` when derived.
- RiderRow kinds: SA input; plan select; option select + SA (PLS); option select + payer age/sex (PB).
- Summary: include option names and payer line.
- Manual checks: iShield 10 M 35 SA 500,000 annual → 33,490.00; enable PB FIT payer F 40 → 545.88 (verify vs golden case); switch to premium basis 3,000/month → derived SA shown; age 11 → parent PB; age 70+ → PB greyed; PLS greyed under 20; mobile no overflow. Lint + build.

Commit `feat(ui): iShield plan with payer fields, basis toggle and option riders`.

---

### Task 6: Merge, deploy check

Merge `feat/ishield` → main, push (Vercel auto-deploys), smoke-test production URL for iShield default, record in spec "Deployed plans: PLB, iShield".
