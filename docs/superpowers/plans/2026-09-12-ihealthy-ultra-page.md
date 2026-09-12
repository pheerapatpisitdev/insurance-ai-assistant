# iHealthy Ultra Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `/ihealthy`, one page that prices the ไอเฮลท์ตี้ อัลตร้า health rider on three ไลฟ์ โพรเทค+ bases and shows all 28 benefit categories across the six plans.

**Architecture:** Two layers, as decided in the spec. The customer layer (base plan + health rider + benefit table) is priced in the browser from a slim table the server prepares, the way `/lifeprotect` already works. The agent layer (other riders) is folded away and, when opened, calls one server action that runs the real `quote()`. A 200-case parity test keeps the two arithmetics equal.

**Tech Stack:** Next.js 15 App Router, React 19, Tailwind v4, vitest, openpyxl for the one-off extraction.

**Spec:** `docs/superpowers/specs/2026-09-12-ihealthy-ultra-page-design.md`

---

## File Structure

| File | Responsibility |
| --- | --- |
| `scripts/extract_ihu_benefits.py` | Reads two sheets of the company workbook, writes the benefit JSON. Run by `npm run extract ihealthy-ultra`. |
| `data/riders/ihealthy-ultra.json` | 28 benefit rows × 6 plans, the child columns, per-plan annual maximum and deductible, and the contract terms. Generated, never hand-edited. |
| `src/lib/ihealthy-table.ts` | Server-built slim table: base rates for three variants, rider rates for 28 keys, plan/territory/coverage options. |
| `src/lib/ihealthy-quote.ts` | Browser-side arithmetic and the option filters (which plans at this age, which territories for this plan). No engine imports. |
| `src/lib/ihealthy-facts.ts` | Benefit rows and terms read out of the JSON, shaped for the page. |
| `src/lib/ihealthy-cta.ts` | The chat message and the copy-to-clipboard summary. |
| `src/app/ihealthy/actions.ts` | One server action: price a full arrangement with `quote()`, return rows. |
| `src/app/ihealthy/page.tsx` | Server component: builds table + facts, reads the query string, renders the page. |
| `src/app/ihealthy/layout.tsx` | Wraps the route in `SalesTheme`. |
| `src/components/IHealthyCalculator.tsx` | Client island: the form, the premium panel, the rider fold. |
| `src/components/ihealthy/BenefitTable.tsx` | The 28-row × 6-plan table with the chosen column highlighted. |
| `src/components/ihealthy/RiderPanel.tsx` | The folded rider list; calls the server action. |
| `src/components/ihealthy/Sections.tsx` | Hero, the terms block, the disclaimer. |

---

## Task 1: Extract the benefit table from the workbook

**Files:**
- Create: `scripts/extract_ihu_benefits.py`
- Modify: `scripts/extract_rates.py` (register the extractor)
- Create: `data/riders/ihealthy-ultra.json` (generated)
- Test: `tests/calc/ihealthy-benefits.test.ts`

The sheet merges its "ผลประโยชน์สูงสุด" columns down whole blocks (`Q8:Q32`, `AF39:AF53`) and merges rows 43–44 together, so หมวด 18 and หมวด 19 share one OPD limit. Every read must resolve merges or those rows come back empty.

- [ ] **Step 1: Write the failing test**

Create `tests/calc/ihealthy-benefits.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import benefits from "../../data/riders/ihealthy-ultra.json";

const plan = (code: string) => benefits.plans.find((p) => p.code === code)!;
const row = (no: number) => benefits.rows.find((r) => "no" in r && r.no === no)!;

describe("ไอเฮลท์ตี้ อัลตร้า benefit data", () => {
  it("carries the six plans with the company's annual maximum", () => {
    expect(benefits.plans.map((p) => [p.code, p.annualMax])).toEqual([
      ["SMART", 3_000_000],
      ["BRONZE", 10_000_000],
      ["SILVER", 15_000_000],
      ["GOLD", 25_000_000],
      ["DIAMOND", 70_000_000],
      ["PLATINUM", 100_000_000],
    ]);
  });

  it("ties the deductible to the plan the way the workbook's I4 does", () => {
    expect(benefits.plans.map((p) => p.deductible)).toEqual([30_000, 30_000, 50_000, 50_000, 100_000, 100_000]);
    expect(benefits.copayPercent).toBe(20);
  });

  it("reads the room rate of หมวด 1", () => {
    expect(row(1).adult).toMatchObject({
      SMART: "1,500 ต่อวัน", BRONZE: "3,000 ต่อวัน", SILVER: "5,500 ต่อวัน",
      GOLD: "9,000 ต่อวัน", DIAMOND: "15,000 ต่อวัน", PLATINUM: "21,000 ต่อวัน",
    });
  });

  it("keeps the child column only where it differs from the adult one", () => {
    expect(row(3).child).toEqual({
      SMART: "1,000 ต่อวัน*/ ตามที่จ่ายจริง",
      BRONZE: "3,000 ต่อวัน*/ ตามที่จ่ายจริง",
    });
    expect(row(1).child).toBeUndefined();
  });

  it("resolves the merged OPD cell that หมวด 18 and 19 share", () => {
    expect(row(18).adult).toMatchObject({ SILVER: "6000", GOLD: "12000", DIAMOND: "60000", PLATINUM: "ตามที่จ่ายจริง" });
    expect(row(19).adult).toEqual(row(18).adult);
  });

  it("reads the benefits only แพลทินั่ม has", () => {
    expect(row(24).adult.PLATINUM).toBe("400000");
    expect(row(28).adult.PLATINUM).toBe("1000000");
    expect(row(24).adult.DIAMOND).toBe("-");
  });

  it("marks หมวด 8 as covered by nobody", () => {
    expect(Object.values(row(8).adult).every((v) => v === "ไม่คุ้มครอง")).toBe(true);
  });

  it("splits the contract into the sections the page shows", () => {
    expect(benefits.rows.filter((r) => "no" in r && r.endorsement).map((r) => r.no))
      .toEqual([14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28]);
  });

  it("carries the waiting periods and the renewal rules as text", () => {
    expect(benefits.terms.renewalToAge).toBe(98);
    expect(benefits.terms.waitingDays).toBe(30);
    expect(benefits.terms.specialWaitingDays).toBe(120);
    expect(benefits.terms.specialWaitingDiseases).toHaveLength(8);
    expect(benefits.terms.noClaimDiscountPercent).toBe(10);
    expect(benefits.terms.outOfTerritoryDays).toBe(90);
    expect(benefits.disclaimer).toContain("เอกสารประกอบการเสนอขาย");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/calc/ihealthy-benefits.test.ts`
Expected: FAIL — `Cannot find module '../../data/riders/ihealthy-ultra.json'`

- [ ] **Step 3: Write the extraction script**

Create `scripts/extract_ihu_benefits.py`:

```python
#!/usr/bin/env python3
"""Extract the ไอเฮลท์ตี้ อัลตร้า benefit table into data/riders/ihealthy-ultra.json.

The rate tables come from extract_rates.py; this reads what the rates cannot say — what
each of the six plans actually pays, and the contract terms that go on the page.

Deterministic: running twice on the same workbook yields byte-identical JSON.
"""
import json
import re
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parents[1]
XLSX = ROOT / "ไฟล์คำนวน" / "Sales proposal_Life Protect Plus 9 19 99_2026821_update benefit graph.xlsx"
OUT = ROOT / "data" / "riders" / "ihealthy-ultra.json"
BENEFIT_SHEET = "ผลประโยชน์ ไอเฮลท์ตี้ อัลตร้า"
TERMS_SHEET = "เงื่อนไขที่สำคัญ ข้อยกเว้น iHU"

# Benefit columns: the first of each plan's three (ผลประโยชน์ / จำนวนสูงสุด / ผลประโยชน์สูงสุด).
ADULT_COLS = {"SMART": "O", "BRONZE": "R", "SILVER": "U", "GOLD": "X", "DIAMOND": "AA", "PLATINUM": "AD"}
CHILD_COLS = {"SMART": "I", "BRONZE": "L"}
# The third column of each triple holds the annual maximum, merged down the whole block.
MAX_COLS = {"SMART": "Q", "BRONZE": "T", "SILVER": "W", "GOLD": "Z", "DIAMOND": "AC", "PLATINUM": "AF"}
PLAN_NAMES = {
    "SMART": "สมาร์ท", "BRONZE": "บรอนซ์", "SILVER": "ซิลเวอร์",
    "GOLD": "โกลด์", "DIAMOND": "ไดมอนด์", "PLATINUM": "แพลทินั่ม",
}
PLAN_NO = {"SMART": 1, "BRONZE": 2, "SILVER": 3, "GOLD": 4, "DIAMOND": 5, "PLATINUM": 6}
# กรอกข้อมูล!I4 ties the deductible to the plan number: 1-2 → 30,000, 3-4 → 50,000, 5-6 → 100,000.
DEDUCTIBLE = {1: 30_000, 2: 30_000, 3: 50_000, 4: 50_000, 5: 100_000, 6: 100_000}
# Rows that describe the customer's own choice rather than the plan, and the table headers.
SKIP_ROWS = {33, 34, 35, 36, 37, 38}
FIRST_ROW, LAST_ROW, ENDORSEMENT_FROM = 7, 53, 39


def merged_lookup(ws):
    """Map every covered cell to the coordinate that actually holds the value."""
    out = {}
    for rng in ws.merged_cells.ranges:
        anchor = ws.cell(rng.min_row, rng.min_col).coordinate
        for row in ws[rng.coord]:
            for c in row:
                out[c.coordinate] = anchor
    return out


def text(ws, merged, col, row):
    coord = merged.get(f"{col}{row}", f"{col}{row}")
    v = ws[coord].value
    if v is None:
        return ""
    if isinstance(v, float) and v == int(v):
        v = int(v)
    return re.sub(r"\s+", " ", str(v)).strip()


def leading_number(s):
    m = re.match(r"([\d,]+)", s)
    return int(m.group(1).replace(",", "")) if m else None


def section_no(title):
    """'หมวดที่ 14 ...' → 14. Sub-headings ('หมวดย่อยที่ 2.1') and group headings have none."""
    m = re.match(r"หมวดที่\s*(\d+)", title)
    return int(m.group(1)) if m else None


def extract():
    wb = openpyxl.load_workbook(XLSX, data_only=True)
    ws = wb[BENEFIT_SHEET]
    merged = merged_lookup(ws)

    plans = []
    for code, col in MAX_COLS.items():
        plans.append({
            "code": code,
            "name": PLAN_NAMES[code],
            "planNo": PLAN_NO[code],
            "annualMax": leading_number(text(ws, merged, col, 8)),
            "annualMaxNote": text(ws, merged, col, 8),
            "deductible": DEDUCTIBLE[PLAN_NO[code]],
        })

    rows = []
    for r in range(FIRST_ROW, LAST_ROW + 1):
        if r in SKIP_ROWS:
            continue
        title = text(ws, merged, "A", r)
        if not title:
            continue
        adult = {code: text(ws, merged, col, r) for code, col in ADULT_COLS.items()}
        if not any(adult.values()):
            rows.append({"heading": title})
            continue
        child = {code: text(ws, merged, col, r) for code, col in CHILD_COLS.items()}
        entry = {
            "no": section_no(title),
            "title": title,
            "endorsement": r >= ENDORSEMENT_FROM,
            "adult": adult,
        }
        # Only สมาร์ท and บรอนซ์ sell to a child, and only where the wording differs is the
        # child column worth carrying: everything else is the adult row.
        if any(child[c] != adult[c] for c in CHILD_COLS):
            entry["child"] = child
        rows.append(entry)

    tw = wb[TERMS_SHEET]
    diseases = []
    for r in range(12, 16):
        for c in ("A", "B"):
            v = text(tw, {}, c, r).lstrip("- ").strip()
            if v:
                diseases.append(v)

    data = {
        "name": "ไอเฮลท์ตี้ อัลตร้า",
        "code": "IHU",
        "source": XLSX.name,
        "plans": plans,
        "copayPercent": 20,
        "rows": rows,
        "terms": {
            "renewalToAge": 98,
            "waitingDays": 30,
            "specialWaitingDays": 120,
            "specialWaitingDiseases": diseases,
            "noClaimDiscountPercent": 10,
            "outOfTerritoryDays": 90,
            "renewalCopay": text(tw, {}, "A", 6),
            "preExisting": " ".join(text(tw, {}, "A", r) for r in range(17, 23) if text(tw, {}, "A", r)),
            "exclusions": text(tw, {}, "A", 25),
            "premiumChanges": text(ws, merged, "A", 67),
            "outOfTerritory": text(ws, merged, "A", 63),
            "noClaimDiscount": text(ws, merged, "A", 62),
            "sharedLimit": text(ws, merged, "A", 64),
            "participationNote": text(ws, merged, "A", 58),
        },
        "disclaimer": text(ws, merged, "A", 68),
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"wrote {OUT} ({OUT.stat().st_size} bytes)")


if __name__ == "__main__":
    extract()
```

- [ ] **Step 4: Register it with the other extractors**

In `scripts/extract_rates.py`, add the import beside the other module-level imports:

```python
from extract_ihu_benefits import extract as extract_ihu_benefits
```

and add the entry to the `EXTRACTORS` dict, after `"dci-diseases": extract_dci_diseases,`:

```python
    "ihealthy-ultra": extract_ihu_benefits,
```

- [ ] **Step 5: Run the extraction**

Run: `python3 scripts/extract_ihu_benefits.py`
Expected: `wrote .../data/riders/ihealthy-ultra.json (NNNNN bytes)`

- [ ] **Step 6: Run the test to verify it passes**

Run: `npx vitest run tests/calc/ihealthy-benefits.test.ts`
Expected: PASS, 8 tests.

If `row(18).adult.SILVER` comes back empty, the merge lookup is not being applied — check that `merged_lookup` covers `U43:U44`.

- [ ] **Step 7: Commit**

```bash
git add scripts/extract_ihu_benefits.py scripts/extract_rates.py data/riders/ihealthy-ultra.json tests/calc/ihealthy-benefits.test.ts
git commit -m "feat(data): extract the ไอเฮลท์ตี้ อัลตร้า benefit table"
```

---

## Task 2: The slim rate table

**Files:**
- Create: `src/lib/ihealthy-table.ts`
- Test: `tests/calc/ihealthy-table.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/calc/ihealthy-table.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { iHealthyTable } from "@/lib/ihealthy-table";

const WHILE_CURRENT = new Date("2026-09-12");
const table = iHealthyTable(WHILE_CURRENT);

describe("iHealthyTable", () => {
  it("offers the three bases the spec keeps, in order", () => {
    expect(table.bases.map((b) => b.variant)).toEqual(["WLF99L", "WLF99H", "WLF99HX"]);
    expect(table.bases.map((b) => b.booster)).toEqual([0.5, 1, 1]);
    expect(table.bases[2].fixedSum).toBe(50_000);
    expect(table.bases[0].fixedSum).toBeUndefined();
    expect(table.bases[0].saMin).toBe(150_000);
  });

  it("takes the age range from the health rider, not the base plan", () => {
    expect(table.ageMin).toBe(6);
    expect(table.ageMax).toBe(80);
  });

  it("carries the six plans with their annual maximum", () => {
    expect(table.plans.map((p) => p.code)).toEqual(["SMART", "BRONZE", "SILVER", "GOLD", "DIAMOND", "PLATINUM"]);
    expect(table.plans[5].annualMax).toBe(100_000_000);
  });

  it("holds a rate for every key the workbook has and nothing else", () => {
    expect(Object.keys(table.riderRates)).toHaveLength(28);
    expect(table.riderRates.MHP6S.F[35 - table.ageMin]).toBe(170_500);
    expect(table.riderRates.MHP2S.F[45 - table.ageMin]).toBe(26_700);
    expect(table.riderRates.MHP1J.M[6 - table.ageMin]).toBe(46_700);
    expect(table.riderRates.MHP6S.F[8 - table.ageMin]).toBeNull();
    expect(table.riderRates.MHP4SA).toBeUndefined();
    expect(table.riderRates.MHP3J).toBeUndefined();
  });

  it("carries the base rate per thousand for each variant", () => {
    // ไลฟ์ โพรเทค+ x 2 ถึงอายุ 99, หญิง 35: 1.42 per thousand → 2,130 on a million and a half
    expect(table.bases[1].rates.F[35 - table.ageMin]).toBeGreaterThan(0);
    expect(table.bases[2].rates.F[35 - table.ageMin]).toBeGreaterThan(0);
  });

  it("passes the rate version and the expiry through", () => {
    expect(table.rateVersion).toBe("A2026-1");
    expect(table.expired).toBe(false);
    expect(iHealthyTable(new Date("2027-04-01")).expired).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/calc/ihealthy-table.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/ihealthy-table"`

- [ ] **Step 3: Write the table builder**

Create `src/lib/ihealthy-table.ts`:

```ts
import { getPlan } from "@/calc/plans/registry";
import { baseRate } from "@/calc/lookup";
import type { PayMode, Sex } from "@/calc/types";
import benefits from "../../data/riders/ihealthy-ultra.json";

/**
 * Everything the health page needs to price itself in the browser.
 *
 * The registry holds five plans and about 2.7 MB of rate tables, and the two payor riders
 * alone are 416 kB of it. A customer reading this page picks a base plan and a health plan
 * and nothing else, so only those rates travel: three columns of base rate and the 28 keyed
 * tables of the rider. The engine, and every other rider, stays on the server behind the
 * action in `src/app/ihealthy/actions.ts`.
 */
export interface IHealthyBase {
  variant: string;
  /** what the button says, e.g. "x 2" */
  short: string;
  /** what prose calls it, e.g. "ไลฟ์ โพรเทค+ x 2" */
  label: string;
  /** the note under the button, e.g. "ตั้งทุนเอง" */
  note: string;
  /** the extra multiple paid on death before the booster age (1 = pays double) */
  booster: number;
  /** the package pins the sum assured here and the form must not let it change */
  fixedSum?: number;
  saMin: number;
  /** rate per thousand, [sex][age - ageMin]; null where the workbook has no rate */
  rates: Record<Sex, (number | null)[]>;
  /** riders this package refuses to sell, so the fold can grey them without asking */
  disabledRiders: string[];
  /** riders this package forces; IHU is always among them for WLF99HX */
  requiredRiders: string[];
}

export interface IHealthyPlanOption {
  code: string;
  name: string;
  planNo: number;
  annualMax: number;
  deductible: number;
}

export interface IHealthyTable {
  planCode: string;
  ageMin: number;
  ageMax: number;
  /** below this age only สมาร์ท and บรอนซ์ sell, and only in Thailand */
  juvenileBelowAge: number;
  expired: boolean;
  expiresOn: string;
  rateVersion: string;
  minMonthly: number;
  boosterBeforeAge: number;
  modeFactors: Record<PayMode, number>;
  bases: IHealthyBase[];
  plans: IHealthyPlanOption[];
  /** Thai label → the letter the rate key uses */
  territories: Record<string, string>;
  /** Thai label → the letter the rate key uses */
  coverages: Record<string, string>;
  /** rider annual premium, [key][sex][age - ageMin]; null where the workbook has no rate */
  riderRates: Record<string, Record<Sex, (number | null)[]>>;
}

const PLAN_CODE = "LIFEPROTECT";
const RIDER = "IHU";
/** The key builder switches from the juvenile table to the standard one here. */
const JUVENILE_BELOW_AGE = 11;

const BASES: { variant: string; short: string; label: string; note: string }[] = [
  { variant: "WLF99L", short: "x 1.5", label: "ไลฟ์ โพรเทค+ x 1.5", note: "ตั้งทุนเอง" },
  { variant: "WLF99H", short: "x 2", label: "ไลฟ์ โพรเทค+ x 2", note: "ตั้งทุนเอง" },
  { variant: "WLF99HX", short: "แพ็กเกจสุขภาพ", label: "Health Ultra Package", note: "ทุน 50,000" },
];

let cached: Omit<IHealthyTable, "expired"> | undefined;

export function iHealthyTable(today: Date = new Date()): IHealthyTable {
  const plan = getPlan(PLAN_CODE)!;
  const expired = today.toISOString().slice(0, 10) > plan.rates.expiresOn;
  if (cached) return { ...cached, expired };

  const { rates, rules } = plan;
  const rider = rates.riders[RIDER];
  if (rider.kind !== "fixedByKeyAge") throw new Error("IHU is not a keyed rider any more");
  const ageMin = rules.riders[RIDER].ageMin;
  const ageMax = rules.riders[RIDER].ageMax;
  const ages = Array.from({ length: ageMax - ageMin + 1 }, (_, i) => ageMin + i);

  const bases: IHealthyBase[] = BASES.map((b) => {
    const pkg = rates.base.packages!.find((p) => p.code === b.variant)!;
    const rule = (rules.packages ?? []).find((p) => p.seq.includes(pkg.seq));
    return {
      ...b,
      booster: pkg.booster ?? 0,
      ...(rules.base.saExactVariants?.includes(b.variant)
        ? { fixedSum: rules.base.saMinByVariant![b.variant] }
        : {}),
      saMin: rules.base.saMinByVariant?.[b.variant] ?? rules.base.saMin,
      rates: {
        M: ages.map((age) => baseRate(rates, b.variant, "M", age) ?? null),
        F: ages.map((age) => baseRate(rates, b.variant, "F", age) ?? null),
      },
      disabledRiders: rule?.disable ?? [],
      requiredRiders: rule?.require ?? [],
    };
  });

  const riderRates: IHealthyTable["riderRates"] = {};
  for (const [key, bySex] of Object.entries(rider.rates)) {
    riderRates[key] = {
      M: ages.map((age) => bySex.M?.[String(age)] ?? null),
      F: ages.map((age) => bySex.F?.[String(age)] ?? null),
    };
  }

  cached = {
    planCode: PLAN_CODE,
    ageMin,
    ageMax,
    juvenileBelowAge: JUVENILE_BELOW_AGE,
    expiresOn: rates.expiresOn,
    rateVersion: rates.version,
    minMonthly: rules.minMonthlyTotal,
    boosterBeforeAge: rules.base.extraDeathBenefitBeforeAge!,
    modeFactors: rates.modeFactors,
    bases,
    plans: benefits.plans.map((p) => ({
      code: p.code, name: p.name, planNo: p.planNo, annualMax: p.annualMax, deductible: p.deductible,
    })),
    territories: rider.territory!,
    coverages: rider.coverage!,
    riderRates,
  };
  return { ...cached, expired };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/calc/ihealthy-table.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ihealthy-table.ts tests/calc/ihealthy-table.test.ts
git commit -m "feat(ihealthy): build the slim rate table the browser prices from"
```

---

## Task 3: Browser-side pricing, and the parity test

**Files:**
- Create: `src/lib/ihealthy-quote.ts`
- Test: `tests/calc/ihealthy-quote.test.ts`

This is the task that keeps the page honest. The 200-case test prices random arrangements
both in the browser's arithmetic and through `quote()`, and they must agree to the satang.

- [ ] **Step 1: Write the failing test**

Create `tests/calc/ihealthy-quote.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { quote } from "@/calc/quote";
import { iHealthyTable } from "@/lib/ihealthy-table";
import { coveragesFor, iHealthyPricing, ihuKey, plansFor, territoriesFor } from "@/lib/ihealthy-quote";
import type { Sex } from "@/calc/types";

const WHILE_CURRENT = new Date("2026-09-12");
const table = iHealthyTable(WHILE_CURRENT);

/** A small seeded generator, so a failing case can be re-run. */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SUMS = [150_000, 500_000, 1_000_000, 2_000_000, 5_000_000];

describe("ihuKey", () => {
  it("builds the workbook's key", () => {
    expect(ihuKey(table, "PLATINUM", 35, "ประเทศไทย", "Full Coverage")).toBe("MHP6S");
    expect(ihuKey(table, "SMART", 8, "ประเทศไทย", "Full Coverage")).toBe("MHP1J");
    expect(ihuKey(table, "DIAMOND", 30, "เอเชีย", "Full Coverage")).toBe("MHP5SA");
    expect(ihuKey(table, "PLATINUM", 30, "ประเทศไทย", "Deductible")).toBe("MHPD6S");
  });
});

describe("the option filters", () => {
  it("offers a child two plans, Thailand only", () => {
    expect(plansFor(table, 8).map((p) => p.code)).toEqual(["SMART", "BRONZE"]);
    expect(territoriesFor(table, "SMART", 8)).toEqual(["ประเทศไทย"]);
  });

  it("offers an adult all six, but only the top two travel", () => {
    expect(plansFor(table, 35)).toHaveLength(6);
    expect(territoriesFor(table, "GOLD", 35)).toEqual(["ประเทศไทย"]);
    expect(territoriesFor(table, "PLATINUM", 35)).toEqual(["ประเทศไทย", "เอเชีย", "ทั่วโลก"]);
  });

  it("sells the deductible and the co-payment in Thailand only", () => {
    expect(coveragesFor(table, "ประเทศไทย")).toEqual(["Full Coverage", "Deductible", "Co-Payment"]);
    expect(coveragesFor(table, "เอเชีย")).toEqual(["Full Coverage"]);
  });
});

describe("iHealthyPricing", () => {
  it("prices the workbook's own example — หญิง 45 บรอนซ์ ประเทศไทย", () => {
    const p = iHealthyPricing(table, {
      base: "WLF99H", sex: "F", age: 45, sumAssured: 1_000_000,
      plan: "BRONZE", territory: "ประเทศไทย", coverage: "Full Coverage",
    })!;
    expect(p.rider.find((m) => m.mode === "annual")!.total).toBe(2_670_000);
  });

  /**
   * The browser's arithmetic is the page's only source of prices for the base plan and the
   * health rider, so it has to be the engine's arithmetic.
   */
  it("agrees with the engine in every mode across random arrangements", () => {
    const next = rng(20260912);
    const pick = <T,>(xs: readonly T[]) => xs[Math.floor(next() * xs.length)];
    let checked = 0;
    for (let i = 0; i < 200; i++) {
      const base = pick(table.bases);
      const sex: Sex = pick(["M", "F"] as const);
      const age = table.ageMin + Math.floor(next() * (table.ageMax - table.ageMin + 1));
      const plan = pick(plansFor(table, age));
      const territory = pick(territoriesFor(table, plan.code, age));
      const coverage = pick(coveragesFor(table, territory));
      const sumAssured = base.fixedSum ?? pick(SUMS);
      const choice = { base: base.variant, sex, age, sumAssured, plan: plan.code, territory, coverage };
      const priced = iHealthyPricing(table, choice);
      if (!priced) continue;
      checked++;
      for (const m of priced.total) {
        const q = quote({
          planCode: "LIFEPROTECT", variant: base.variant, age, sex, mode: m.mode,
          basis: "sumAssured", sumAssured,
          riders: [{ code: "IHU", option: plan.code, territory, coverage }],
        }, WHILE_CURRENT);
        const label = `${base.variant} ${plan.code} ${territory} ${coverage} ${sex} ${age} ${sumAssured} ${m.mode}`;
        expect(q.totalModal, label).toBe(m.total);
        expect(q.warnings.some((w) => w.code === "MIN_MONTHLY"), label).toBe(m.belowMinimum);
      }
    }
    expect(checked).toBeGreaterThan(150);
  });

  it("prices a child on the health package the way the engine does", () => {
    const p = iHealthyPricing(table, {
      base: "WLF99HX", sex: "M", age: 8, sumAssured: 50_000,
      plan: "BRONZE", territory: "ประเทศไทย", coverage: "Full Coverage",
    })!;
    expect(p.base.find((m) => m.mode === "annual")!.total).toBe(38_000);
    expect(p.rider.find((m) => m.mode === "annual")!.total).toBe(3_860_000);
    expect(p.total.find((m) => m.mode === "annual")!.total).toBe(3_898_000);
  });

  it("has no price for a combination the company does not sell", () => {
    expect(iHealthyPricing(table, {
      base: "WLF99H", sex: "F", age: 35, sumAssured: 1_000_000,
      plan: "GOLD", territory: "เอเชีย", coverage: "Full Coverage",
    })).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/calc/ihealthy-quote.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/ihealthy-quote"`

- [ ] **Step 3: Write the pricing module**

Create `src/lib/ihealthy-quote.ts`:

```ts
import type { ModePremium } from "@/calc/mode-premiums";
import { applyModeFactor, applyModeFactorToFixed, toHundredths } from "@/calc/money";
import type { DeathBenefit, PayMode, Sex } from "@/calc/types";
import type { IHealthyPlanOption, IHealthyTable } from "@/lib/ihealthy-table";

/** Same order as calc/mode-premiums; repeated here so the browser does not import the engine. */
const MODES: PayMode[] = ["annual", "semi", "monthly"];

export interface IHealthyChoice {
  base: string;
  sex: Sex;
  age: number;
  sumAssured: number;
  plan: string;
  territory: string;
  coverage: string;
}

export interface IHealthyPricing {
  /** the base plan on its own, per mode */
  base: ModePremium[];
  /** the health rider on its own, per mode */
  rider: ModePremium[];
  /** what the customer actually pays, and the mode that falls under the company's floor */
  total: ModePremium[];
}

/**
 * The key the workbook composes at `'iHealthy Ultra Rate'!D7`:
 * "MHP" + coverage letter + plan number + (age < 11 ? "J" : "S") + territory letter.
 */
export function ihuKey(
  table: IHealthyTable, plan: string, age: number, territory: string, coverage: string,
): string | undefined {
  const option = table.plans.find((p) => p.code === plan);
  const c = table.coverages[coverage];
  const t = table.territories[territory];
  if (!option || c === undefined || t === undefined) return undefined;
  return `MHP${c}${option.planNo}${age < table.juvenileBelowAge ? "J" : "S"}${t}`;
}

function hasRate(table: IHealthyTable, key: string, age: number): boolean {
  const rates = table.riderRates[key];
  if (!rates) return false;
  const i = age - table.ageMin;
  return rates.M[i] !== null || rates.F[i] !== null;
}

/**
 * The plans this age can buy, which the rate table answers on its own: there is no
 * `MHP3J`, so a child is never offered ซิลเวอร์. Matching `กรอกข้อมูล!M29` without
 * repeating its conditions.
 */
export function plansFor(table: IHealthyTable, age: number): IHealthyPlanOption[] {
  return table.plans.filter((p) => {
    const key = ihuKey(table, p.code, age, "ประเทศไทย", "Full Coverage");
    return key !== undefined && hasRate(table, key, age);
  });
}

/** The territories this plan sells in at this age, again read off the rate table. */
export function territoriesFor(table: IHealthyTable, plan: string, age: number): string[] {
  return Object.keys(table.territories).filter((t) => {
    const key = ihuKey(table, plan, age, t, "Full Coverage");
    return key !== undefined && hasRate(table, key, age);
  });
}

/** Outside Thailand the company sells full cover only. */
export function coveragesFor(table: IHealthyTable, territory: string): string[] {
  return territory === "ประเทศไทย" ? Object.keys(table.coverages) : ["Full Coverage"];
}

function baseModes(table: IHealthyTable, choice: IHealthyChoice): ModePremium[] | undefined {
  const base = table.bases.find((b) => b.variant === choice.base);
  const rate = base?.rates[choice.sex][choice.age - table.ageMin];
  if (rate === null || rate === undefined) return undefined;
  const rate100 = toHundredths(rate);
  return MODES.map((mode) => ({
    mode,
    total: applyModeFactor(rate100, choice.sumAssured, toHundredths(table.modeFactors[mode])),
    belowMinimum: false,
  }));
}

function riderModes(table: IHealthyTable, choice: IHealthyChoice): ModePremium[] | undefined {
  const key = ihuKey(table, choice.plan, choice.age, choice.territory, choice.coverage);
  const annual = key ? table.riderRates[key]?.[choice.sex][choice.age - table.ageMin] : null;
  if (annual === null || annual === undefined) return undefined;
  const annual100 = toHundredths(annual);
  return MODES.map((mode) => ({
    mode,
    total: applyModeFactorToFixed(annual100, toHundredths(table.modeFactors[mode])),
    belowMinimum: false,
  }));
}

/**
 * The base plan and the health rider priced in every mode, the way base-premium.ts and
 * riders/fixed-by-key-age.ts do it: the base is a rate per thousand rounded down in satang,
 * the rider is a fixed annual premium scaled by the mode factor and rounded down. The
 * company's monthly floor is judged on the total, as `checkMonthlyMinimum` judges it.
 *
 * Undefined when the arrangement has no price, which the pickers already prevent.
 */
export function iHealthyPricing(table: IHealthyTable, choice: IHealthyChoice): IHealthyPricing | undefined {
  const base = baseModes(table, choice);
  const rider = riderModes(table, choice);
  if (!base || !rider) return undefined;
  const total = MODES.map((mode, i) => {
    const sum = base[i].total + rider[i].total;
    return { mode, total: sum, belowMinimum: mode === "monthly" && sum < table.minMonthly * 100 };
  });
  return { base, rider, total };
}

/** What quote.ts returns for this base with no death-paying rider attached. */
export function deathBenefitOf(table: IHealthyTable, base: string, age: number, sumAssured: number): DeathBenefit {
  const booster = table.bases.find((b) => b.variant === base)?.booster ?? 0;
  const alreadyPastAge = age >= table.boosterBeforeAge;
  return {
    beforeAge: table.boosterBeforeAge,
    sumBefore: alreadyPastAge ? sumAssured : sumAssured + Math.round(sumAssured * booster),
    sumFrom: sumAssured,
    alreadyPastAge,
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/calc/ihealthy-quote.test.ts`
Expected: PASS, 8 tests. The parity test reports no failures.

If a case fails on `belowMinimum`, the floor is being judged per component instead of on the total — only `total` carries it.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ihealthy-quote.ts tests/calc/ihealthy-quote.test.ts
git commit -m "feat(ihealthy): price the base and the health rider in the browser"
```

---

## Task 4: Shape the benefit data for the page

**Files:**
- Create: `src/lib/ihealthy-facts.ts`
- Test: `tests/calc/ihealthy-facts.test.ts`

The JSON is a faithful copy of the sheet. This module gives it types and answers the one
question the table component keeps asking: what does this plan pay for this row, at this age.

- [ ] **Step 1: Write the failing test**

Create `tests/calc/ihealthy-facts.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { benefitValue, iHealthyFacts, isHeading } from "@/lib/ihealthy-facts";

const facts = iHealthyFacts();
const row = (no: number) => facts.rows.find((r) => !isHeading(r) && r.no === no)!;

describe("iHealthyFacts", () => {
  it("keeps the sheet's order, headings and all", () => {
    expect(isHeading(facts.rows[0])).toBe(true);
    expect(facts.rows.filter(isHeading).length).toBeGreaterThan(2);
  });

  it("splits the contract from the endorsement", () => {
    expect(row(13).endorsement).toBe(false);
    expect(row(14).endorsement).toBe(true);
  });
});

describe("benefitValue", () => {
  const doctorFee = row(3);
  const roomRate = row(1);

  it("reads the adult column from age 11", () => {
    expect(benefitValue(doctorFee, "SMART", 11, facts.juvenileBelowAge)).toBe("ตามที่จ่ายจริง");
  });

  it("swaps to the child column below 11 where the sheet has one", () => {
    expect(benefitValue(doctorFee, "SMART", 10, facts.juvenileBelowAge)).toBe("1,000 ต่อวัน*/ ตามที่จ่ายจริง");
    expect(benefitValue(doctorFee, "BRONZE", 6, facts.juvenileBelowAge)).toBe("3,000 ต่อวัน*/ ตามที่จ่ายจริง");
  });

  it("falls back to the adult column for rows with no child variant", () => {
    expect(benefitValue(roomRate, "SMART", 8, facts.juvenileBelowAge)).toBe("1,500 ต่อวัน");
  });

  it("does not decide who may buy what — that is the rate table's answer", () => {
    expect(benefitValue(doctorFee, "PLATINUM", 8, facts.juvenileBelowAge)).toBe("ตามที่จ่ายจริง");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/calc/ihealthy-facts.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/ihealthy-facts"`

- [ ] **Step 3: Write the module**

Create `src/lib/ihealthy-facts.ts`:

```ts
import { JUVENILE_BELOW_AGE } from "@/calc/riders/fixed-by-key-age";
import raw from "../../data/riders/ihealthy-ultra.json";

/** A row that names a part of the contract and has no figures of its own. */
export interface BenefitHeading {
  heading: string;
}

export interface BenefitRow {
  /** the หมวด number, or null for a sub-row like หมวดย่อยที่ 2.1 */
  no: number | null;
  title: string;
  /** true for the rows that live on the endorsement rather than the rider itself */
  endorsement: boolean;
  /** plan code → what the sheet says, verbatim */
  adult: Record<string, string>;
  /** the สมาร์ท and บรอนซ์ wording for a child, only where it differs */
  child?: Record<string, string>;
}

export type BenefitEntry = BenefitHeading | BenefitRow;

export interface IHealthyTerms {
  renewalToAge: number;
  waitingDays: number;
  specialWaitingDays: number;
  specialWaitingDiseases: string[];
  noClaimDiscountPercent: number;
  outOfTerritoryDays: number;
  renewalCopay: string;
  preExisting: string;
  exclusions: string;
  premiumChanges: string;
  outOfTerritory: string;
  noClaimDiscount: string;
  sharedLimit: string;
  participationNote: string;
}

export interface IHealthyFacts {
  name: string;
  plans: { code: string; name: string; planNo: number; annualMax: number; deductible: number }[];
  copayPercent: number;
  rows: BenefitEntry[];
  terms: IHealthyTerms;
  disclaimer: string;
  /** below this age the child columns apply; the same boundary the rate key uses */
  juvenileBelowAge: number;
}

export function isHeading(entry: BenefitEntry): entry is BenefitHeading {
  return "heading" in entry;
}

/**
 * What this plan pays on this row for someone of this age. Only the wording changes here —
 * whether the company sells that plan at that age is the rate table's answer, and the table
 * component asks `plansFor` for it rather than keeping a second list of who may buy what.
 */
export function benefitValue(
  row: BenefitRow, plan: string, age: number, juvenileBelowAge: number,
): string | undefined {
  if (age < juvenileBelowAge && row.child && plan in row.child) return row.child[plan];
  return row.adult[plan];
}

export function iHealthyFacts(): IHealthyFacts {
  return { ...(raw as unknown as Omit<IHealthyFacts, "juvenileBelowAge">), juvenileBelowAge: JUVENILE_BELOW_AGE };
}

// JUVENILE_BELOW_AGE is imported from the engine's key builder, which is the one place the
// boundary is defined; see src/calc/riders/fixed-by-key-age.ts.
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/calc/ihealthy-facts.test.ts`
Expected: PASS, 6 tests.

If the โกลด์ case returns a string instead of undefined, `JUVENILE_PLANS` is not being
consulted — the guard belongs in this module, not in the table component, so that every
caller gets the same answer.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ihealthy-facts.ts tests/calc/ihealthy-facts.test.ts
git commit -m "feat(ihealthy): shape the benefit rows for the page"
```

---

## Task 5: The benefit table

**Files:**
- Create: `src/components/ihealthy/BenefitTable.tsx`

Six plan columns of Thai text will not fit a phone, so the table scrolls inside its own box
with the row titles pinned to the left edge. The chosen plan's column is tinted gold.

- [ ] **Step 1: Write the component**

Create `src/components/ihealthy/BenefitTable.tsx`:

```tsx
import { benefitValue, isHeading, type BenefitEntry, type IHealthyFacts } from "@/lib/ihealthy-facts";

export interface BenefitTableProps {
  facts: IHealthyFacts;
  /** the plan whose column is highlighted */
  selected: string;
  /** the age the columns are read at; under 11 swaps in the child wording */
  age: number;
  /** the plan codes the company sells at this age, from `plansFor` */
  sellable: string[];
}

const DASH = "-";

/** A cell the company left blank reads as a dash, not as an empty gap. */
function cellText(entry: BenefitEntry, plan: string, age: number, juvenileBelowAge: number): string {
  if (isHeading(entry)) return "";
  const v = benefitValue(entry, plan, age, juvenileBelowAge);
  return v === undefined || v === "" ? DASH : v;
}

export function BenefitTable({ facts, selected, age }: BenefitTableProps) {
  const plans = facts.plans;
  return (
    <div className="rounded-sm border border-[var(--lg-hair)] bg-[var(--lg-panel)]">
      <div className="overflow-x-auto">
        <table className="w-max min-w-full border-collapse text-xs">
          <caption className="sr-only">ตารางผลประโยชน์ ไอเฮลท์ตี้ อัลตร้า ทั้ง 6 แผน</caption>
          <thead>
            <tr>
              <th
                scope="col"
                className="sticky left-0 z-10 w-56 min-w-56 max-w-56 bg-[var(--lg-panel)] px-3 py-2.5 text-left font-medium text-[var(--lg-mute)]"
              >
                ผลประโยชน์
              </th>
              {plans.map((p) => (
                <th
                  key={p.code} scope="col"
                  className={`min-w-28 px-3 py-2.5 text-center font-medium ${
                    p.code === selected ? "bg-[var(--lg-raise)] text-[var(--lg-gold)]" : "text-[var(--lg-mute)]"
                  }`}
                >
                  {p.name}
                  <span className="mt-0.5 block text-[0.65rem] font-normal tabular-nums opacity-80">
                    {(p.annualMax / 1_000_000).toLocaleString("en-US")} ล้าน
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {facts.rows.map((entry, i) =>
              isHeading(entry) ? (
                <tr key={`h${i}`}>
                  <th
                    scope="colgroup" colSpan={plans.length + 1}
                    className="sticky left-0 bg-[var(--lg-raise)] px-3 py-2 text-left text-[0.7rem] font-medium uppercase tracking-wide text-[var(--lg-gold)]"
                  >
                    {entry.heading}
                  </th>
                </tr>
              ) : (
                <tr key={`r${i}`} className="border-t border-[var(--lg-panel-line)] align-top">
                  <th
                    scope="row"
                    className="sticky left-0 z-10 w-56 min-w-56 max-w-56 bg-[var(--lg-panel)] px-3 py-2 text-left text-[0.7rem] font-normal leading-relaxed text-[var(--lg-mute)]"
                  >
                    {entry.title}
                  </th>
                  {plans.map((p) => (
                    <td
                      key={p.code}
                      className={`px-3 py-2 text-center leading-relaxed tabular-nums ${
                        p.code === selected
                          ? "bg-[var(--lg-raise)] text-[var(--lg-white)]"
                          : "text-[var(--lg-mute)]"
                      }`}
                    >
                      {cellText(entry, p.code, age, facts.juvenileBelowAge)}
                    </td>
                  ))}
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>
      <p className="border-t border-[var(--lg-panel-line)] px-3 py-2.5 text-[0.7rem] leading-relaxed text-[var(--lg-mute)] opacity-80">
        เลื่อนตารางไปทางขวาเพื่อดูแผนอื่น · {facts.terms.sharedLimit}
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ihealthy/BenefitTable.tsx
git commit -m "feat(ihealthy): the 28-category benefit table across six plans"
```

---

## Task 6: The calculator, the page, and the route

**Files:**
- Create: `src/components/IHealthyCalculator.tsx`
- Create: `src/app/ihealthy/page.tsx`
- Create: `src/app/ihealthy/layout.tsx`
- Create: `src/components/ihealthy/Sections.tsx`

At the end of this task the page exists and prices itself. Riders come in Task 7.

- [ ] **Step 1: Write the sections**

Create `src/components/ihealthy/Sections.tsx`:

```tsx
import { Fold, H2, Rule } from "@/components/sales/Blocks";
import type { IHealthyFacts } from "@/lib/ihealthy-facts";

export function Hero({ facts }: { facts: IHealthyFacts }) {
  const top = facts.plans[facts.plans.length - 1];
  return (
    <header className="pt-10 pb-8">
      <h1 className="lg-figure text-[2rem] leading-tight text-[var(--lg-white)] sm:text-4xl">
        ค่ารักษาพยาบาล <span className="lg-metal-text">ไอเฮลท์ตี้ อัลตร้า</span>
      </h1>
      <p className="mt-4 text-base leading-[1.9] text-[var(--lg-mute)]">
        เหมาจ่ายต่อปีสูงสุด {(top.annualMax / 1_000_000).toLocaleString("en-US")} ล้านบาท
        เลือกวงเงินได้ {facts.plans.length} แผน ต่ออายุได้ถึงอายุ {facts.terms.renewalToAge} ปี
      </p>
    </header>
  );
}

export function TermsSection({ facts }: { facts: IHealthyFacts }) {
  const t = facts.terms;
  return (
    <section className="py-10">
      <H2>เงื่อนไขที่ต้องรู้ก่อนตัดสินใจ</H2>
      <div className="mt-5">
        <Fold summary={`ไม่คุ้มครอง ${t.waitingDays} วันแรก และ ${t.specialWaitingDays} วันแรกสำหรับบางโรค`}>
          <p>
            การป่วยที่เกิดใน {t.waitingDays} วันแรกนับจากวันเริ่มคุ้มครองไม่ได้รับความคุ้มครอง
            และอีก {t.specialWaitingDiseases.length} กลุ่มโรคนี้ต้องรอถึง {t.specialWaitingDays} วัน
          </p>
          <ul className="mt-2 grid gap-x-6 gap-y-1 sm:grid-cols-2">
            {t.specialWaitingDiseases.map((d) => <li key={d}>· {d}</li>)}
          </ul>
        </Fold>
        <Fold summary="สภาพที่เป็นมาก่อนทำประกัน">
          <p>{t.preExisting}</p>
        </Fold>
        <Fold summary={`ไม่เคลมทั้งปี ลดเบี้ย ${t.noClaimDiscountPercent} เปอร์เซ็นต์`}>
          <p>{t.noClaimDiscount}</p>
        </Fold>
        <Fold summary="บริษัทขอให้ร่วมจ่ายตอนต่ออายุได้">
          <p>{t.renewalCopay}</p>
        </Fold>
        <Fold summary="เบี้ยปีต่ออายุเปลี่ยนได้">
          <p>{t.premiumChanges}</p>
        </Fold>
        <Fold summary={`รักษานอกอาณาเขต คุ้มครองฉุกเฉิน ${t.outOfTerritoryDays} วันแรกของการเดินทาง`}>
          <p>{t.outOfTerritory}</p>
        </Fold>
        <Fold summary="ข้อยกเว้น 21 ข้อ">
          <p>{t.exclusions}</p>
        </Fold>
      </div>
    </section>
  );
}

export function Disclaimer({ facts, rateVersion }: { facts: IHealthyFacts; rateVersion: string }) {
  return (
    <section className="py-10">
      <Rule />
      <p className="pt-6 text-xs leading-[1.9] text-[var(--lg-mute)] opacity-80">
        {facts.disclaimer}
      </p>
      <p className="mt-3 text-xs leading-[1.9] text-[var(--lg-mute)] opacity-80">
        เบี้ยที่แสดงเป็นเบี้ยปีแรกของอาชีพชั้น 1 เบี้ยปีต่อไปคิดตามอายุที่เพิ่มขึ้น ·
        อัตราเบี้ยชุด {rateVersion}
      </p>
    </section>
  );
}
```

- [ ] **Step 2: Name the arrangement the page is looking at**

The form's state is also what a shared link carries, and Task 9's link module and this
component both need the type. It lives on its own so neither imports the other.

Create `src/lib/ihealthy-choice.ts`:

```ts
import type { PayMode, Sex } from "@/calc/types";

/** Every choice the form holds: what a link carries and what the calculator opens on. */
export interface IHealthyInitial {
  age: number;
  sex: Sex;
  base: string;
  sumAssured: number;
  plan: string;
  territory: string;
  coverage: string;
  mode: PayMode;
}
```

- [ ] **Step 3: Write the calculator island**

Create `src/components/IHealthyCalculator.tsx`:

```tsx
"use client";
import { useEffect, useMemo, useState } from "react";
import type { PayMode, Sex } from "@/calc/types";
import { PAY_MODE_LABEL } from "@/calc/types";
import { formatBaht } from "@/calc/money";
import type { IHealthyTable } from "@/lib/ihealthy-table";
import type { IHealthyFacts } from "@/lib/ihealthy-facts";
import {
  coveragesFor, deathBenefitOf, iHealthyPricing, plansFor, territoriesFor,
} from "@/lib/ihealthy-quote";
import type { IHealthyInitial } from "@/lib/ihealthy-choice";
import { BenefitTable } from "@/components/ihealthy/BenefitTable";

const MODES: PayMode[] = ["annual", "semi", "monthly"];
const COVERAGE_LABEL: Record<string, string> = {
  "Full Coverage": "เต็มจำนวน",
  Deductible: "มีความรับผิดส่วนแรก",
  "Co-Payment": "ร่วมจ่าย",
};
/** The sums the base plan offers when the customer may choose one. */
const SUMS = [150_000, 300_000, 500_000, 1_000_000, 2_000_000, 3_000_000, 5_000_000];

export interface IHealthyCalculatorProps {
  table: IHealthyTable;
  facts: IHealthyFacts;
  initial: IHealthyInitial;
}

export function IHealthyCalculator({ table, facts, initial }: IHealthyCalculatorProps) {
  const AGES = useMemo(
    () => Array.from({ length: table.ageMax - table.ageMin + 1 }, (_, i) => table.ageMin + i),
    [table.ageMin, table.ageMax],
  );
  const [age, setAge] = useState(initial.age);
  const [sex, setSex] = useState<Sex>(initial.sex);
  const [base, setBase] = useState(initial.base);
  const [sumAssured, setSumAssured] = useState(initial.sumAssured);
  const [plan, setPlan] = useState(initial.plan);
  const [territory, setTerritory] = useState(initial.territory);
  const [coverage, setCoverage] = useState(initial.coverage);
  const [mode, setMode] = useState<PayMode>(initial.mode);

  const baseOption = table.bases.find((b) => b.variant === base)!;
  const planOptions = plansFor(table, age);
  const territoryOptions = territoriesFor(table, plan, age);
  const coverageOptions = coveragesFor(table, territory, age);

  /**
   * A choice that was legal a moment ago can stop being legal when the age or the plan
   * changes — โกลด์ in เอเชีย, or ซิลเวอร์ for an eight-year-old. Falling back to the first
   * option the company does sell keeps the card priced instead of blank.
   */
  useEffect(() => {
    if (!planOptions.some((p) => p.code === plan)) setPlan(planOptions[0].code);
  }, [planOptions, plan]);
  useEffect(() => {
    if (!territoryOptions.includes(territory)) setTerritory(territoryOptions[0]);
  }, [territoryOptions, territory]);
  useEffect(() => {
    if (!coverageOptions.includes(coverage)) setCoverage(coverageOptions[0]);
  }, [coverageOptions, coverage]);
  useEffect(() => {
    if (baseOption.fixedSum !== undefined) setSumAssured(baseOption.fixedSum);
  }, [baseOption]);

  const choice = { base, sex, age, sumAssured, plan, territory, coverage };
  const priced = iHealthyPricing(table, choice);
  const at = (ms: { mode: PayMode; total: number }[] | undefined) => ms?.find((m) => m.mode === mode);
  const death = deathBenefitOf(table, base, age, sumAssured);
  const planOption = table.plans.find((p) => p.code === plan)!;

  const label = "block text-sm text-[var(--lg-mute)]";
  const field =
    "mt-1.5 w-full appearance-none rounded-sm border border-[var(--lg-panel-line)] bg-[var(--lg-raise)] px-3 py-2.5 text-base text-[var(--lg-white)]";
  const chip = (on: boolean) =>
    `rounded-sm border px-2 py-2.5 text-center text-sm transition-colors ${
      on ? "lg-metal-face border-[var(--lg-gold)] font-medium" : "border-[var(--lg-panel-line)] text-[var(--lg-mute)]"
    }`;

  return (
    <div className="space-y-6">
      <div className="space-y-5 rounded-sm border border-[var(--lg-hair)] bg-[var(--lg-panel)] p-5 print:hidden">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="ihu-age" className={label}>อายุ</label>
            <select id="ihu-age" className={field} value={age} onChange={(e) => setAge(Number(e.target.value))}>
              {AGES.map((a) => <option key={a} value={a}>{a} ปี</option>)}
            </select>
          </div>
          <div>
            <span className={label}>เพศ</span>
            <div className="mt-1.5 grid grid-cols-2 gap-2">
              {(["M", "F"] as Sex[]).map((s) => (
                <button key={s} type="button" aria-pressed={sex === s} onClick={() => setSex(s)} className={chip(sex === s)}>
                  {s === "M" ? "ชาย" : "หญิง"}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div>
          <span className={label}>สัญญาหลัก</span>
          <div className="mt-1.5 grid grid-cols-3 gap-2">
            {table.bases.map((b) => (
              <button key={b.variant} type="button" aria-pressed={b.variant === base} onClick={() => setBase(b.variant)} className={chip(b.variant === base)}>
                <span className="block">{b.short}</span>
                <span className="mt-0.5 block text-xs opacity-80">{b.note}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="ihu-sum" className={label}>ทุนสัญญาหลัก</label>
          {baseOption.fixedSum !== undefined ? (
            <p className="mt-1.5 rounded-sm border border-[var(--lg-panel-line)] bg-[var(--lg-raise)] px-3 py-2.5 text-base tabular-nums text-[var(--lg-mute)]">
              {baseOption.fixedSum.toLocaleString("en-US")} บาท · แพ็กเกจกำหนดไว้ เปลี่ยนไม่ได้
            </p>
          ) : (
            <select id="ihu-sum" className={field} value={sumAssured} onChange={(e) => setSumAssured(Number(e.target.value))}>
              {SUMS.map((s) => <option key={s} value={s}>{s.toLocaleString("en-US")} บาท</option>)}
            </select>
          )}
        </div>

        <div>
          <span className={label}>แผนสุขภาพ</span>
          <div className="mt-1.5 grid grid-cols-3 gap-2">
            {planOptions.map((p) => (
              <button key={p.code} type="button" aria-pressed={p.code === plan} onClick={() => setPlan(p.code)} className={chip(p.code === plan)}>
                <span className="block">{p.name}</span>
                <span className="mt-0.5 block text-xs tabular-nums opacity-80">
                  {(p.annualMax / 1_000_000).toLocaleString("en-US")} ล้าน
                </span>
              </button>
            ))}
          </div>
          {planOptions.length < table.plans.length && (
            <p className="mt-2 text-xs leading-relaxed text-[var(--lg-mute)]">
              อายุต่ำกว่า {table.juvenileBelowAge} ปี บริษัทขายเฉพาะแผน
              {planOptions.map((p) => p.name).join(" และ ")}
            </p>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label htmlFor="ihu-area" className={label}>อาณาเขต</label>
            <select id="ihu-area" className={field} value={territory} onChange={(e) => setTerritory(e.target.value)}>
              {territoryOptions.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            {territoryOptions.length === 1 && (
              <p className="mt-1 text-xs text-[var(--lg-mute)]">แผน{planOption.name}มีเฉพาะในประเทศไทย</p>
            )}
          </div>
          <div>
            <label htmlFor="ihu-cover" className={label}>ความคุ้มครอง</label>
            <select id="ihu-cover" className={field} value={coverage} onChange={(e) => setCoverage(e.target.value)}>
              {coverageOptions.map((c) => <option key={c} value={c}>{COVERAGE_LABEL[c] ?? c}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="ihu-mode" className={label}>งวดชำระ</label>
            <select id="ihu-mode" className={field} value={mode} onChange={(e) => setMode(e.target.value as PayMode)}>
              {MODES.map((m) => <option key={m} value={m}>{PAY_MODE_LABEL[m]}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="space-y-4 rounded-sm border border-[var(--lg-hair)] bg-[var(--lg-raise)] p-5">
        {table.expired || !priced ? (
          <p className="text-sm font-medium text-[var(--lg-gold)]">ขอราคาปัจจุบันได้ทางแชทด้านล่าง</p>
        ) : (
          <>
            <dl className="space-y-2 text-sm">
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-[var(--lg-mute)]">
                  {baseOption.label} ทุน {sumAssured.toLocaleString("en-US")}
                </dt>
                <dd className="lg-figure tabular-nums text-[var(--lg-white)]">{formatBaht(at(priced.base)!.total)}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-[var(--lg-mute)]">ไอเฮลท์ตี้ อัลตร้า แผน{planOption.name}</dt>
                <dd className="lg-figure tabular-nums text-[var(--lg-white)]">{formatBaht(at(priced.rider)!.total)}</dd>
              </div>
            </dl>
            <div className="border-t border-[var(--lg-panel-line)] pt-4">
              <div className="text-sm text-[var(--lg-mute)]">เบี้ยรวม {PAY_MODE_LABEL[mode]}</div>
              <div className="lg-figure mt-1 text-[2.4rem] leading-none tabular-nums">
                <span className="lg-metal-text">{formatBaht(at(priced.total)!.total)}</span>
                <span className="ml-2 text-base text-[var(--lg-mute)]">บาท</span>
              </div>
              {at(priced.total)!.belowMinimum && (
                <p className="mt-2 text-xs text-[var(--lg-gold)]">
                  ต่ำกว่าเบี้ยรายเดือนขั้นต่ำ {table.minMonthly.toLocaleString("en-US")} บาท ที่บริษัทรับชำระ
                </p>
              )}
              <p className="mt-2 text-xs leading-relaxed text-[var(--lg-mute)]">
                {MODES.filter((m) => m !== mode)
                  .map((m) => `${PAY_MODE_LABEL[m]} ${formatBaht(priced.total.find((x) => x.mode === m)!.total)}`)
                  .join(" · ")}
              </p>
            </div>
            <div className="border-t border-[var(--lg-panel-line)] pt-4 text-sm text-[var(--lg-mute)]">
              <p>
                วงเงินค่ารักษาต่อปี{" "}
                <span className="lg-figure tabular-nums text-[var(--lg-white)]">
                  {planOption.annualMax.toLocaleString("en-US")}
                </span>{" "}
                บาท
                {coverage === "Deductible" && ` · รับผิดส่วนแรก ${planOption.deductible.toLocaleString("en-US")} บาทต่อปี`}
                {coverage === "Co-Payment" && ` · ร่วมจ่าย ${facts.copayPercent} เปอร์เซ็นต์ของค่าใช้จ่ายที่คุ้มครอง`}
              </p>
              <p className="mt-1">
                เสียชีวิตก่อนอายุ {death.beforeAge} ครอบครัวได้{" "}
                <span className="lg-figure tabular-nums text-[var(--lg-white)]">
                  {death.sumBefore.toLocaleString("en-US")}
                </span>{" "}
                บาท
              </p>
              <p className="mt-1 opacity-80">
                เบี้ยปีแรก ปีต่อไปคิดตามอายุที่เพิ่มขึ้น
              </p>
            </div>
          </>
        )}
      </div>

      <BenefitTable facts={facts} selected={plan} age={age} />
    </div>
  );
}
```

- [ ] **Step 4: Write the route**

Create `src/app/ihealthy/layout.tsx`:

```tsx
import { SalesTheme } from "@/components/sales/SalesTheme";

export default function IHealthyLayout({ children }: { children: React.ReactNode }) {
  return <SalesTheme>{children}</SalesTheme>;
}
```

Create `src/app/ihealthy/page.tsx`:

```tsx
import { IHealthyCalculator } from "@/components/IHealthyCalculator";
import { iHealthyTable } from "@/lib/ihealthy-table";
import { iHealthyFacts } from "@/lib/ihealthy-facts";
import { Disclaimer, Hero, TermsSection } from "@/components/ihealthy/Sections";

export const metadata = {
  title: "ไอเฮลท์ตี้ อัลตร้า — ค่ารักษาพยาบาลเหมาจ่ายถึง 100 ล้านต่อปี",
  description:
    "ประกันสุขภาพเหมาจ่าย 6 แผน วงเงิน 3 ถึง 100 ล้านบาทต่อปี ต่ออายุได้ถึงอายุ 98 ปี เทียบผลประโยชน์ครบ 28 หมวด และคำนวณเบี้ยของคุณเองได้ทันที",
};

/**
 * What it pays, what it costs, and what the contract will not do — in that order, because a
 * health rider is bought on its ceiling and kept or dropped on its exclusions.
 */
export default async function IHealthyPage() {
  const table = iHealthyTable();
  const facts = iHealthyFacts();
  const initial = {
    age: 35, sex: "F" as const, base: "WLF99H", sumAssured: 1_000_000,
    plan: "GOLD", territory: "ประเทศไทย", coverage: "Full Coverage", mode: "annual" as const,
  };
  return (
    <main className="mx-auto max-w-lg px-4 pb-28 sm:max-w-2xl sm:pb-10">
      <Hero facts={facts} />
      <section id="calc" className="scroll-mt-4">
        <IHealthyCalculator table={table} facts={facts} initial={initial} />
      </section>
      <TermsSection facts={facts} />
      <Disclaimer facts={facts} rateVersion={table.rateVersion} />
    </main>
  );
}
```

- [ ] **Step 5: Check it builds and renders**

Run: `npx tsc --noEmit`
Expected: no errors.

Start the dev server through the Browser pane (`preview_start`, never `npm run dev` in Bash),
open `/ihealthy`, and confirm: the premium panel shows three lines, switching to อายุ 8 leaves
two plan buttons, switching to แพลทินั่ม opens three territories, switching to เอเชีย leaves
one coverage option, and switching to แพ็กเกจสุขภาพ locks the sum at 50,000.

- [ ] **Step 6: Commit**

```bash
git add src/lib/ihealthy-choice.ts src/components/IHealthyCalculator.tsx src/components/ihealthy/Sections.tsx src/app/ihealthy
git commit -m "feat(ihealthy): the page, the form and the premium panel"
```

---

## Task 7: The rider fold and its server action

**Files:**
- Create: `src/app/ihealthy/actions.ts`
- Create: `src/components/ihealthy/RiderPanel.tsx`
- Modify: `src/components/IHealthyCalculator.tsx`
- Test: `tests/calc/ihealthy-riders.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/calc/ihealthy-riders.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { priceWithRiders } from "@/app/ihealthy/actions";

describe("priceWithRiders", () => {
  it("lists what an adult may attach to the x 2 base", async () => {
    const r = await priceWithRiders({
      base: "WLF99H", age: 35, sex: "F", sumAssured: 1_000_000, mode: "annual",
      plan: "GOLD", territory: "ประเทศไทย", coverage: "Full Coverage", riders: [],
    });
    const codes = r.available.map((a) => a.code);
    expect(codes).toContain("AP");
    expect(codes).toContain("DCI");
    expect(codes).not.toContain("IHU");
  });

  it("drops the riders the health package refuses", async () => {
    const r = await priceWithRiders({
      base: "WLF99HX", age: 35, sex: "F", sumAssured: 50_000, mode: "annual",
      plan: "BRONZE", territory: "ประเทศไทย", coverage: "Full Coverage", riders: [],
    });
    const codes = r.available.map((a) => a.code);
    expect(codes).toEqual(["AP", "MEX", "MEB", "DCI", "RRSS"]);
  });

  it("greys the four riders a child is too young for", async () => {
    const r = await priceWithRiders({
      base: "WLF99HX", age: 8, sex: "M", sumAssured: 50_000, mode: "annual",
      plan: "BRONZE", territory: "ประเทศไทย", coverage: "Full Coverage", riders: [],
    });
    expect(r.available.map((a) => a.code)).toEqual(["AP", "MEX", "MEB", "RRSS"]);
  });

  it("prices an attached rider on top of the base and the health plan", async () => {
    const bare = await priceWithRiders({
      base: "WLF99H", age: 35, sex: "F", sumAssured: 1_000_000, mode: "annual",
      plan: "GOLD", territory: "ประเทศไทย", coverage: "Full Coverage", riders: [],
    });
    const withAp = await priceWithRiders({
      base: "WLF99H", age: 35, sex: "F", sumAssured: 1_000_000, mode: "annual",
      plan: "GOLD", territory: "ประเทศไทย", coverage: "Full Coverage",
      riders: [{ code: "AP", sumAssured: 1_000_000 }],
    });
    expect(withAp.totalModal).toBeGreaterThan(bare.totalModal);
    expect(withAp.items.find((i) => i.code === "AP")!.eligible).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/calc/ihealthy-riders.test.ts`
Expected: FAIL — `Failed to resolve import "@/app/ihealthy/actions"`

- [ ] **Step 3: Write the action**

Create `src/app/ihealthy/actions.ts`:

```ts
"use server";
import { quote } from "@/calc/quote";
import { getPlan } from "@/calc/plans/registry";
import { disabledRiders, packageSeq, riderAvailability } from "@/calc/rules";
import type { PayMode, QuoteItem, Sex } from "@/calc/types";

const PLAN_CODE = "LIFEPROTECT";
/** The health rider is the page's whole subject; it is never one of the extras. */
const THE_HEALTH_RIDER = "IHU";

export interface AttachedRider {
  code: string;
  sumAssured?: number;
  plan?: number;
  option?: string;
}

export interface RiderQuoteInput {
  base: string;
  age: number;
  sex: Sex;
  sumAssured: number;
  mode: PayMode;
  plan: string;
  territory: string;
  coverage: string;
  riders: AttachedRider[];
}

export interface RiderChoice {
  code: string;
  name: string;
  ageRange: string;
  saMin?: number;
  saMax?: number;
  /** the fixed plan amounts this rider sells, when it sells plans rather than sums */
  plans?: number[];
  /** the named variants this rider sells */
  options?: { code: string; name: string }[];
  /** the package pins this rider's sum assured here */
  exactSumAssured?: number;
}

export interface RiderQuoteResult {
  available: RiderChoice[];
  items: QuoteItem[];
  /** the whole arrangement in this mode, in satang */
  totalModal: number;
  warnings: string[];
}

/**
 * The agent's half of the page. Everything the customer sees is priced in the browser from
 * a slim table; the moment another rider is attached the arrangement stops being slim, so it
 * is priced here by the engine itself — the same `quote()` the back-office calculator runs.
 */
export async function priceWithRiders(input: RiderQuoteInput): Promise<RiderQuoteResult> {
  const plan = getPlan(PLAN_CODE)!;
  const seq = packageSeq(input.base, plan.rates);
  const off = disabledRiders(plan.rules, seq);
  const ctx = { age: input.age, baseSumAssured: input.sumAssured };

  const available: RiderChoice[] = [];
  for (const code of plan.riderOrder) {
    if (code === THE_HEALTH_RIDER || off.has(code)) continue;
    const a = riderAvailability(plan.rules, plan.rates, code, ctx);
    if (!a.eligible) continue;
    const pinned = (plan.rules.packages ?? [])
      .find((p) => seq !== undefined && p.seq.includes(seq))?.exactSumAssured?.[code];
    available.push({
      code, name: a.name, ageRange: a.ageRange, saMin: a.saMin, saMax: a.saMax,
      plans: a.plans, options: a.options, exactSumAssured: pinned,
    });
  }

  const result = quote({
    planCode: PLAN_CODE, variant: input.base, age: input.age, sex: input.sex, mode: input.mode,
    basis: "sumAssured", sumAssured: input.sumAssured,
    payer: { age: input.age, sex: input.sex },
    riders: [
      { code: THE_HEALTH_RIDER, option: input.plan, territory: input.territory, coverage: input.coverage },
      ...input.riders,
    ],
  });

  return {
    available,
    items: result.items,
    totalModal: result.totalModal,
    warnings: result.warnings.map((w) => w.message),
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/calc/ihealthy-riders.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Write the fold**

Create `src/components/ihealthy/RiderPanel.tsx`:

```tsx
"use client";
import { useEffect, useState, useTransition } from "react";
import { formatBaht } from "@/calc/money";
import { priceWithRiders, type RiderChoice, type RiderQuoteInput, type RiderQuoteResult } from "@/app/ihealthy/actions";

export interface RiderPanelProps {
  /** everything the action needs except the attached riders themselves */
  request: Omit<RiderQuoteInput, "riders">;
}

/**
 * The agent's fold. It asks the server for nothing until it is opened, so a customer who
 * never touches it never pays for the round trip — and never downloads the rate tables the
 * payor riders would need to price in the browser.
 */
export function RiderPanel({ request }: RiderPanelProps) {
  const [open, setOpen] = useState(false);
  const [chosen, setChosen] = useState<Record<string, number | "">>({});
  const [result, setResult] = useState<RiderQuoteResult | undefined>();
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!open) return;
    const riders = Object.entries(chosen).map(([code, value]) => ({
      code, ...(value === "" ? {} : { sumAssured: value }),
    }));
    start(async () => setResult(await priceWithRiders({ ...request, riders })));
  }, [open, chosen, request]);

  const toggle = (c: RiderChoice) =>
    setChosen((prev) => {
      const next = { ...prev };
      if (c.code in next) delete next[c.code];
      else next[c.code] = c.exactSumAssured ?? c.saMin ?? "";
      return next;
    });

  return (
    <details
      className="rounded-sm border border-[var(--lg-hair)] bg-[var(--lg-panel)] print:hidden"
      onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-sm font-medium text-[var(--lg-white)]">
        แนบสัญญาเพิ่มเติมอื่น
        <span aria-hidden className="text-lg leading-none text-[var(--lg-gold)]">+</span>
      </summary>
      <div className="space-y-3 border-t border-[var(--lg-panel-line)] px-5 py-4">
        {!result ? (
          <p className="text-sm text-[var(--lg-mute)]">กำลังคิดเบี้ย</p>
        ) : (
          <>
            {result.available.map((c) => {
              const on = c.code in chosen;
              return (
                <div key={c.code} className="flex flex-wrap items-center gap-3">
                  <label className="flex flex-1 items-center gap-2.5 text-sm text-[var(--lg-white)]">
                    <input type="checkbox" checked={on} onChange={() => toggle(c)} className="h-4 w-4 accent-[var(--lg-gold)]" />
                    {c.name}
                    <span className="text-xs text-[var(--lg-mute)]">{c.ageRange}</span>
                  </label>
                  {on && c.exactSumAssured === undefined && c.saMin !== undefined && (
                    <input
                      type="number" inputMode="numeric" value={chosen[c.code]} min={c.saMin} max={c.saMax}
                      onChange={(e) => setChosen((p) => ({ ...p, [c.code]: e.target.value === "" ? "" : Number(e.target.value) }))}
                      className="w-36 rounded-sm border border-[var(--lg-panel-line)] bg-[var(--lg-raise)] px-2 py-1.5 text-sm tabular-nums text-[var(--lg-white)]"
                    />
                  )}
                  {on && c.exactSumAssured !== undefined && (
                    <span className="text-xs text-[var(--lg-mute)]">
                      ทุน {c.exactSumAssured.toLocaleString("en-US")} บาทเท่านั้น
                    </span>
                  )}
                </div>
              );
            })}
            <dl className="space-y-1.5 border-t border-[var(--lg-panel-line)] pt-3 text-sm">
              {result.items.map((i) => (
                <div key={i.code} className="flex items-baseline justify-between gap-3">
                  <dt className="text-[var(--lg-mute)]">{i.name}</dt>
                  <dd className={`lg-figure tabular-nums ${i.eligible ? "text-[var(--lg-white)]" : "text-[var(--lg-gold)]"}`}>
                    {i.eligible ? formatBaht(i.modal) : i.message}
                  </dd>
                </div>
              ))}
              <div className="flex items-baseline justify-between gap-3 border-t border-[var(--lg-panel-line)] pt-2 font-medium">
                <dt className="text-[var(--lg-white)]">รวมทั้งหมด</dt>
                <dd className="lg-figure tabular-nums text-[var(--lg-white)]">{formatBaht(result.totalModal)}</dd>
              </div>
            </dl>
            {result.warnings.map((w) => (
              <p key={w} className="text-xs text-[var(--lg-gold)]">{w}</p>
            ))}
            {pending && <p className="text-xs text-[var(--lg-mute)]">กำลังคิดเบี้ยใหม่</p>}
          </>
        )}
      </div>
    </details>
  );
}
```

- [ ] **Step 6: Drop it into the calculator**

In `src/components/IHealthyCalculator.tsx`, add the import beside the others:

```tsx
import { RiderPanel } from "@/components/ihealthy/RiderPanel";
```

and place the panel between the premium card and the benefit table, replacing the line
`      <BenefitTable facts={facts} selected={plan} age={age} />` with:

```tsx
      <RiderPanel request={{ base, age, sex, sumAssured, mode, plan, territory, coverage }} />

      <BenefitTable facts={facts} selected={plan} age={age} />
```

- [ ] **Step 7: Check it works in the browser**

Open `/ihealthy` in the Browser pane, open the fold, tick อุบัติเหตุ, and confirm the total
grows and the row appears. With แพ็กเกจสุขภาพ selected the list is five rows; at อายุ 8 it is
four.

- [ ] **Step 8: Commit**

```bash
git add src/app/ihealthy/actions.ts src/components/ihealthy/RiderPanel.tsx src/components/IHealthyCalculator.tsx tests/calc/ihealthy-riders.test.ts
git commit -m "feat(ihealthy): attach other riders through the real engine"
```

---

## Task 8: The chat message and the copy-to-clipboard summary

**Files:**
- Create: `src/lib/ihealthy-cta.ts`
- Modify: `src/components/IHealthyCalculator.tsx`
- Test: `tests/calc/ihealthy-cta.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/calc/ihealthy-cta.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { iHealthyMessage, iHealthyQuoteText } from "@/lib/ihealthy-cta";

const facts = {
  planName: "โกลด์", annualMax: 25_000_000, baseLabel: "ไลฟ์ โพรเทค+ x 2",
  sumAssured: 1_000_000, age: 35, sex: "F" as const,
  territory: "ประเทศไทย", coverage: "Full Coverage",
  basePremium: 213_000, riderPremium: 4_380_000, total: 4_593_000, mode: "annual" as const,
};

describe("iHealthyMessage", () => {
  it("opens the chat with what is on screen", () => {
    expect(iHealthyMessage(facts)).toBe(
      "สนใจประกันสุขภาพ ไอเฮลท์ตี้ อัลตร้า แผนโกลด์ ประเทศไทย หญิง 35 ปี เบี้ยรวมประมาณ 45,930 บาท/ปี",
    );
  });

  it("asks for a price instead when none is being shown", () => {
    expect(iHealthyMessage({ ...facts, total: undefined })).toBe(
      "สนใจประกันสุขภาพ ไอเฮลท์ตี้ อัลตร้า แผนโกลด์ ประเทศไทย หญิง 35 ปี ขอราคาปัจจุบัน",
    );
  });
});

describe("iHealthyQuoteText", () => {
  it("writes the summary an agent pastes into a chat", () => {
    const text = iHealthyQuoteText(facts);
    expect(text).toContain("ไอเฮลท์ตี้ อัลตร้า แผนโกลด์");
    expect(text).toContain("วงเงินค่ารักษา 25,000,000 บาทต่อปี");
    expect(text).toContain("ไลฟ์ โพรเทค+ x 2 ทุน 1,000,000 บาท · 2,130 บาท");
    expect(text).toContain("ค่ารักษาพยาบาล · 43,800 บาท");
    expect(text).toContain("รวม 45,930 บาท/ปี");
    expect(text).toContain("เบี้ยปีแรก");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/calc/ihealthy-cta.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/ihealthy-cta"`

- [ ] **Step 3: Write the module**

Create `src/lib/ihealthy-cta.ts`:

```ts
import { formatBaht } from "@/calc/money";
import type { PayMode, Sex } from "@/calc/types";
import { PER } from "@/lib/legacy-cta";

const SEX_WORD: Record<Sex, string> = { M: "ชาย", F: "หญิง" };
const COVERAGE_WORD: Record<string, string> = {
  "Full Coverage": "",
  Deductible: "แบบมีความรับผิดส่วนแรก",
  "Co-Payment": "แบบร่วมจ่าย",
};

export interface IHealthyCtaFacts {
  planName: string;
  annualMax: number;
  baseLabel: string;
  sumAssured: number;
  age: number;
  sex: Sex;
  territory: string;
  coverage: string;
  /** satang; undefined when no price may be shown */
  basePremium?: number;
  riderPremium?: number;
  total?: number;
  mode: PayMode;
}

function who(f: IHealthyCtaFacts): string {
  const cover = COVERAGE_WORD[f.coverage];
  return `แผน${f.planName} ${f.territory}${cover ? ` ${cover}` : ""} ${SEX_WORD[f.sex]} ${f.age} ปี`;
}

/** What the customer's chat opens with, so whoever answers starts from the figures on screen. */
export function iHealthyMessage(f: IHealthyCtaFacts): string {
  const head = `สนใจประกันสุขภาพ ไอเฮลท์ตี้ อัลตร้า ${who(f)}`;
  if (f.total === undefined) return `${head} ขอราคาปัจจุบัน`;
  return `${head} เบี้ยรวมประมาณ ${formatBaht(f.total)} บาท${PER[f.mode]}`;
}

/**
 * The quote as text, for the agent to paste into whichever chat the customer is already in.
 * It says no more than the card says, and it always ends on the sentence that stops a
 * first-year premium being mistaken for a level one.
 */
export function iHealthyQuoteText(f: IHealthyCtaFacts): string | undefined {
  if (f.total === undefined || f.basePremium === undefined || f.riderPremium === undefined) return undefined;
  return [
    `ไอเฮลท์ตี้ อัลตร้า ${who(f)}`,
    `วงเงินค่ารักษา ${f.annualMax.toLocaleString("en-US")} บาทต่อปี`,
    "",
    `${f.baseLabel} ทุน ${f.sumAssured.toLocaleString("en-US")} บาท · ${formatBaht(f.basePremium)} บาท`,
    `ค่ารักษาพยาบาล · ${formatBaht(f.riderPremium)} บาท`,
    `รวม ${formatBaht(f.total)} บาท${PER[f.mode]}`,
    "",
    "เบี้ยปีแรก ปีต่อไปคิดตามอายุที่เพิ่มขึ้น · เบี้ยอาชีพชั้น 1",
  ].join("\n");
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/calc/ihealthy-cta.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Wire the buttons into the calculator**

In `src/components/IHealthyCalculator.tsx`, add the imports:

```tsx
import { ContactButtons } from "@/components/sales/ContactButtons";
import { iHealthyMessage, iHealthyQuoteText } from "@/lib/ihealthy-cta";
```

Build the facts just after `const planOption = ...`:

```tsx
  const cta = {
    planName: planOption.name,
    annualMax: planOption.annualMax,
    baseLabel: baseOption.label,
    sumAssured, age, sex, territory, coverage, mode,
    basePremium: table.expired ? undefined : at(priced?.base)?.total,
    riderPremium: table.expired ? undefined : at(priced?.rider)?.total,
    total: table.expired ? undefined : at(priced?.total)?.total,
  };
```

and put the buttons after the benefit table, as the last child of the outer `div`:

```tsx
      <div className="print:hidden">
        <ContactButtons message={iHealthyMessage(cta)} copyText={iHealthyQuoteText(cta)} />
      </div>
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/ihealthy-cta.ts src/components/IHealthyCalculator.tsx tests/calc/ihealthy-cta.test.ts
git commit -m "feat(ihealthy): hand the quote to the customer as chat text"
```

---

## Task 9: A link that carries the whole arrangement

**Files:**
- Create: `src/lib/ihealthy-link.ts`
- Modify: `src/app/ihealthy/page.tsx`
- Modify: `src/components/IHealthyCalculator.tsx`
- Test: `tests/calc/ihealthy-link.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/calc/ihealthy-link.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { iHealthyTable } from "@/lib/ihealthy-table";
import { initialFrom, queryFrom } from "@/lib/ihealthy-link";

const table = iHealthyTable(new Date("2026-09-12"));

describe("initialFrom", () => {
  it("falls back to the page's own opening arrangement", () => {
    expect(initialFrom(table, {})).toEqual({
      age: 35, sex: "F", base: "WLF99H", sumAssured: 1_000_000,
      plan: "GOLD", territory: "ประเทศไทย", coverage: "Full Coverage", mode: "annual",
    });
  });

  it("reads a shared link back", () => {
    expect(initialFrom(table, {
      age: "8", sex: "M", base: "WLF99HX", sa: "50000",
      plan: "BRONZE", area: "ประเทศไทย", cover: "Full Coverage", mode: "monthly",
    })).toMatchObject({ age: 8, sex: "M", base: "WLF99HX", plan: "BRONZE", mode: "monthly" });
  });

  it("refuses an arrangement the company does not sell", () => {
    const parsed = initialFrom(table, { age: "8", plan: "PLATINUM", area: "ทั่วโลก" });
    expect(parsed.plan).toBe("SMART");
    expect(parsed.territory).toBe("ประเทศไทย");
  });

  it("clamps an age outside the rider's range and pins the package's sum", () => {
    expect(initialFrom(table, { age: "3" }).age).toBe(6);
    expect(initialFrom(table, { age: "99" }).age).toBe(80);
    expect(initialFrom(table, { base: "WLF99HX", sa: "900000" }).sumAssured).toBe(50_000);
  });
});

describe("queryFrom", () => {
  it("writes every choice back out", () => {
    const initial = initialFrom(table, {});
    expect(queryFrom(initial)).toBe(
      "age=35&sex=F&base=WLF99H&sa=1000000&plan=GOLD&area=" + encodeURIComponent("ประเทศไทย")
      + "&cover=" + encodeURIComponent("Full Coverage") + "&mode=annual",
    );
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/calc/ihealthy-link.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/ihealthy-link"`

- [ ] **Step 3: Write the module**

Create `src/lib/ihealthy-link.ts`:

```ts
import type { PayMode, Sex } from "@/calc/types";
import type { IHealthyTable } from "@/lib/ihealthy-table";
import { coveragesFor, plansFor, territoriesFor } from "@/lib/ihealthy-quote";
import type { IHealthyInitial } from "@/lib/ihealthy-choice";

/**
 * The arrangement the page opens on when the link says nothing: a woman of 35 on โกลด์, the
 * plan an agent quotes most and the one whose benefit column is worth landing on.
 */
const DEFAULTS: IHealthyInitial = {
  age: 35, sex: "F", base: "WLF99H", sumAssured: 1_000_000,
  plan: "GOLD", territory: "ประเทศไทย", coverage: "Full Coverage", mode: "annual",
};

const MODES: PayMode[] = ["annual", "semi", "monthly"];
const SUMS = [150_000, 300_000, 500_000, 1_000_000, 2_000_000, 3_000_000, 5_000_000];

type Query = Record<string, string | string[] | undefined>;

function one(q: Query, key: string): string | undefined {
  const v = q[key];
  return Array.isArray(v) ? v[0] : v;
}

/**
 * A link is written by whoever holds it, so every value is checked against what the company
 * sells before it reaches the calculator. An arrangement that does not exist falls back to
 * the nearest one that does rather than rendering a page with no price on it.
 */
export function initialFrom(table: IHealthyTable, query: Query): IHealthyInitial {
  const num = (key: string, fallback: number) => {
    const n = Number(one(query, key));
    return Number.isFinite(n) ? n : fallback;
  };

  const age = Math.min(table.ageMax, Math.max(table.ageMin, Math.round(num("age", DEFAULTS.age))));
  const sex: Sex = one(query, "sex") === "M" ? "M" : one(query, "sex") === "F" ? "F" : DEFAULTS.sex;
  const base = table.bases.some((b) => b.variant === one(query, "base"))
    ? one(query, "base")!
    : DEFAULTS.base;
  const baseOption = table.bases.find((b) => b.variant === base)!;

  const wantedSum = num("sa", DEFAULTS.sumAssured);
  const sumAssured = baseOption.fixedSum
    ?? (SUMS.includes(wantedSum) ? wantedSum : DEFAULTS.sumAssured);

  // the link's plan when the company still sells it at this age, else the page's own
  // default, else whatever is left — for a child that is สมาร์ท
  const plans = plansFor(table, age);
  const preferred = one(query, "plan") ?? DEFAULTS.plan;
  const plan = plans.some((p) => p.code === preferred) ? preferred : plans[0].code;

  const territories = territoriesFor(table, plan, age);
  const wantedArea = one(query, "area");
  const territory = wantedArea && territories.includes(wantedArea) ? wantedArea : territories[0];

  const coverages = coveragesFor(table, territory, age);
  const wantedCover = one(query, "cover");
  const coverage = wantedCover && coverages.includes(wantedCover) ? wantedCover : coverages[0];

  const wantedMode = one(query, "mode") as PayMode | undefined;
  const mode = wantedMode && MODES.includes(wantedMode) ? wantedMode : DEFAULTS.mode;

  return { age, sex, base, sumAssured, plan, territory, coverage, mode };
}

/** The same arrangement as a query string, for the address bar and the share button. */
export function queryFrom(v: IHealthyInitial): string {
  return new URLSearchParams({
    age: String(v.age), sex: v.sex, base: v.base, sa: String(v.sumAssured),
    plan: v.plan, area: v.territory, cover: v.coverage, mode: v.mode,
  }).toString();
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/calc/ihealthy-link.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Read the query string on the server**

In `src/app/ihealthy/page.tsx`, replace the hard-coded `initial` with the parsed one. The
whole component becomes:

```tsx
export default async function IHealthyPage(
  { searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> },
) {
  const table = iHealthyTable();
  const facts = iHealthyFacts();
  const initial = initialFrom(table, await searchParams);
  return (
    <main className="mx-auto max-w-lg px-4 pb-28 sm:max-w-2xl sm:pb-10">
      <Hero facts={facts} />
      <section id="calc" className="scroll-mt-4">
        <IHealthyCalculator table={table} facts={facts} initial={initial} />
      </section>
      <TermsSection facts={facts} />
      <Disclaimer facts={facts} rateVersion={table.rateVersion} />
    </main>
  );
}
```

and add the import:

```tsx
import { initialFrom } from "@/lib/ihealthy-link";
```

- [ ] **Step 6: Keep the address bar in step**

In `src/components/IHealthyCalculator.tsx`, add the import:

```tsx
import { queryFrom } from "@/lib/ihealthy-link";
```

and, after the fallback effects, add:

```tsx
  /**
   * The address bar follows the card, so the link an agent copies is the arrangement the
   * customer is looking at. replaceState rather than push: a back button that walked
   * through every dropdown change would be useless.
   */
  useEffect(() => {
    const query = queryFrom({ age, sex, base, sumAssured, plan, territory, coverage, mode });
    window.history.replaceState(null, "", `?${query}`);
  }, [age, sex, base, sumAssured, plan, territory, coverage, mode]);
```

- [ ] **Step 7: Check a shared link opens the same page**

Open `/ihealthy` in the Browser pane, change the plan and the age, copy the address, open it
in a new tab, and confirm the card comes back identical.

- [ ] **Step 8: Commit**

```bash
git add src/lib/ihealthy-link.ts src/app/ihealthy/page.tsx src/components/IHealthyCalculator.tsx tests/calc/ihealthy-link.test.ts
git commit -m "feat(ihealthy): carry the whole arrangement in the link"
```

---

## Task 10: Print and PDF

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/components/IHealthyCalculator.tsx`

The sales theme is dark. Printed as it stands it is a page of black ink, so the print rules
lift the theme back to paper and drop the controls, which have already been marked
`print:hidden` in the tasks above.

- [ ] **Step 1: Add the print rules**

Append to `src/app/globals.css`:

```css
@media print {
  .theme-legacy {
    --lg-ground: #ffffff;
    --lg-panel: #ffffff;
    --lg-raise: #ffffff;
    --lg-white: #111111;
    --lg-mute: #444444;
    --lg-gold: #7a5c14;
    --lg-hair: #cccccc;
    --lg-panel-line: #dddddd;
    background: #ffffff;
  }
  .theme-legacy main {
    max-width: none;
    padding: 0;
  }
  /* the benefit table is the point of printing, so it must not be cut off at the fold */
  .theme-legacy table {
    font-size: 9px;
  }
  .theme-legacy .overflow-x-auto {
    overflow: visible !important;
  }
  .theme-legacy details {
    display: none;
  }
}
```

- [ ] **Step 2: Add the print button and the printed heading**

In `src/components/IHealthyCalculator.tsx`, put this directly above the `<ContactButtons>`
block added in Task 8:

```tsx
      <button
        type="button" onClick={() => window.print()}
        className="w-full rounded-sm border border-[var(--lg-panel-line)] px-5 py-3 text-sm text-[var(--lg-mute)] print:hidden"
      >
        พิมพ์ หรือบันทึกเป็น PDF
      </button>
```

and, as the first child of the outer `div`, a heading that only paper sees:

```tsx
      <div className="hidden print:block">
        <h2 className="text-lg font-medium">
          ไอเฮลท์ตี้ อัลตร้า แผน{planOption.name} · {territory}
        </h2>
        <p className="text-sm">
          {sex === "M" ? "ชาย" : "หญิง"} {age} ปี · {baseOption.label} ทุน{" "}
          {sumAssured.toLocaleString("en-US")} บาท
        </p>
      </div>
```

- [ ] **Step 3: Check the print preview**

In the Browser pane open `/ihealthy` and print to PDF. Confirm: white background, no form
controls, no rider fold, the premium summary and the full benefit table present.

- [ ] **Step 4: Commit**

```bash
git add src/app/globals.css src/components/IHealthyCalculator.tsx
git commit -m "feat(ihealthy): print the quote and the benefit table on paper"
```

---

## Task 11: Link the page and verify the whole thing

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Add it to the agent calculator's list of sales pages**

In `src/app/page.tsx`, add to the `SALES_PAGES` array:

```tsx
  { href: "/ihealthy", label: "ไอเฮลท์ตี้ อัลตร้า" },
```

- [ ] **Step 2: Run the whole verification**

Run: `rm -rf .next-build && npm run verify`
Expected: `tsc --noEmit` clean, lint clean, every test passing (the five new files add about
30 cases), and the production build succeeding.

- [ ] **Step 3: Check the page one last time in the browser**

Open `/ihealthy` and walk the four cases the spec names:

1. หญิง 35 · x 2 · โกลด์ · ประเทศไทย · เต็มจำนวน → base 2,130 + rider 43,800 = 45,930 a year
2. หญิง 45 · บรอนซ์ → the rider line reads 26,700, the workbook's own example
3. ชาย 8 · แพ็กเกจสุขภาพ · บรอนซ์ → 380 + 38,600 = 38,980, two plan buttons, four riders in the fold
4. หญิง 35 · แพลทินั่ม · ทั่วโลก → 563,500, and the coverage select collapses to เต็มจำนวน

- [ ] **Step 4: Commit and push**

```bash
git add src/app/page.tsx
git commit -m "feat(ihealthy): link the health page from the agent calculator"
git push origin HEAD:main
```

---

## Self-review notes

Checked against `docs/superpowers/specs/2026-09-12-ihealthy-ultra-page-design.md`:

- Three bases, WLF99HX#7 absent — Task 2 (`BASES`), enforced by its test.
- 28 categories across six plans, child columns — Tasks 1, 4, 5.
- Territory and coverage filtered rather than refused — Task 3 (`territoriesFor`,
  `coveragesFor`), used by the form in Task 6. `coveragesFor` takes `(table, territory,
  age)`: code review moved it off a hardcoded Thai label onto the rate table, the way its
  two neighbours already read it.
- Other riders through the real engine — Task 7.
- Link, print, copy — Tasks 8, 9, 10.
- Occupation class 1 note, rate version, disclaimer — Task 6 (`Disclaimer`).
- Waiting periods, no-claim discount, renewal co-payment, out-of-territory — Task 6
  (`TermsSection`), from the JSON extracted in Task 1.
- Parity with `quote()` — Task 3; benefit figures pinned to the workbook — Task 1.

Names used consistently across tasks: `iHealthyTable`, `iHealthyFacts`, `iHealthyPricing`,
`ihuKey`, `plansFor`, `territoriesFor`, `coveragesFor`, `benefitValue`, `isHeading`,
`priceWithRiders`, `initialFrom`, `queryFrom`, and `IHealthyInitial` from
`src/lib/ihealthy-choice.ts`, which both the component and the link module import.
