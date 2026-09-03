# Premium Calculator (Foundation + PLB) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Thai-language Next.js web app that quotes premiums for the Protection Life (PLB) plan and its riders (AP, ECARE, MEB), matching the company's Excel proposal to the satang, with a data pipeline and calc-engine structure that later plans (iShield, ไลฟ์เทรเชอร์, ไอสมาร์ท 80-6, Life Protect Plus) plug into.

**Architecture:** Three layers. (1) `scripts/extract_rates.py` reads the hidden rate sheets of the Excel file and writes `data/rates/plb.json`; hand-written `data/rules/plb.json` holds eligibility rules. (2) `src/calc/**` is pure TypeScript (no React) that turns a `QuoteInput` into a `QuoteResult`, doing all money math in integer satang. (3) `src/app/**` + `src/components/**` is a single-page Next.js UI that recomputes on every keystroke. Golden tests compare the engine against LibreOffice-recalculated copies of the Excel file.

**Tech Stack:** Next.js 15 (App Router) + TypeScript + Tailwind CSS, Vitest, Python 3.9 + openpyxl (already installed), LibreOffice headless (`soffice`) for golden generation.

**Spec:** `docs/superpowers/specs/2026-09-03-premium-calculator-design.md`

---

## Facts established from the Excel file (do not re-derive)

File: `ไฟล์คำนวน/Protection Life (PLB)_A2026-1_01042026.xlsx`

| Item | Location | Value |
|---|---|---|
| Version | `กรอกข้อมูล!E59` | `A2026-1` |
| Expiry | `กรอกข้อมูล!G58` | 2027-03-31 (datetime) |
| Effective text | `กรอกข้อมูล!E58` | `1 มกราคม 2569 ถึง 31 มีนาคม 2570` |
| Thai plan name | `กรอกข้อมูล!E61` | `โพรเทคชั่นไลฟ์` |
| Base variants | validation on `D19` | `PLB05, PLB10, PLB12, PLB15` |
| Age input | validation on `F7` | whole 20–59 |
| Sex input | `F8` | `ชาย` / `หญิง` |
| Pay mode input | `F9` list `F62:F64` | `รายปี`, `ราย 6 เดือน`, `รายเดือน` |
| Mode factors | `Cal!I2:J5` | รายปี 1, ราย 6 เดือน 0.52, รายเดือน 0.09 |
| Base SA input | validation on `G19` | whole ≥ 300000, no max |
| Base rate table | `Premium&Maturity!N1:V59` | header row 1 = `Age, PLB05M, PLB05F, PLB10M, PLB10F, PLB12M, PLB12F, PLB15M, PLB15F`; **sheet row number == age**; rates exist for ages 20–59 |
| Discount table | `Cal!A27:K31` | row 27 = variant headers (`20SS,25PG,25PL,PLB05,PLB10,PLB12,PLB15,10EC,12PL,PR60`), `A28:A31` = thresholds `350000, 500000, 700000, 1000000`, cells = discount per 1,000 |
| Base annual premium | `Cal!G13` | `ROUNDDOWN((rate - discount) * SA / 1000, 2)` |
| Base modal premium | `Cal!H13` | `ROUNDDOWN((rate - discount) * SA / 1000 * modeFactor, 2)` |
| AP rate table | `AP!A6:E67` | row 6 header = classes 1–4 in B–E; rows 7–67 = ages 0–60; rate per 1,000 |
| ECARE rate table | `ECARE!A6:E51` | rows 7–51 = ages 16–60; same shape as AP |
| AP/ECARE premium | `Cal!G17,H17` | annual `ROUNDDOWN(rate*SA/1000,2)`, modal `ROUNDDOWN(rate*SA/1000*modeFactor,2)` (modal from **unrounded** annual) |
| MEB table | `MEB!A6:G75` | row 6 header = plans `500,1000,2000,3000,4000,5000` in B–G; rows 7–75 = ages 6–74; value = fixed annual premium (0 = not offered) |
| MEB premium | `Cal!G21,H21` | annual = table value; modal `ROUNDDOWN(annual*modeFactor,2)` |
| Occupation class | `H23,H24` | always 1 in this app |
| Visible riders | rows not hidden in `กรอกข้อมูล` | **AP (row 23), ECARE (row 24), MEB (row 27)**. Rows for WP, WPD, WPDD, ELI, MEA+, PLS05 are hidden and `Cal` has no formulas for WP/ELI/PLS05 → not offered with PLB |
| AP rule | `F23` | age > 60 → cannot buy; max SA = `MIN(5*base, 10000000)` (age ≥ 16); min 100000 |
| ECARE rule | `E24,F24` | age < 16 or > 60 → cannot buy; min 100000; max `MIN(10000000, 5*base)` |
| AP+ECARE combined | `I23,I24` | if `AP_SA + ECARE_SA > MIN(5*base, 10000000)` both cells show `AP+ECARE เกิน 5 เท่าของสัญญาหลัก` and are excluded from the total |
| MEB rule | `E27,F27,D46:D52` | age < 6 or > 65 → cannot buy; allowed plans: age ≤ 10 → {500}; 11–15 → {500,1000}; ≥ 16 → all six; plan > max → `MEB เกินกว่าที่กำหนด`, excluded from total |
| Total | `I32` | `SUM(I19:I27)` of modal premiums (text cells ignored) |
| Monthly minimum | `J32,G36` | mode = รายเดือน and total < 1000 → `เบี้ยประกันภัยรายเดือนต่ำกว่า 1,000 บาท` |
| Excel input cells for golden | `กรอกข้อมูล` | `F7` age, `F8` sex, `F9` mode, `D19` variant, `G19` base SA, `G23` AP SA, `G24` ECARE SA, `G27` MEB plan (`ไม่ซื้อ` or number) |
| Excel output cells for golden | `กรอกข้อมูล` | `I19` base modal, `I23` AP modal, `I24` ECARE modal, `I27` MEB modal, `I32` total modal; `Cal!G13,G17,G18,G21` annual premiums |

**Open questions for the user (answer before Task 8, do not block earlier tasks):**
1. PLB in this file offers only AP, ECARE, MEB. Confirm that WP / ELI / PLS05 / MEA+ are indeed not sold with PLB.
2. Thai display names for AP, ECARE, MEB (defaults below are taken from the Excel sheet titles).

---

## File structure

```
package.json, tsconfig.json, next.config.ts, postcss.config.mjs, vitest.config.ts, .gitignore
scripts/
  extract_rates.py          # Excel → data/rates/plb.json (deterministic)
  make_golden.py            # cases → LibreOffice recalc → tests/golden/plb.json
data/
  rates/plb.json            # generated, committed
  rules/plb.json            # hand-written eligibility rules, user-reviewed
src/calc/
  types.ts                  # QuoteInput / QuoteResult / rate & rule file types
  money.ts                  # satang helpers, floorDiv, formatting
  lookup.ts                 # safe table access returning undefined
  discount.ts               # tiered discount per 1,000
  base-premium.ts           # base plan premium
  riders/rate-per-thousand.ts   # AP + ECARE (shared shape)
  riders/fixed-by-plan.ts       # MEB
  rules.ts                  # availability + warnings from data/rules
  quote.ts                  # integrator: QuoteInput → QuoteResult
  plans/registry.ts         # plan list + loaders
src/app/
  layout.tsx, page.tsx, globals.css
src/components/
  QuoteForm.tsx             # left column
  RiderRow.tsx              # one rider toggle + SA/plan input
  QuoteResultPanel.tsx      # right column table + total
  WarningList.tsx
  CopySummaryButton.tsx
  ExpiryBanner.tsx
src/lib/summary.ts          # plain-text summary for LINE
tests/
  calc/*.test.ts
  golden/plb.json, golden/plb.test.ts
```

---

### Task 1: Scaffold Next.js + Vitest

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `vitest.config.ts`, `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`
- Modify: `.gitignore`

- [ ] **Step 1: Create the Next.js app in the current folder**

Run (from `/Users/pheerapatpisit/Documents/APP/Ai Assis`):
```bash
npx --yes create-next-app@15 . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm --no-turbopack --yes
```
Expected: `package.json`, `src/app/*`, `tailwind` config created. If it complains the directory is not empty because of `docs/`, `.gitignore`, `ไฟล์คำนวน/`, run instead:
```bash
npx --yes create-next-app@15 /private/tmp/claude-501/-Users-pheerapatpisit-Documents-APP-Ai-Assis/c8375f6b-8fcb-4678-a7fe-0987e9ed74f6/scratchpad/scaffold --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm --no-turbopack --yes
rsync -a --exclude .git --exclude node_modules /private/tmp/claude-501/-Users-pheerapatpisit-Documents-APP-Ai-Assis/c8375f6b-8fcb-4678-a7fe-0987e9ed74f6/scratchpad/scaffold/ "/Users/pheerapatpisit/Documents/APP/Ai Assis/"
cd "/Users/pheerapatpisit/Documents/APP/Ai Assis" && npm install
```

- [ ] **Step 2: Merge .gitignore**

Ensure `.gitignore` contains all of these lines (keep the existing Thai comment and `ไฟล์คำนวน/`):
```
node_modules/
.next/
out/
.env*
.DS_Store
*.tsbuildinfo
next-env.d.ts
# ไฟล์ Excel ของบริษัท (ใหญ่และเป็นข้อมูลภายใน) ไม่เก็บใน git
ไฟล์คำนวน/
```

- [ ] **Step 3: Install Vitest**

```bash
npm install -D vitest@2
```

- [ ] **Step 4: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: { include: ["tests/**/*.test.ts"], environment: "node" },
});
```

- [ ] **Step 5: Add scripts to `package.json`**

In `"scripts"` add:
```json
"test": "vitest run",
"test:watch": "vitest",
"extract": "python3 scripts/extract_rates.py",
"golden": "python3 scripts/make_golden.py"
```

- [ ] **Step 6: Ensure tsconfig has JSON imports**

`tsconfig.json` `compilerOptions` must include `"resolveJsonModule": true` and `"esModuleInterop": true` (create-next-app sets both; verify with `grep resolveJsonModule tsconfig.json`).

- [ ] **Step 7: Replace `src/app/page.tsx` with a placeholder**

```tsx
export default function Home() {
  return <main className="p-6">คำนวณเบี้ยประกัน</main>;
}
```

- [ ] **Step 8: Set Thai metadata in `src/app/layout.tsx`**

```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "คำนวณเบี้ยประกัน",
  description: "โปรแกรมคำนวณเบี้ยประกันสำหรับตัวแทน",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">{children}</body>
    </html>
  );
}
```

- [ ] **Step 9: Verify build and test runner**

```bash
npm run build && npx vitest run
```
Expected: build succeeds; vitest prints `No test files found` (exit code 0 or 1 is fine at this point).

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js + Vitest

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Extract PLB rate tables from Excel

**Files:**
- Create: `scripts/extract_rates.py`, `data/rates/plb.json`
- Test: `tests/calc/rates-plb.test.ts`

- [ ] **Step 1: Write the failing test that pins known Excel values**

`tests/calc/rates-plb.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import plb from "../../data/rates/plb.json";

describe("data/rates/plb.json", () => {
  it("has metadata", () => {
    expect(plb.planCode).toBe("PLB");
    expect(plb.version).toBe("A2026-1");
    expect(plb.expiresOn).toBe("2027-03-31");
    expect(plb.modeFactors).toEqual({ annual: 1, semi: 0.52, monthly: 0.09 });
  });

  it("has base rates for ages 20-59 for every variant/sex", () => {
    for (const v of ["PLB05", "PLB10", "PLB12", "PLB15"]) {
      for (const s of ["M", "F"]) {
        const table = (plb.base.rates as any)[v][s];
        expect(Object.keys(table)).toHaveLength(40);
        expect(table["20"]).toBeTypeOf("number");
        expect(table["59"]).toBeTypeOf("number");
        expect(table["19"]).toBeUndefined();
      }
    }
    expect(plb.base.rates.PLB12.M["35"]).toBe(6.47);
    expect(plb.base.rates.PLB12.F["35"]).toBe(3.67);
    expect(plb.base.rates.PLB12.M["59"]).toBe(31.78);
    expect(plb.base.rates.PLB05.M["55"]).toBe(17.2);
  });

  it("has discount tiers", () => {
    expect(plb.discount.thresholds).toEqual([350000, 500000, 700000, 1000000]);
    expect(plb.discount.byVariant.PLB12).toEqual([0, 0.5, 0.5, 1]);
    expect(plb.discount.byVariant.PLB05).toEqual([0, 0.5, 0.5, 1]);
  });

  it("has rider tables", () => {
    expect(plb.riders.AP.rates["0"]).toEqual([3, 4.05, 5.1, 6]);
    expect(plb.riders.AP.rates["60"]).toEqual([3, 4.05, 5.1, 6]);
    expect(Object.keys(plb.riders.AP.rates)).toHaveLength(61);
    expect(plb.riders.ECARE.rates["16"]).toEqual([6.5, 7.5, 8.5, 10.5]);
    expect(Object.keys(plb.riders.ECARE.rates)).toHaveLength(45);
    expect(plb.riders.MEB.plans).toEqual([500, 1000, 2000, 3000, 4000, 5000]);
    expect(plb.riders.MEB.premiums["6"]).toEqual([475, 950, 0, 0, 0, 0]);
    expect(plb.riders.MEB.premiums["74"]).toEqual([3210, 6420, 12840, 19260, 25680, 32100]);
    expect(Object.keys(plb.riders.MEB.premiums)).toHaveLength(69);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/calc/rates-plb.test.ts`
Expected: FAIL — cannot resolve `../../data/rates/plb.json`.

- [ ] **Step 3: Write `scripts/extract_rates.py`**

```python
#!/usr/bin/env python3
"""Extract PLB rate tables from the company Excel proposal into data/rates/plb.json.

Deterministic: running twice on the same Excel file yields byte-identical JSON.
Never edit data/rates/plb.json by hand; edit this script and re-run `npm run extract`.
"""
import json
import sys
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "ไฟล์คำนวน" / "Protection Life (PLB)_A2026-1_01042026.xlsx"
OUT = ROOT / "data" / "rates" / "plb.json"

VARIANTS = ["PLB05", "PLB10", "PLB12", "PLB15"]
MODE_MAP = {"รายปี": "annual", "ราย 6 เดือน": "semi", "รายเดือน": "monthly"}


def cell(ws, r, c):
    v = ws.cell(r, c).value
    return v


def age_class_table(ws, first_row, last_row):
    """Rows first..last: col A = age, cols B..E = classes 1..4."""
    out = {}
    for r in range(first_row, last_row + 1):
        age = cell(ws, r, 1)
        assert isinstance(age, (int, float)), f"{ws.title} row {r}: bad age {age!r}"
        out[str(int(age))] = [cell(ws, r, c) for c in range(2, 6)]
    return out


def main():
    if not SRC.exists():
        sys.exit(f"Excel file not found: {SRC}")
    wb = openpyxl.load_workbook(SRC, data_only=True)
    inp, cal, pm = wb["กรอกข้อมูล"], wb["Cal"], wb["Premium&Maturity"]

    # --- metadata -------------------------------------------------------
    version = inp["E59"].value
    expires = inp["G58"].value  # datetime
    meta = {
        "planCode": "PLB",
        "planName": f"{inp['E61'].value} (PLB)",
        "version": version,
        "effectiveText": inp["E58"].value,
        "expiresOn": expires.strftime("%Y-%m-%d"),
        "sourceFile": SRC.name,
    }

    # --- mode factors: Cal I2:J5 ---------------------------------------
    mode_factors = {}
    for r in range(2, 6):
        th = cell(cal, r, 9)
        if th in MODE_MAP:
            mode_factors[MODE_MAP[th]] = cell(cal, r, 10)
    assert set(mode_factors) == {"annual", "semi", "monthly"}, mode_factors

    # --- base rates: Premium&Maturity N1:V59, sheet row == age ---------
    header = {cell(pm, 1, c): c for c in range(14, 23)}
    rates = {}
    for v in VARIANTS:
        rates[v] = {}
        for sex in ("M", "F"):
            col = header[f"{v}{sex}"]
            table = {}
            for r in range(2, 60):
                val = cell(pm, r, col)
                if val is not None:
                    assert cell(pm, r, 14) == r, f"age column mismatch at row {r}"
                    table[str(r)] = val
            assert len(table) == 40, f"{v}{sex}: expected 40 ages, got {len(table)}"
            rates[v][sex] = table

    # --- discount: Cal A27:K31 -----------------------------------------
    disc_header = {cell(cal, 27, c): c for c in range(2, 12)}
    thresholds = [cell(cal, r, 1) for r in range(28, 32)]
    by_variant = {v: [cell(cal, r, disc_header[v]) for r in range(28, 32)] for v in VARIANTS}

    # --- riders --------------------------------------------------------
    ap = age_class_table(wb["AP"], 7, 67)          # ages 0..60
    ecare = age_class_table(wb["ECARE"], 7, 51)    # ages 16..60
    meb_ws = wb["MEB"]
    meb_plans = [cell(meb_ws, 6, c) for c in range(2, 8)]
    meb = {}
    for r in range(7, 76):                         # ages 6..74
        age = cell(meb_ws, r, 1)
        meb[str(int(age))] = [cell(meb_ws, r, c) for c in range(2, 8)]
    assert len(ap) == 61 and len(ecare) == 45 and len(meb) == 69

    out = {
        **meta,
        "modeFactors": mode_factors,
        "base": {"variants": VARIANTS, "rates": rates},
        "discount": {"thresholds": thresholds, "byVariant": by_variant},
        "riders": {
            "AP": {"kind": "ratePerThousandByAgeClass", "rates": ap},
            "ECARE": {"kind": "ratePerThousandByAgeClass", "rates": ecare},
            "MEB": {"kind": "fixedByAgePlan", "plans": meb_plans, "premiums": meb},
        },
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=1, sort_keys=False) + "\n", encoding="utf-8")
    print(f"wrote {OUT} ({OUT.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: Run the extractor**

Run: `npm run extract`
Expected: `wrote .../data/rates/plb.json (... bytes)` with no assertion errors.

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/calc/rates-plb.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Verify determinism**

```bash
cp data/rates/plb.json /tmp/plb-a.json && npm run extract && diff /tmp/plb-a.json data/rates/plb.json && echo IDENTICAL
```
Expected: `IDENTICAL`.

- [ ] **Step 7: Commit**

```bash
git add scripts/extract_rates.py data/rates/plb.json tests/calc/rates-plb.test.ts
git commit -m "feat: extract PLB rate tables from Excel to JSON

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Money helpers (integer satang)

**Files:**
- Create: `src/calc/money.ts`
- Test: `tests/calc/money.test.ts`

- [ ] **Step 1: Write the failing tests**

`tests/calc/money.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { toHundredths, floorDiv, satangToBaht, premiumPerThousand, applyModeFactor, formatBaht } from "@/calc/money";

describe("money", () => {
  it("toHundredths converts a 2-decimal number to an exact integer", () => {
    expect(toHundredths(6.47)).toBe(647);
    expect(toHundredths(0.52)).toBe(52);
    expect(toHundredths(1)).toBe(100);
    expect(toHundredths(0)).toBe(0);
  });

  it("floorDiv floors toward negative infinity", () => {
    expect(floorDiv(7, 2)).toBe(3);
    expect(floorDiv(6, 2)).toBe(3);
    expect(floorDiv(-7, 2)).toBe(-4);
  });

  it("premiumPerThousand = ROUNDDOWN(rate * SA / 1000, 2) in satang", () => {
    // (6.47 - 1) * 1,000,000 / 1000 = 5470.00
    expect(premiumPerThousand(647 - 100, 1_000_000)).toBe(547_000);
    // 6.47 * 300,000 / 1000 = 1941.00
    expect(premiumPerThousand(647, 300_000)).toBe(194_100);
    // 4.05 * 123,456 / 1000 = 499.9968 → 499.99
    expect(premiumPerThousand(405, 123_456)).toBe(49_999);
  });

  it("applyModeFactor = ROUNDDOWN(x * factor, 2) from an unrounded product", () => {
    // base: (rate-disc)*SA/1000*factor: 5470 * 0.52 = 2844.40
    expect(applyModeFactor(547, 1_000_000, 52)).toBe(284_440);
    // 499.9968 * 0.09 = 44.999712 → 44.99 (NOT 45.00 — factor applied before rounding)
    expect(applyModeFactor(405, 123_456, 9)).toBe(4_499);
    // annual factor 100 gives the same as premiumPerThousand
    expect(applyModeFactor(647, 300_000, 100)).toBe(194_100);
  });

  it("satangToBaht and formatBaht", () => {
    expect(satangToBaht(284_440)).toBe(2844.4);
    expect(formatBaht(284_440)).toBe("2,844.40");
    expect(formatBaht(0)).toBe("0.00");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/calc/money.test.ts`
Expected: FAIL — cannot find module `@/calc/money`.

- [ ] **Step 3: Implement `src/calc/money.ts`**

```ts
/**
 * All premium arithmetic is done in integer satang (1 baht = 100 satang)
 * so results match Excel's ROUNDDOWN(...,2) exactly, with no float drift.
 *
 * Rates per 1,000 baht of sum assured are stored with 2 decimals in the JSON,
 * so `toHundredths(rate)` is an exact integer ("rate100").
 */

/** 6.47 → 647. Only for values with at most 2 decimals. */
export function toHundredths(n: number): number {
  return Math.round(n * 100);
}

export function floorDiv(a: number, b: number): number {
  return Math.floor(a / b);
}

/**
 * Excel: ROUNDDOWN(rate * SA / 1000, 2), returned in satang.
 * rate100 = rate * 100 (integer). Result = floor(rate100 * SA / 1000).
 */
export function premiumPerThousand(rate100: number, sumAssured: number): number {
  return floorDiv(rate100 * sumAssured, 1000);
}

/**
 * Excel: ROUNDDOWN(rate * SA / 1000 * factor, 2), returned in satang.
 * factor100 = factor * 100 (annual 100, semi 52, monthly 9).
 * Result = floor(rate100 * SA * factor100 / 100000).
 */
export function applyModeFactor(rate100: number, sumAssured: number, factor100: number): number {
  return floorDiv(rate100 * sumAssured * factor100, 100_000);
}

/** Excel: ROUNDDOWN(annualBaht * factor, 2) for fixed premiums. annual100 in satang. */
export function applyModeFactorToFixed(annual100: number, factor100: number): number {
  return floorDiv(annual100 * factor100, 100);
}

export function satangToBaht(satang: number): number {
  return satang / 100;
}

export function formatBaht(satang: number): string {
  return (satang / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/calc/money.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/calc/money.ts tests/calc/money.test.ts
git commit -m "feat(calc): integer-satang money helpers matching Excel ROUNDDOWN

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Types and rate lookup

**Files:**
- Create: `src/calc/types.ts`, `src/calc/lookup.ts`
- Test: `tests/calc/lookup.test.ts`

- [ ] **Step 1: Write `src/calc/types.ts`** (no test; pure types)

```ts
export type Sex = "M" | "F";
export type PayMode = "annual" | "semi" | "monthly";

export const PAY_MODE_LABEL: Record<PayMode, string> = {
  annual: "รายปี",
  semi: "ราย 6 เดือน",
  monthly: "รายเดือน",
};

// ---------- data/rates/<plan>.json ----------
export interface RatePerThousandByAgeClass {
  kind: "ratePerThousandByAgeClass";
  /** age → [class1, class2, class3, class4] rate per 1,000 */
  rates: Record<string, number[]>;
}
export interface FixedByAgePlan {
  kind: "fixedByAgePlan";
  plans: number[];
  /** age → premium per plan (same order as `plans`); 0 = not offered */
  premiums: Record<string, number[]>;
}
export type RiderRates = RatePerThousandByAgeClass | FixedByAgePlan;

export interface PlanRates {
  planCode: string;
  planName: string;
  version: string;
  effectiveText: string;
  expiresOn: string; // YYYY-MM-DD
  sourceFile: string;
  modeFactors: Record<PayMode, number>;
  base: {
    variants: string[];
    /** variant → sex → age → rate per 1,000 */
    rates: Record<string, Record<Sex, Record<string, number>>>;
  };
  discount: {
    thresholds: number[];
    /** variant → discount per 1,000 for each threshold (same order) */
    byVariant: Record<string, number[]>;
  };
  riders: Record<string, RiderRates>;
}

// ---------- data/rules/<plan>.json ----------
export interface RiderRule {
  name: string;
  ageMin: number;
  ageMax: number;
  /** for sum-assured riders */
  saMin?: number;
  saMaxMultipleOfBase?: number;
  saMaxCap?: number;
  /** for plan riders: highest plan allowed per age band (ascending ageMax) */
  planMaxByAge?: { ageMax: number; planMax: number }[];
}
export interface CombinedRule {
  code: string;
  riders: string[];
  maxMultipleOfBase: number;
  cap: number;
  message: string;
}
export interface PlanRules {
  planCode: string;
  base: { ageMin: number; ageMax: number; saMin: number };
  minMonthlyTotal: number;
  riders: Record<string, RiderRule>;
  combined: CombinedRule[];
}

// ---------- engine I/O ----------
export interface RiderInput {
  code: string;
  sumAssured?: number;
  plan?: number;
}
export interface QuoteInput {
  planCode: string;
  variant: string;
  age: number;
  sex: Sex;
  mode: PayMode;
  sumAssured: number;
  riders: RiderInput[];
}

export interface QuoteItem {
  code: string;
  name: string;
  /** sum assured, or plan amount for plan riders */
  amount: number;
  /** satang; 0 when not eligible/excluded */
  annual: number;
  modal: number;
  eligible: boolean;
  message?: string;
}
export interface Warning {
  level: "error" | "warn";
  code: string;
  message: string;
}
export interface Availability {
  code: string;
  name: string;
  eligible: boolean;
  ageRange: string;
  saMin?: number;
  saMax?: number;
  plans?: number[];
  reason?: string;
}
export interface QuoteResult {
  items: QuoteItem[];
  /** satang */
  totalAnnual: number;
  totalModal: number;
  warnings: Warning[];
  availability: Availability[];
  meta: { planName: string; version: string; expiresOn: string; expired: boolean };
}
```

- [ ] **Step 2: Write the failing lookup tests**

`tests/calc/lookup.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { baseRate, riderRateByAgeClass, fixedPremiumByAgePlan } from "@/calc/lookup";
import plbJson from "../../data/rates/plb.json";
import type { PlanRates } from "@/calc/types";

const plb = plbJson as unknown as PlanRates;

describe("lookup", () => {
  it("baseRate finds rate per 1,000 or undefined", () => {
    expect(baseRate(plb, "PLB12", "M", 35)).toBe(6.47);
    expect(baseRate(plb, "PLB12", "F", 35)).toBe(3.67);
    expect(baseRate(plb, "PLB12", "M", 19)).toBeUndefined();
    expect(baseRate(plb, "PLB12", "M", 60)).toBeUndefined();
    expect(baseRate(plb, "NOPE", "M", 35)).toBeUndefined();
  });

  it("riderRateByAgeClass uses class 1..4 (1-based)", () => {
    expect(riderRateByAgeClass(plb, "AP", 35, 1)).toBe(3);
    expect(riderRateByAgeClass(plb, "AP", 35, 4)).toBe(6);
    expect(riderRateByAgeClass(plb, "AP", 61, 1)).toBeUndefined();
    expect(riderRateByAgeClass(plb, "ECARE", 15, 1)).toBeUndefined();
    expect(riderRateByAgeClass(plb, "ECARE", 16, 1)).toBe(6.5);
    expect(riderRateByAgeClass(plb, "MEB", 16, 1)).toBeUndefined(); // wrong kind
  });

  it("fixedPremiumByAgePlan finds the fixed premium or undefined", () => {
    expect(fixedPremiumByAgePlan(plb, "MEB", 6, 500)).toBe(475);
    expect(fixedPremiumByAgePlan(plb, "MEB", 74, 5000)).toBe(32100);
    expect(fixedPremiumByAgePlan(plb, "MEB", 6, 2000)).toBe(0); // table says 0 = not offered
    expect(fixedPremiumByAgePlan(plb, "MEB", 5, 500)).toBeUndefined();
    expect(fixedPremiumByAgePlan(plb, "MEB", 30, 999)).toBeUndefined();
    expect(fixedPremiumByAgePlan(plb, "AP", 30, 500)).toBeUndefined(); // wrong kind
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/calc/lookup.test.ts`
Expected: FAIL — cannot find module `@/calc/lookup`.

- [ ] **Step 4: Implement `src/calc/lookup.ts`**

```ts
import type { PlanRates, Sex } from "./types";

/** Base plan rate per 1,000 for (variant, sex, age); undefined if not in table. */
export function baseRate(rates: PlanRates, variant: string, sex: Sex, age: number): number | undefined {
  return rates.base.rates[variant]?.[sex]?.[String(age)];
}

/** Rider rate per 1,000 for (age, occupation class 1..4); undefined if not offered. */
export function riderRateByAgeClass(rates: PlanRates, code: string, age: number, occClass: 1 | 2 | 3 | 4): number | undefined {
  const rider = rates.riders[code];
  if (!rider || rider.kind !== "ratePerThousandByAgeClass") return undefined;
  return rider.rates[String(age)]?.[occClass - 1];
}

/** Fixed annual premium for (age, plan); undefined if age or plan not in table. */
export function fixedPremiumByAgePlan(rates: PlanRates, code: string, age: number, plan: number): number | undefined {
  const rider = rates.riders[code];
  if (!rider || rider.kind !== "fixedByAgePlan") return undefined;
  const idx = rider.plans.indexOf(plan);
  if (idx < 0) return undefined;
  return rider.premiums[String(age)]?.[idx];
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/calc/lookup.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add src/calc/types.ts src/calc/lookup.ts tests/calc/lookup.test.ts
git commit -m "feat(calc): engine types and safe rate lookups

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Discount and base premium

**Files:**
- Create: `src/calc/discount.ts`, `src/calc/base-premium.ts`
- Test: `tests/calc/discount.test.ts`, `tests/calc/base-premium.test.ts`

- [ ] **Step 1: Write the failing discount tests**

`tests/calc/discount.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { discountPerThousand } from "@/calc/discount";
import plbJson from "../../data/rates/plb.json";
import type { PlanRates } from "@/calc/types";

const plb = plbJson as unknown as PlanRates;

describe("discountPerThousand (Excel Cal!B32:K32)", () => {
  it("steps at each threshold for PLB12", () => {
    expect(discountPerThousand(plb, "PLB12", 300_000)).toBe(0);
    expect(discountPerThousand(plb, "PLB12", 349_999)).toBe(0);
    expect(discountPerThousand(plb, "PLB12", 350_000)).toBe(0);
    expect(discountPerThousand(plb, "PLB12", 499_999)).toBe(0);
    expect(discountPerThousand(plb, "PLB12", 500_000)).toBe(0.5);
    expect(discountPerThousand(plb, "PLB12", 699_999)).toBe(0.5);
    expect(discountPerThousand(plb, "PLB12", 700_000)).toBe(0.5);
    expect(discountPerThousand(plb, "PLB12", 999_999)).toBe(0.5);
    expect(discountPerThousand(plb, "PLB12", 1_000_000)).toBe(1);
    expect(discountPerThousand(plb, "PLB12", 25_000_000)).toBe(1);
  });
  it("returns 0 for an unknown variant", () => {
    expect(discountPerThousand(plb, "NOPE", 5_000_000)).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/calc/discount.test.ts`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Implement `src/calc/discount.ts`**

```ts
import type { PlanRates } from "./types";

/**
 * Excel Cal!B32:K32:
 *   IF(SA>=T4, d4, IF(SA>=T3, d3, IF(SA>=T2, d2, IF(SA>=T1, d1, 0))))
 * Thresholds ascending; pick the highest threshold <= SA.
 */
export function discountPerThousand(rates: PlanRates, variant: string, sumAssured: number): number {
  const values = rates.discount.byVariant[variant];
  if (!values) return 0;
  const { thresholds } = rates.discount;
  let result = 0;
  for (let i = 0; i < thresholds.length; i++) {
    if (sumAssured >= thresholds[i]) result = values[i];
  }
  return result;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/calc/discount.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing base-premium tests**

`tests/calc/base-premium.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { basePremium } from "@/calc/base-premium";
import plbJson from "../../data/rates/plb.json";
import type { PlanRates } from "@/calc/types";

const plb = plbJson as unknown as PlanRates;

describe("basePremium", () => {
  it("PLB12 male 35, SA 1,000,000, annual: (6.47-1)*1000 = 5470.00", () => {
    const r = basePremium(plb, { variant: "PLB12", sex: "M", age: 35, sumAssured: 1_000_000, mode: "annual" });
    expect(r).toEqual({ rate: 6.47, discount: 1, annual: 547_000, modal: 547_000 });
  });
  it("semi-annual applies 0.52 to the unrounded product", () => {
    const r = basePremium(plb, { variant: "PLB12", sex: "M", age: 35, sumAssured: 1_000_000, mode: "semi" });
    expect(r?.modal).toBe(284_440); // 5470 * 0.52 = 2844.40
  });
  it("monthly applies 0.09", () => {
    const r = basePremium(plb, { variant: "PLB12", sex: "F", age: 35, sumAssured: 300_000, mode: "monthly" });
    // 3.67 * 300 = 1101.00 annual; * 0.09 = 99.09
    expect(r).toEqual({ rate: 3.67, discount: 0, annual: 110_100, modal: 9_909 });
  });
  it("returns undefined when the age has no rate", () => {
    expect(basePremium(plb, { variant: "PLB12", sex: "M", age: 60, sumAssured: 300_000, mode: "annual" })).toBeUndefined();
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npx vitest run tests/calc/base-premium.test.ts`
Expected: FAIL — cannot find module.

- [ ] **Step 7: Implement `src/calc/base-premium.ts`**

```ts
import type { PayMode, PlanRates, Sex } from "./types";
import { baseRate } from "./lookup";
import { discountPerThousand } from "./discount";
import { applyModeFactor, premiumPerThousand, toHundredths } from "./money";

export interface BasePremiumInput {
  variant: string;
  sex: Sex;
  age: number;
  sumAssured: number;
  mode: PayMode;
}
export interface BasePremiumResult {
  rate: number;
  discount: number;
  /** satang */
  annual: number;
  modal: number;
}

/** Excel Cal!G13 / Cal!H13. Returns undefined when no rate exists for the age. */
export function basePremium(rates: PlanRates, input: BasePremiumInput): BasePremiumResult | undefined {
  const rate = baseRate(rates, input.variant, input.sex, input.age);
  if (rate === undefined) return undefined;
  const discount = discountPerThousand(rates, input.variant, input.sumAssured);
  const net100 = toHundredths(rate) - toHundredths(discount);
  const factor100 = toHundredths(rates.modeFactors[input.mode]);
  return {
    rate,
    discount,
    annual: premiumPerThousand(net100, input.sumAssured),
    modal: applyModeFactor(net100, input.sumAssured, factor100),
  };
}
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `npx vitest run tests/calc/base-premium.test.ts tests/calc/discount.test.ts`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/calc/discount.ts src/calc/base-premium.ts tests/calc/discount.test.ts tests/calc/base-premium.test.ts
git commit -m "feat(calc): tiered discount and base premium

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: Rider premiums (AP, ECARE, MEB)

**Files:**
- Create: `src/calc/riders/rate-per-thousand.ts`, `src/calc/riders/fixed-by-plan.ts`
- Test: `tests/calc/riders.test.ts`

- [ ] **Step 1: Write the failing tests**

`tests/calc/riders.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { ratePerThousandRiderPremium } from "@/calc/riders/rate-per-thousand";
import { fixedPlanRiderPremium } from "@/calc/riders/fixed-by-plan";
import plbJson from "../../data/rates/plb.json";
import type { PlanRates } from "@/calc/types";

const plb = plbJson as unknown as PlanRates;

describe("AP / ECARE (rate per 1,000, class 1)", () => {
  it("AP 1,000,000 age 35 annual = 3 * 1000 = 3000.00", () => {
    expect(ratePerThousandRiderPremium(plb, "AP", { age: 35, sumAssured: 1_000_000, mode: "annual" }))
      .toEqual({ rate: 3, annual: 300_000, modal: 300_000 });
  });
  it("ECARE 500,000 age 35 monthly = 6.5*500=3250.00 annual; *0.09 = 292.50", () => {
    expect(ratePerThousandRiderPremium(plb, "ECARE", { age: 35, sumAssured: 500_000, mode: "monthly" }))
      .toEqual({ rate: 6.5, annual: 325_000, modal: 29_250 });
  });
  it("modal is floored from the unrounded product", () => {
    // AP 123,456 semi: 3*123.456 = 370.368 → annual 370.36; *0.52 = 192.59136 → 192.59
    expect(ratePerThousandRiderPremium(plb, "AP", { age: 20, sumAssured: 123_456, mode: "semi" }))
      .toEqual({ rate: 3, annual: 37_036, modal: 19_259 });
  });
  it("returns undefined outside the table", () => {
    expect(ratePerThousandRiderPremium(plb, "ECARE", { age: 15, sumAssured: 100_000, mode: "annual" })).toBeUndefined();
    expect(ratePerThousandRiderPremium(plb, "AP", { age: 61, sumAssured: 100_000, mode: "annual" })).toBeUndefined();
  });
});

describe("MEB (fixed premium by plan)", () => {
  it("age 35 plan 1000 annual", () => {
    const p = plb.riders.MEB.kind === "fixedByAgePlan" ? plb.riders.MEB.premiums["35"][1] : NaN;
    const r = fixedPlanRiderPremium(plb, "MEB", { age: 35, plan: 1000, mode: "annual" });
    expect(r).toEqual({ annual: p * 100, modal: p * 100 });
  });
  it("age 74 plan 5000 semi = 32100 * 0.52 = 16692.00", () => {
    expect(fixedPlanRiderPremium(plb, "MEB", { age: 74, plan: 5000, mode: "semi" }))
      .toEqual({ annual: 3_210_000, modal: 1_669_200 });
  });
  it("age 6 plan 500 monthly = 475 * 0.09 = 42.75", () => {
    expect(fixedPlanRiderPremium(plb, "MEB", { age: 6, plan: 500, mode: "monthly" }))
      .toEqual({ annual: 47_500, modal: 4_275 });
  });
  it("returns undefined when table has 0 or no entry", () => {
    expect(fixedPlanRiderPremium(plb, "MEB", { age: 6, plan: 2000, mode: "annual" })).toBeUndefined();
    expect(fixedPlanRiderPremium(plb, "MEB", { age: 5, plan: 500, mode: "annual" })).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/calc/riders.test.ts`
Expected: FAIL — cannot find modules.

- [ ] **Step 3: Implement `src/calc/riders/rate-per-thousand.ts`**

```ts
import type { PayMode, PlanRates } from "../types";
import { riderRateByAgeClass } from "../lookup";
import { applyModeFactor, premiumPerThousand, toHundredths } from "../money";

export interface RatePerThousandInput {
  age: number;
  sumAssured: number;
  mode: PayMode;
}
export interface RatePerThousandResult {
  rate: number;
  annual: number; // satang
  modal: number; // satang
}

const OCCUPATION_CLASS = 1 as const; // fixed for this app (no UI for class)

/** Excel Cal!G17/H17 (AP) and G18/H18 (ECARE). */
export function ratePerThousandRiderPremium(
  rates: PlanRates,
  code: string,
  input: RatePerThousandInput,
): RatePerThousandResult | undefined {
  const rate = riderRateByAgeClass(rates, code, input.age, OCCUPATION_CLASS);
  if (rate === undefined) return undefined;
  const rate100 = toHundredths(rate);
  const factor100 = toHundredths(rates.modeFactors[input.mode]);
  return {
    rate,
    annual: premiumPerThousand(rate100, input.sumAssured),
    modal: applyModeFactor(rate100, input.sumAssured, factor100),
  };
}
```

- [ ] **Step 4: Implement `src/calc/riders/fixed-by-plan.ts`**

```ts
import type { PayMode, PlanRates } from "../types";
import { fixedPremiumByAgePlan } from "../lookup";
import { applyModeFactorToFixed, toHundredths } from "../money";

export interface FixedPlanInput {
  age: number;
  plan: number;
  mode: PayMode;
}
export interface FixedPlanResult {
  annual: number; // satang
  modal: number; // satang
}

/** Excel Cal!G21/H21 (MEB). A table value of 0 means "not offered" → undefined. */
export function fixedPlanRiderPremium(rates: PlanRates, code: string, input: FixedPlanInput): FixedPlanResult | undefined {
  const premium = fixedPremiumByAgePlan(rates, code, input.age, input.plan);
  if (premium === undefined || premium === 0) return undefined;
  const annual = toHundredths(premium);
  const factor100 = toHundredths(rates.modeFactors[input.mode]);
  return { annual, modal: applyModeFactorToFixed(annual, factor100) };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/calc/riders.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 6: Commit**

```bash
git add src/calc/riders tests/calc/riders.test.ts
git commit -m "feat(calc): AP, ECARE and MEB rider premiums

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: Rules file and availability / warnings

**Files:**
- Create: `data/rules/plb.json`, `src/calc/rules.ts`
- Test: `tests/calc/rules.test.ts`

- [ ] **Step 1: Write `data/rules/plb.json`** (hand-written from the "Facts" table; the user reviews this file)

```json
{
  "planCode": "PLB",
  "base": { "ageMin": 20, "ageMax": 59, "saMin": 300000 },
  "minMonthlyTotal": 1000,
  "riders": {
    "AP": {
      "name": "สัญญาเพิ่มเติมอุบัติเหตุ (AP)",
      "ageMin": 0, "ageMax": 60,
      "saMin": 100000, "saMaxMultipleOfBase": 5, "saMaxCap": 10000000
    },
    "ECARE": {
      "name": "สัญญาเพิ่มเติมอุบัติเหตุ (ECARE)",
      "ageMin": 16, "ageMax": 60,
      "saMin": 100000, "saMaxMultipleOfBase": 5, "saMaxCap": 10000000
    },
    "MEB": {
      "name": "สัญญาเพิ่มเติมค่ารักษาพยาบาล (MEB)",
      "ageMin": 6, "ageMax": 65,
      "planMaxByAge": [
        { "ageMax": 10, "planMax": 500 },
        { "ageMax": 15, "planMax": 1000 },
        { "ageMax": 65, "planMax": 5000 }
      ]
    }
  },
  "combined": [
    {
      "code": "AP_ECARE_5X",
      "riders": ["AP", "ECARE"],
      "maxMultipleOfBase": 5,
      "cap": 10000000,
      "message": "AP+ECARE เกิน 5 เท่าของสัญญาหลัก"
    }
  ]
}
```

- [ ] **Step 2: Write the failing rules tests**

`tests/calc/rules.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { riderAvailability, checkRiderInput, checkCombined, checkMonthlyMinimum } from "@/calc/rules";
import rulesJson from "../../data/rules/plb.json";
import ratesJson from "../../data/rates/plb.json";
import type { PlanRules, PlanRates } from "@/calc/types";

const rules = rulesJson as unknown as PlanRules;
const rates = ratesJson as unknown as PlanRates;

describe("riderAvailability", () => {
  it("AP: eligible at 35 with SA min/max from base", () => {
    const a = riderAvailability(rules, rates, "AP", { age: 35, baseSumAssured: 1_000_000 });
    expect(a).toMatchObject({ code: "AP", eligible: true, ageRange: "0 - 60 ปี", saMin: 100_000, saMax: 5_000_000 });
  });
  it("AP: cap at 10,000,000", () => {
    const a = riderAvailability(rules, rates, "AP", { age: 35, baseSumAssured: 3_000_000 });
    expect(a.saMax).toBe(10_000_000);
  });
  it("ECARE: not eligible under 16", () => {
    const a = riderAvailability(rules, rates, "ECARE", { age: 15, baseSumAssured: 1_000_000 });
    expect(a.eligible).toBe(false);
    expect(a.reason).toBe("ไม่สามารถซื้อได้");
    expect(a.ageRange).toBe("16 - 60 ปี");
  });
  it("MEB: plans allowed by age", () => {
    expect(riderAvailability(rules, rates, "MEB", { age: 8, baseSumAssured: 300_000 }).plans).toEqual([500]);
    expect(riderAvailability(rules, rates, "MEB", { age: 12, baseSumAssured: 300_000 }).plans).toEqual([500, 1000]);
    expect(riderAvailability(rules, rates, "MEB", { age: 40, baseSumAssured: 300_000 }).plans).toEqual([500, 1000, 2000, 3000, 4000, 5000]);
    expect(riderAvailability(rules, rates, "MEB", { age: 66, baseSumAssured: 300_000 }).eligible).toBe(false);
  });
});

describe("checkRiderInput", () => {
  it("AP over max → message", () => {
    expect(checkRiderInput(rules, rates, "AP", { age: 35, baseSumAssured: 300_000 }, { code: "AP", sumAssured: 2_000_000 }))
      .toBe("AP เกินกว่าที่กำหนด");
  });
  it("AP under min → message", () => {
    expect(checkRiderInput(rules, rates, "AP", { age: 35, baseSumAssured: 300_000 }, { code: "AP", sumAssured: 50_000 }))
      .toBe("AP ต่ำกว่าขั้นต่ำ 100,000");
  });
  it("AP within range → undefined", () => {
    expect(checkRiderInput(rules, rates, "AP", { age: 35, baseSumAssured: 300_000 }, { code: "AP", sumAssured: 1_000_000 }))
      .toBeUndefined();
  });
  it("MEB plan over max for age → message", () => {
    expect(checkRiderInput(rules, rates, "MEB", { age: 12, baseSumAssured: 300_000 }, { code: "MEB", plan: 2000 }))
      .toBe("MEB เกินกว่าที่กำหนด");
  });
  it("ineligible age → message", () => {
    expect(checkRiderInput(rules, rates, "ECARE", { age: 15, baseSumAssured: 300_000 }, { code: "ECARE", sumAssured: 100_000 }))
      .toBe("ไม่สามารถซื้อได้");
  });
});

describe("checkCombined", () => {
  it("AP+ECARE over 5x base → both codes flagged", () => {
    const r = checkCombined(rules, 300_000, [{ code: "AP", sumAssured: 1_000_000 }, { code: "ECARE", sumAssured: 600_000 }]);
    expect(r).toEqual([{ code: "AP_ECARE_5X", codes: ["AP", "ECARE"], message: "AP+ECARE เกิน 5 เท่าของสัญญาหลัก" }]);
  });
  it("exactly 5x is fine", () => {
    expect(checkCombined(rules, 300_000, [{ code: "AP", sumAssured: 1_000_000 }, { code: "ECARE", sumAssured: 500_000 }])).toEqual([]);
  });
  it("cap 10,000,000 applies", () => {
    expect(checkCombined(rules, 5_000_000, [{ code: "AP", sumAssured: 10_000_000 }, { code: "ECARE", sumAssured: 100_000 }]))
      .toHaveLength(1);
  });
});

describe("checkMonthlyMinimum", () => {
  it("monthly total under 1000 baht → warning", () => {
    expect(checkMonthlyMinimum(rules, "monthly", 99_900)).toEqual({
      level: "error", code: "MIN_MONTHLY", message: "เบี้ยประกันภัยรายเดือนต่ำกว่า 1,000 บาท",
    });
  });
  it("annual never warns", () => {
    expect(checkMonthlyMinimum(rules, "annual", 99_900)).toBeUndefined();
  });
  it("monthly at exactly 1000 is fine", () => {
    expect(checkMonthlyMinimum(rules, "monthly", 100_000)).toBeUndefined();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/calc/rules.test.ts`
Expected: FAIL — cannot find module `@/calc/rules`.

- [ ] **Step 4: Implement `src/calc/rules.ts`**

```ts
import type { Availability, PayMode, PlanRates, PlanRules, RiderInput, Warning } from "./types";

export interface RiderContext {
  age: number;
  baseSumAssured: number;
}

export const CANNOT_BUY = "ไม่สามารถซื้อได้";

function fmt(n: number): string {
  return n.toLocaleString("en-US");
}

function allowedPlans(rates: PlanRates, rules: PlanRules, code: string, age: number): number[] | undefined {
  const rule = rules.riders[code];
  const rider = rates.riders[code];
  if (!rule?.planMaxByAge || !rider || rider.kind !== "fixedByAgePlan") return undefined;
  const band = rule.planMaxByAge.find((b) => age <= b.ageMax);
  if (!band) return [];
  return rider.plans.filter((p) => p <= band.planMax);
}

function saMaxFor(rule: PlanRules["riders"][string], baseSumAssured: number): number | undefined {
  if (rule.saMaxMultipleOfBase === undefined) return undefined;
  const byMultiple = rule.saMaxMultipleOfBase * baseSumAssured;
  return rule.saMaxCap === undefined ? byMultiple : Math.min(byMultiple, rule.saMaxCap);
}

/** What the UI needs to enable/disable a rider and bound its input. */
export function riderAvailability(rules: PlanRules, rates: PlanRates, code: string, ctx: RiderContext): Availability {
  const rule = rules.riders[code];
  const ageRange = `${rule.ageMin} - ${rule.ageMax} ปี`;
  const eligible = ctx.age >= rule.ageMin && ctx.age <= rule.ageMax;
  return {
    code,
    name: rule.name,
    eligible,
    ageRange,
    saMin: rule.saMin,
    saMax: saMaxFor(rule, ctx.baseSumAssured),
    plans: allowedPlans(rates, rules, code, ctx.age),
    reason: eligible ? undefined : CANNOT_BUY,
  };
}

/** Per-rider input check. Returns the Excel-style message, or undefined when OK. */
export function checkRiderInput(
  rules: PlanRules,
  rates: PlanRates,
  code: string,
  ctx: RiderContext,
  input: RiderInput,
): string | undefined {
  const a = riderAvailability(rules, rates, code, ctx);
  if (!a.eligible) return CANNOT_BUY;
  if (input.plan !== undefined) {
    if (!a.plans || !a.plans.includes(input.plan)) return `${code} เกินกว่าที่กำหนด`;
    return undefined;
  }
  const sa = input.sumAssured ?? 0;
  if (a.saMin !== undefined && sa < a.saMin) return `${code} ต่ำกว่าขั้นต่ำ ${fmt(a.saMin)}`;
  if (a.saMax !== undefined && sa > a.saMax) return `${code} เกินกว่าที่กำหนด`;
  return undefined;
}

export interface CombinedViolation {
  code: string;
  codes: string[];
  message: string;
}

/** Excel I23/I24: AP_SA + ECARE_SA > MIN(5*base, 10,000,000). */
export function checkCombined(rules: PlanRules, baseSumAssured: number, riders: RiderInput[]): CombinedViolation[] {
  const out: CombinedViolation[] = [];
  for (const c of rules.combined) {
    const total = riders.filter((r) => c.riders.includes(r.code)).reduce((s, r) => s + (r.sumAssured ?? 0), 0);
    const limit = Math.min(c.maxMultipleOfBase * baseSumAssured, c.cap);
    if (total > limit) out.push({ code: c.code, codes: [...c.riders], message: c.message });
  }
  return out;
}

/** Excel J32/G36. totalModal in satang. */
export function checkMonthlyMinimum(rules: PlanRules, mode: PayMode, totalModal: number): Warning | undefined {
  if (mode !== "monthly") return undefined;
  if (totalModal >= rules.minMonthlyTotal * 100) return undefined;
  return { level: "error", code: "MIN_MONTHLY", message: `เบี้ยประกันภัยรายเดือนต่ำกว่า ${fmt(rules.minMonthlyTotal)} บาท` };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/calc/rules.test.ts`
Expected: PASS (14 tests).

- [ ] **Step 6: Commit**

```bash
git add data/rules/plb.json src/calc/rules.ts tests/calc/rules.test.ts
git commit -m "feat(calc): PLB eligibility rules, availability and warnings

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 8: Plan registry and quote integrator

**Files:**
- Create: `src/calc/plans/registry.ts`, `src/calc/quote.ts`
- Test: `tests/calc/quote.test.ts`

- [ ] **Step 1: Write `src/calc/plans/registry.ts`**

```ts
import type { PlanRates, PlanRules } from "../types";
import plbRates from "../../../data/rates/plb.json";
import plbRules from "../../../data/rules/plb.json";

export interface PlanBundle {
  rates: PlanRates;
  rules: PlanRules;
  /** rider codes in display order */
  riderOrder: string[];
  variantLabels: Record<string, string>;
}

const PLANS: Record<string, PlanBundle> = {
  PLB: {
    rates: plbRates as unknown as PlanRates,
    rules: plbRules as unknown as PlanRules,
    riderOrder: ["AP", "ECARE", "MEB"],
    variantLabels: {
      PLB05: "PLB05 (ชำระเบี้ย 5 ปี)",
      PLB10: "PLB10 (ชำระเบี้ย 10 ปี)",
      PLB12: "PLB12 (ชำระเบี้ย 12 ปี)",
      PLB15: "PLB15 (ชำระเบี้ย 15 ปี)",
    },
  },
};

export function listPlans(): { code: string; name: string }[] {
  return Object.entries(PLANS).map(([code, p]) => ({ code, name: p.rates.planName }));
}

export function getPlan(code: string): PlanBundle | undefined {
  return PLANS[code];
}
```

- [ ] **Step 2: Write the failing quote tests**

`tests/calc/quote.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { quote } from "@/calc/quote";
import type { QuoteInput } from "@/calc/types";

const base: QuoteInput = {
  planCode: "PLB", variant: "PLB12", age: 35, sex: "M", mode: "annual", sumAssured: 1_000_000, riders: [],
};

describe("quote (PLB)", () => {
  it("base only, annual", () => {
    const r = quote(base, new Date("2026-09-03"));
    expect(r.items).toHaveLength(1);
    expect(r.items[0]).toMatchObject({ code: "PLB12", amount: 1_000_000, annual: 547_000, modal: 547_000, eligible: true });
    expect(r.totalModal).toBe(547_000);
    expect(r.totalAnnual).toBe(547_000);
    expect(r.warnings).toEqual([]);
    expect(r.meta).toEqual({ planName: "โพรเทคชั่นไลฟ์ (PLB)", version: "A2026-1", expiresOn: "2027-03-31", expired: false });
    expect(r.availability.map((a) => a.code)).toEqual(["AP", "ECARE", "MEB"]);
  });

  it("base + AP + ECARE + MEB, monthly", () => {
    const r = quote({
      ...base, mode: "monthly",
      riders: [{ code: "AP", sumAssured: 1_000_000 }, { code: "ECARE", sumAssured: 500_000 }, { code: "MEB", plan: 1000 }],
    });
    const by = Object.fromEntries(r.items.map((i) => [i.code, i]));
    expect(by.PLB12.modal).toBe(49_230);   // 5470 * 0.09 = 492.30
    expect(by.AP.modal).toBe(27_000);      // 3000 * 0.09
    expect(by.ECARE.modal).toBe(29_250);   // 3250 * 0.09
    expect(by.MEB.annual).toBeGreaterThan(0);
    expect(r.totalModal).toBe(by.PLB12.modal + by.AP.modal + by.ECARE.modal + by.MEB.modal);
    expect(r.warnings).toEqual([]);
  });

  it("AP+ECARE over 5x base: both excluded from total, warning added (Excel behaviour)", () => {
    const r = quote({ ...base, sumAssured: 300_000, riders: [{ code: "AP", sumAssured: 1_000_000 }, { code: "ECARE", sumAssured: 600_000 }] });
    const by = Object.fromEntries(r.items.map((i) => [i.code, i]));
    expect(by.AP).toMatchObject({ eligible: false, modal: 0, message: "AP+ECARE เกิน 5 เท่าของสัญญาหลัก" });
    expect(by.ECARE).toMatchObject({ eligible: false, modal: 0, message: "AP+ECARE เกิน 5 เท่าของสัญญาหลัก" });
    expect(r.totalModal).toBe(by.PLB12.modal);
    expect(r.warnings).toContainEqual({ level: "error", code: "AP_ECARE_5X", message: "AP+ECARE เกิน 5 เท่าของสัญญาหลัก" });
  });

  it("monthly total under 1,000 → warning", () => {
    const r = quote({ ...base, sex: "F", sumAssured: 300_000, mode: "monthly" }); // 3.67*300*0.09 = 99.09
    expect(r.totalModal).toBe(9_909);
    expect(r.warnings).toContainEqual({ level: "error", code: "MIN_MONTHLY", message: "เบี้ยประกันภัยรายเดือนต่ำกว่า 1,000 บาท" });
  });

  it("age outside base range → base ineligible, error warning", () => {
    const r = quote({ ...base, age: 19 });
    expect(r.items[0]).toMatchObject({ code: "PLB12", eligible: false, modal: 0, message: "ไม่สามารถซื้อได้" });
    expect(r.warnings).toContainEqual({ level: "error", code: "BASE_AGE", message: "อายุรับประกัน 20 - 59 ปี" });
  });

  it("base SA under minimum → error warning, still calculates", () => {
    const r = quote({ ...base, sumAssured: 200_000 });
    expect(r.items[0].modal).toBeGreaterThan(0);
    expect(r.warnings).toContainEqual({ level: "error", code: "BASE_SA_MIN", message: "จำนวนเงินเอาประกันภัยขั้นต่ำ 300,000 บาท" });
  });

  it("rider with bad input → item message, excluded", () => {
    const r = quote({ ...base, riders: [{ code: "MEB", plan: 999 }] });
    const meb = r.items.find((i) => i.code === "MEB")!;
    expect(meb).toMatchObject({ eligible: false, modal: 0, message: "MEB เกินกว่าที่กำหนด" });
  });

  it("expired when today is after expiresOn", () => {
    expect(quote(base, new Date("2027-04-01")).meta.expired).toBe(true);
    expect(quote(base, new Date("2027-03-31")).meta.expired).toBe(false);
  });

  it("unknown plan throws", () => {
    expect(() => quote({ ...base, planCode: "NOPE" })).toThrow(/unknown plan/i);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/calc/quote.test.ts`
Expected: FAIL — cannot find module `@/calc/quote`.

- [ ] **Step 4: Implement `src/calc/quote.ts`**

```ts
import type { Availability, QuoteInput, QuoteItem, QuoteResult, Warning } from "./types";
import { getPlan } from "./plans/registry";
import { basePremium } from "./base-premium";
import { ratePerThousandRiderPremium } from "./riders/rate-per-thousand";
import { fixedPlanRiderPremium } from "./riders/fixed-by-plan";
import { CANNOT_BUY, checkCombined, checkMonthlyMinimum, checkRiderInput, riderAvailability } from "./rules";

function fmt(n: number): string {
  return n.toLocaleString("en-US");
}

/** Pure function: QuoteInput → QuoteResult. `today` is injectable for tests. */
export function quote(input: QuoteInput, today: Date = new Date()): QuoteResult {
  const plan = getPlan(input.planCode);
  if (!plan) throw new Error(`Unknown plan: ${input.planCode}`);
  const { rates, rules } = plan;
  const warnings: Warning[] = [];
  const items: QuoteItem[] = [];

  // ---- base ----
  const baseName = `${rates.planName} ${input.variant}`;
  const inAgeRange = input.age >= rules.base.ageMin && input.age <= rules.base.ageMax;
  const bp = inAgeRange
    ? basePremium(rates, { variant: input.variant, sex: input.sex, age: input.age, sumAssured: input.sumAssured, mode: input.mode })
    : undefined;
  if (!bp) {
    items.push({ code: input.variant, name: baseName, amount: input.sumAssured, annual: 0, modal: 0, eligible: false, message: CANNOT_BUY });
    warnings.push({ level: "error", code: "BASE_AGE", message: `อายุรับประกัน ${rules.base.ageMin} - ${rules.base.ageMax} ปี` });
  } else {
    items.push({ code: input.variant, name: baseName, amount: input.sumAssured, annual: bp.annual, modal: bp.modal, eligible: true });
  }
  if (input.sumAssured < rules.base.saMin) {
    warnings.push({ level: "error", code: "BASE_SA_MIN", message: `จำนวนเงินเอาประกันภัยขั้นต่ำ ${fmt(rules.base.saMin)} บาท` });
  }

  // ---- riders ----
  const ctx = { age: input.age, baseSumAssured: input.sumAssured };
  const combined = checkCombined(rules, input.sumAssured, input.riders);
  for (const c of combined) warnings.push({ level: "error", code: c.code, message: c.message });

  for (const code of plan.riderOrder) {
    const ri = input.riders.find((r) => r.code === code);
    if (!ri) continue;
    const rule = rules.riders[code];
    const amount = ri.plan ?? ri.sumAssured ?? 0;
    const excludedBy = combined.find((c) => c.codes.includes(code));
    const message = excludedBy?.message ?? checkRiderInput(rules, rates, code, ctx, ri);
    if (message) {
      items.push({ code, name: rule.name, amount, annual: 0, modal: 0, eligible: false, message });
      continue;
    }
    const rider = rates.riders[code];
    const premium =
      rider.kind === "ratePerThousandByAgeClass"
        ? ratePerThousandRiderPremium(rates, code, { age: input.age, sumAssured: ri.sumAssured ?? 0, mode: input.mode })
        : fixedPlanRiderPremium(rates, code, { age: input.age, plan: ri.plan ?? 0, mode: input.mode });
    if (!premium) {
      items.push({ code, name: rule.name, amount, annual: 0, modal: 0, eligible: false, message: CANNOT_BUY });
      continue;
    }
    items.push({ code, name: rule.name, amount, annual: premium.annual, modal: premium.modal, eligible: true });
  }

  // ---- totals & global checks ----
  const totalAnnual = items.reduce((s, i) => s + i.annual, 0);
  const totalModal = items.reduce((s, i) => s + i.modal, 0);
  const mm = checkMonthlyMinimum(rules, input.mode, totalModal);
  if (mm) warnings.push(mm);

  const availability: Availability[] = plan.riderOrder.map((code) => riderAvailability(rules, rates, code, ctx));
  const expired = today.toISOString().slice(0, 10) > rates.expiresOn;

  return {
    items, totalAnnual, totalModal, warnings, availability,
    meta: { planName: rates.planName, version: rates.version, expiresOn: rates.expiresOn, expired },
  };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/calc/quote.test.ts`
Expected: PASS (9 tests). If `MEB.annual` for age 35 plan 1000 is 0 in the table, change that test's plan to 500.

- [ ] **Step 6: Run the whole suite**

Run: `npm test`
Expected: all green.

- [ ] **Step 7: Commit**

```bash
git add src/calc/plans/registry.ts src/calc/quote.ts tests/calc/quote.test.ts
git commit -m "feat(calc): plan registry and quote integrator for PLB

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 9: Golden tests against LibreOffice-recalculated Excel

**Prerequisite:** LibreOffice must be installed (`/Applications/LibreOffice.app`). The Homebrew wrapper `/opt/homebrew/bin/soffice` exists but the app was removed. Ask the user to run:
```bash
brew reinstall --cask libreoffice
```
If the user declines, skip Steps 3–5 and instead ask the user to fill 10 cases from `tests/golden/cases.json` in Excel and paste the `I19, I23, I24, I27, I32` values; write them into `tests/golden/plb.json` by hand with `"source": "excel-manual"`.

**Files:**
- Create: `scripts/make_golden.py`, `tests/golden/cases-plb.json`, `tests/golden/plb.json`, `tests/golden/plb.test.ts`

- [ ] **Step 1: Write `tests/golden/cases-plb.json`** — 60 cases: explicit edges + deterministic pseudo-random fill

```json
{
  "planCode": "PLB",
  "explicit": [
    { "variant": "PLB12", "age": 35, "sex": "M", "mode": "annual",  "sumAssured": 1000000, "riders": {} },
    { "variant": "PLB12", "age": 35, "sex": "M", "mode": "monthly", "sumAssured": 1000000, "riders": { "AP": 1000000, "ECARE": 500000, "MEB": 1000 } },
    { "variant": "PLB12", "age": 20, "sex": "F", "mode": "semi",    "sumAssured": 300000,  "riders": { "AP": 100000 } },
    { "variant": "PLB12", "age": 59, "sex": "M", "mode": "annual",  "sumAssured": 25000000,"riders": { "AP": 10000000 } },
    { "variant": "PLB05", "age": 45, "sex": "F", "mode": "monthly", "sumAssured": 349999,  "riders": { "MEB": 5000 } },
    { "variant": "PLB05", "age": 45, "sex": "F", "mode": "monthly", "sumAssured": 350000,  "riders": { "MEB": 5000 } },
    { "variant": "PLB10", "age": 30, "sex": "M", "mode": "semi",    "sumAssured": 499999,  "riders": { "ECARE": 100000 } },
    { "variant": "PLB10", "age": 30, "sex": "M", "mode": "semi",    "sumAssured": 500000,  "riders": { "ECARE": 100000 } },
    { "variant": "PLB15", "age": 58, "sex": "F", "mode": "annual",  "sumAssured": 699999,  "riders": { "AP": 123456, "ECARE": 234567 } },
    { "variant": "PLB15", "age": 58, "sex": "F", "mode": "annual",  "sumAssured": 700000,  "riders": { "AP": 123456, "ECARE": 234567 } },
    { "variant": "PLB12", "age": 40, "sex": "M", "mode": "monthly", "sumAssured": 999999,  "riders": { "MEB": 2000 } },
    { "variant": "PLB12", "age": 40, "sex": "M", "mode": "monthly", "sumAssured": 1000000, "riders": { "MEB": 2000 } },
    { "variant": "PLB12", "age": 35, "sex": "M", "mode": "annual",  "sumAssured": 300000,  "riders": { "AP": 1000000, "ECARE": 600000 } },
    { "variant": "PLB12", "age": 35, "sex": "F", "mode": "monthly", "sumAssured": 300000,  "riders": {} },
    { "variant": "PLB05", "age": 21, "sex": "M", "mode": "semi",    "sumAssured": 1234567, "riders": { "AP": 3456789, "ECARE": 1000000, "MEB": 3000 } }
  ],
  "random": { "seed": 20260903, "count": 45 }
}
```

- [ ] **Step 2: Write `scripts/make_golden.py`**

```python
#!/usr/bin/env python3
"""Generate tests/golden/plb.json by letting LibreOffice recalculate the company Excel file.

For each case: copy the workbook, write inputs into 'กรอกข้อมูล', batch-convert with
`soffice --headless` (forced recalculation via a private profile), read back outputs.
"""
import json
import random
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "ไฟล์คำนวน" / "Protection Life (PLB)_A2026-1_01042026.xlsx"
CASES = ROOT / "tests" / "golden" / "cases-plb.json"
OUT = ROOT / "tests" / "golden" / "plb.json"
SOFFICE = "/Applications/LibreOffice.app/Contents/MacOS/soffice"

SEX_TH = {"M": "ชาย", "F": "หญิง"}
MODE_TH = {"annual": "รายปี", "semi": "ราย 6 เดือน", "monthly": "รายเดือน"}
VARIANTS = ["PLB05", "PLB10", "PLB12", "PLB15"]
SA_POOL = [300000, 349999, 350000, 400000, 499999, 500000, 650000, 699999, 700000, 999999, 1000000, 1500000, 3000000, 20000000]
MEB_PLANS = [500, 1000, 2000, 3000, 4000, 5000]

PROFILE_XCU = """<?xml version="1.0" encoding="UTF-8"?>
<oor:items xmlns:oor="http://openoffice.org/2001/registry" xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
<item oor:path="/org.openoffice.Office.Calc/Formula/Load"><prop oor:name="OOXMLRecalcMode" oor:op="fuse"><value>0</value></prop></item>
</oor:items>
"""


def random_cases(seed, count):
    rng = random.Random(seed)
    cases = []
    for _ in range(count):
        age = rng.randint(20, 59)
        sa = rng.choice(SA_POOL)
        riders = {}
        if rng.random() < 0.6:
            riders["AP"] = rng.choice([100000, 250000, 500000, 1000000, 2000000, min(5 * sa, 10000000)])
        if rng.random() < 0.5:
            riders["ECARE"] = rng.choice([100000, 300000, 500000, 1000000])
        if rng.random() < 0.5:
            riders["MEB"] = rng.choice(MEB_PLANS)
        cases.append({
            "variant": rng.choice(VARIANTS), "age": age, "sex": rng.choice("MF"),
            "mode": rng.choice(["annual", "semi", "monthly"]), "sumAssured": sa, "riders": riders,
        })
    return cases


def write_inputs(case, path):
    wb = openpyxl.load_workbook(SRC)
    ws = wb["กรอกข้อมูล"]
    ws["F7"] = case["age"]
    ws["F8"] = SEX_TH[case["sex"]]
    ws["F9"] = MODE_TH[case["mode"]]
    ws["D19"] = case["variant"]
    ws["G19"] = case["sumAssured"]
    r = case["riders"]
    ws["G23"] = r.get("AP")
    ws["G24"] = r.get("ECARE")
    ws["G27"] = r.get("MEB", "ไม่ซื้อ")
    wb.save(path)


def read_outputs(path):
    wb = openpyxl.load_workbook(path, data_only=True)
    ws, cal = wb["กรอกข้อมูล"], wb["Cal"]
    def cell(c):
        v = ws[c].value
        return v if v is not None else 0
    return {
        "modal": {"BASE": cell("I19"), "AP": cell("I23"), "ECARE": cell("I24"), "MEB": cell("I27")},
        "annual": {"BASE": cal["G13"].value or 0, "AP": cal["G17"].value or 0, "ECARE": cal["G18"].value or 0, "MEB": cal["G21"].value or 0},
        "totalModal": cell("I32"),
        "monthlyMessage": ws["J32"].value,
    }


def main():
    if not Path(SOFFICE).exists():
        sys.exit(f"LibreOffice not found at {SOFFICE}. Run: brew reinstall --cask libreoffice")
    spec = json.loads(CASES.read_text(encoding="utf-8"))
    cases = spec["explicit"] + random_cases(spec["random"]["seed"], spec["random"]["count"])

    with tempfile.TemporaryDirectory() as tmp:
        tmp = Path(tmp)
        profile = tmp / "profile" / "user"
        profile.mkdir(parents=True)
        (profile / "registrymodifications.xcu").write_text(PROFILE_XCU, encoding="utf-8")
        indir, outdir = tmp / "in", tmp / "out"
        indir.mkdir(); outdir.mkdir()
        for i, c in enumerate(cases):
            write_inputs(c, indir / f"case{i:03}.xlsx")
        cmd = [SOFFICE, f"-env:UserInstallation=file://{tmp / 'profile'}", "--headless",
               "--convert-to", "xlsx", "--outdir", str(outdir)] + sorted(str(p) for p in indir.glob("*.xlsx"))
        subprocess.run(cmd, check=True, capture_output=True)
        results = []
        for i, c in enumerate(cases):
            got = read_outputs(outdir / f"case{i:03}.xlsx")
            results.append({"input": c, "expected": got})
    OUT.write_text(json.dumps({"source": "libreoffice-recalc", "sourceFile": SRC.name, "cases": results},
                              ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"wrote {OUT} with {len(results)} cases")


if __name__ == "__main__":
    main()
```

- [ ] **Step 3: Generate the golden file**

Run: `npm run golden`
Expected: `wrote .../tests/golden/plb.json with 60 cases`. Open the file and sanity-check case 0: `expected.modal.BASE` must be `5470` and `expected.annual.BASE` must be `5470`. If every expected value is `0`/`None`, LibreOffice did not recalculate — check that the profile path in the `-env:` argument has no spaces issue (the scratch path has none) and re-run.

- [ ] **Step 4: Write `tests/golden/plb.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { quote } from "@/calc/quote";
import golden from "./plb.json";
import type { PayMode, Sex, RiderInput } from "@/calc/types";

type Case = (typeof golden)["cases"][number];

function toInput(c: Case["input"]) {
  const riders: RiderInput[] = [];
  const r = c.riders as Record<string, number | undefined>;
  if (r.AP !== undefined) riders.push({ code: "AP", sumAssured: r.AP });
  if (r.ECARE !== undefined) riders.push({ code: "ECARE", sumAssured: r.ECARE });
  if (r.MEB !== undefined) riders.push({ code: "MEB", plan: r.MEB });
  return { planCode: "PLB", variant: c.variant, age: c.age, sex: c.sex as Sex, mode: c.mode as PayMode, sumAssured: c.sumAssured, riders };
}

/** Excel shows a text message instead of a number when a rider is excluded; treat text as 0. */
function num(v: unknown): number {
  return typeof v === "number" ? Math.round(v * 100) : 0;
}

describe(`golden vs Excel (${golden.source})`, () => {
  golden.cases.forEach((c, i) => {
    it(`case ${i}: ${c.input.variant} ${c.input.sex} ${c.input.age} ${c.input.mode} SA ${c.input.sumAssured} riders ${JSON.stringify(c.input.riders)}`, () => {
      const r = quote(toInput(c.input), new Date("2026-09-03"));
      const by = Object.fromEntries(r.items.map((it) => [it.code === c.input.variant ? "BASE" : it.code, it]));
      expect(by.BASE.modal).toBe(num(c.expected.modal.BASE));
      expect(by.BASE.annual).toBe(num(c.expected.annual.BASE));
      for (const code of ["AP", "ECARE", "MEB"] as const) {
        const expModal = num(c.expected.modal[code]);
        const got = by[code]?.modal ?? 0;
        expect(got, `${code} modal`).toBe(expModal);
      }
      expect(r.totalModal).toBe(num(c.expected.totalModal));
      const excelSaysLow = typeof c.expected.monthlyMessage === "string" && c.expected.monthlyMessage.length > 0;
      expect(r.warnings.some((w) => w.code === "MIN_MONTHLY")).toBe(excelSaysLow);
    });
  });
});
```

- [ ] **Step 5: Run the golden tests**

Run: `npx vitest run tests/golden`
Expected: PASS for all 60. For any failure, print the case, reproduce the same inputs in the Excel copy under `/tmp`, and decide whether the engine or the golden is wrong. **Do not change the engine to match a value you cannot explain from the Excel formulas.** Record unexplained discrepancies in `docs/superpowers/plans/2026-09-03-premium-calculator-plb.md` under "Open questions" for the user to check in real Excel.

- [ ] **Step 6: Commit**

```bash
git add scripts/make_golden.py tests/golden
git commit -m "test: golden tests for PLB against LibreOffice-recalculated Excel

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 10: Summary text for LINE

**Files:**
- Create: `src/lib/summary.ts`
- Test: `tests/calc/summary.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/calc/summary.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { quote } from "@/calc/quote";
import { summaryText } from "@/lib/summary";

describe("summaryText", () => {
  it("renders a compact Thai summary", () => {
    const input = { planCode: "PLB", variant: "PLB12", age: 35, sex: "M" as const, mode: "monthly" as const, sumAssured: 1_000_000,
      riders: [{ code: "AP", sumAssured: 1_000_000 }] };
    const text = summaryText(input, quote(input, new Date("2026-09-03")));
    expect(text).toBe([
      "โพรเทคชั่นไลฟ์ (PLB) PLB12",
      "เพศชาย อายุ 35 ปี ชำระรายเดือน",
      "- โพรเทคชั่นไลฟ์ (PLB) PLB12 ทุน 1,000,000 บาท: 492.30 บาท",
      "- สัญญาเพิ่มเติมอุบัติเหตุ (AP) ทุน 1,000,000 บาท: 270.00 บาท",
      "รวมเบี้ยต่องวด (รายเดือน): 762.30 บาท",
      "รวมเบี้ยรายปี: 8,470.00 บาท",
      "⚠ เบี้ยประกันภัยรายเดือนต่ำกว่า 1,000 บาท",
      "(ตารางเบี้ย A2026-1)",
    ].join("\n"));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/calc/summary.test.ts`
Expected: FAIL — cannot find module `@/lib/summary`.

- [ ] **Step 3: Implement `src/lib/summary.ts`**

```ts
import type { QuoteInput, QuoteResult } from "@/calc/types";
import { PAY_MODE_LABEL } from "@/calc/types";
import { formatBaht } from "@/calc/money";

export function summaryText(input: QuoteInput, result: QuoteResult): string {
  const lines: string[] = [];
  lines.push(`${result.meta.planName} ${input.variant}`);
  lines.push(`เพศ${input.sex === "M" ? "ชาย" : "หญิง"} อายุ ${input.age} ปี ชำระ${PAY_MODE_LABEL[input.mode]}`);
  for (const it of result.items) {
    const amount = it.code === "MEB" ? `แผน ${it.amount.toLocaleString("en-US")}` : `ทุน ${it.amount.toLocaleString("en-US")} บาท`;
    const value = it.eligible ? `${formatBaht(it.modal)} บาท` : (it.message ?? "-");
    lines.push(`- ${it.name} ${amount}: ${value}`);
  }
  lines.push(`รวมเบี้ยต่องวด (${PAY_MODE_LABEL[input.mode]}): ${formatBaht(result.totalModal)} บาท`);
  lines.push(`รวมเบี้ยรายปี: ${formatBaht(result.totalAnnual)} บาท`);
  for (const w of result.warnings) lines.push(`⚠ ${w.message}`);
  lines.push(`(ตารางเบี้ย ${result.meta.version})`);
  return lines.join("\n");
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/calc/summary.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/summary.ts tests/calc/summary.test.ts
git commit -m "feat: plain-text quote summary for LINE

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 11: UI — form, result panel, page

**Files:**
- Create: `src/components/QuoteForm.tsx`, `src/components/RiderRow.tsx`, `src/components/QuoteResultPanel.tsx`, `src/components/WarningList.tsx`, `src/components/CopySummaryButton.tsx`, `src/components/ExpiryBanner.tsx`
- Modify: `src/app/page.tsx`

No automated UI tests (per spec). Verify manually in Step 8.

- [ ] **Step 1: `src/components/WarningList.tsx`**

```tsx
import type { Warning } from "@/calc/types";

export function WarningList({ warnings }: { warnings: Warning[] }) {
  if (warnings.length === 0) return null;
  return (
    <ul className="space-y-2">
      {warnings.map((w) => (
        <li
          key={w.code + w.message}
          className={
            w.level === "error"
              ? "rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800"
              : "rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800"
          }
        >
          {w.message}
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 2: `src/components/ExpiryBanner.tsx`**

```tsx
export function ExpiryBanner({ expired, expiresOn, version }: { expired: boolean; expiresOn: string; version: string }) {
  if (!expired) return null;
  return (
    <div className="mb-4 rounded-md border border-red-400 bg-red-100 px-4 py-3 text-sm text-red-900">
      ตารางเบี้ยเวอร์ชัน {version} หมดอายุตั้งแต่ {expiresOn} กรุณาอัปเดตไฟล์ตารางเบี้ยจากบริษัท
    </div>
  );
}
```

- [ ] **Step 3: `src/components/CopySummaryButton.tsx`**

```tsx
"use client";
import { useState } from "react";

export function CopySummaryButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      window.prompt("คัดลอกข้อความด้านล่าง", text);
    }
  }
  return (
    <button type="button" onClick={copy} className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700">
      {copied ? "คัดลอกแล้ว ✓" : "คัดลอกสรุปส่ง LINE"}
    </button>
  );
}
```

- [ ] **Step 4: `src/components/RiderRow.tsx`**

```tsx
"use client";
import type { Availability } from "@/calc/types";

export interface RiderRowProps {
  availability: Availability;
  enabled: boolean;
  value: number | "";
  onToggle: (enabled: boolean) => void;
  onChange: (value: number | "") => void;
}

export function RiderRow({ availability: a, enabled, value, onToggle, onChange }: RiderRowProps) {
  const disabled = !a.eligible;
  const isPlan = a.plans !== undefined;
  return (
    <div className={`rounded-md border p-3 ${disabled ? "border-slate-200 bg-slate-100 text-slate-400" : "border-slate-300 bg-white"}`}>
      <label className="flex items-center gap-3">
        <input type="checkbox" className="h-4 w-4" checked={enabled && !disabled} disabled={disabled} onChange={(e) => onToggle(e.target.checked)} />
        <span className="flex-1 text-sm font-medium">{a.name}</span>
        <span className="text-xs">{a.ageRange}</span>
      </label>
      {disabled && <p className="mt-1 text-xs">{a.reason}</p>}
      {!disabled && enabled && (
        <div className="mt-2 flex items-center gap-2">
          {isPlan ? (
            <select className="rounded border px-2 py-1 text-sm" value={value} onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}>
              <option value="">เลือกแผน</option>
              {a.plans!.map((p) => (
                <option key={p} value={p}>{p.toLocaleString("en-US")}</option>
              ))}
            </select>
          ) : (
            <>
              <input
                type="number" inputMode="numeric" min={a.saMin} max={a.saMax} step={1000}
                className="w-40 rounded border px-2 py-1 text-sm" placeholder="ทุนประกัน"
                value={value} onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
              />
              <span className="text-xs text-slate-500">
                {a.saMin?.toLocaleString("en-US")} – {a.saMax?.toLocaleString("en-US")}
              </span>
            </>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: `src/components/QuoteForm.tsx`**

```tsx
"use client";
import type { Availability, PayMode, Sex } from "@/calc/types";
import { PAY_MODE_LABEL } from "@/calc/types";
import { RiderRow } from "./RiderRow";

export interface RiderState {
  enabled: boolean;
  value: number | "";
}
export interface FormState {
  planCode: string;
  variant: string;
  age: number | "";
  sex: Sex;
  mode: PayMode;
  sumAssured: number | "";
  riders: Record<string, RiderState>;
}

export interface QuoteFormProps {
  state: FormState;
  plans: { code: string; name: string }[];
  variants: { code: string; label: string }[];
  baseAgeRange: { min: number; max: number };
  baseSaMin: number;
  availability: Availability[];
  onChange: (next: FormState) => void;
}

export function QuoteForm({ state, plans, variants, baseAgeRange, baseSaMin, availability, onChange }: QuoteFormProps) {
  const set = (patch: Partial<FormState>) => onChange({ ...state, ...patch });
  const setRider = (code: string, patch: Partial<RiderState>) =>
    onChange({ ...state, riders: { ...state.riders, [code]: { ...(state.riders[code] ?? { enabled: false, value: "" }), ...patch } } });
  const num = (v: string): number | "" => (v === "" ? "" : Number(v));

  return (
    <form className="space-y-5" onSubmit={(e) => e.preventDefault()}>
      <div>
        <label className="block text-sm font-medium">แบบประกันหลัก</label>
        <select className="mt-1 w-full rounded border px-3 py-2" value={state.planCode} onChange={(e) => set({ planCode: e.target.value })}>
          {plans.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}
        </select>
        <select className="mt-2 w-full rounded border px-3 py-2" value={state.variant} onChange={(e) => set({ variant: e.target.value })}>
          {variants.map((v) => <option key={v.code} value={v.code}>{v.label}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-sm font-medium">อายุ</label>
          <input type="number" inputMode="numeric" min={baseAgeRange.min} max={baseAgeRange.max} className="mt-1 w-full rounded border px-3 py-2"
                 value={state.age} onChange={(e) => set({ age: num(e.target.value) })} />
          <p className="mt-1 text-xs text-slate-500">{baseAgeRange.min} - {baseAgeRange.max} ปี</p>
        </div>
        <div>
          <label className="block text-sm font-medium">เพศ</label>
          <select className="mt-1 w-full rounded border px-3 py-2" value={state.sex} onChange={(e) => set({ sex: e.target.value as Sex })}>
            <option value="M">ชาย</option>
            <option value="F">หญิง</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium">งวดชำระ</label>
          <select className="mt-1 w-full rounded border px-3 py-2" value={state.mode} onChange={(e) => set({ mode: e.target.value as PayMode })}>
            {(Object.keys(PAY_MODE_LABEL) as PayMode[]).map((m) => <option key={m} value={m}>{PAY_MODE_LABEL[m]}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium">จำนวนเงินเอาประกันภัย (สัญญาหลัก)</label>
        <input type="number" inputMode="numeric" min={baseSaMin} step={10000} className="mt-1 w-full rounded border px-3 py-2"
               value={state.sumAssured} onChange={(e) => set({ sumAssured: num(e.target.value) })} />
        <p className="mt-1 text-xs text-slate-500">ขั้นต่ำ {baseSaMin.toLocaleString("en-US")} บาท</p>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">สัญญาเพิ่มเติม</p>
        {availability.map((a) => (
          <RiderRow
            key={a.code}
            availability={a}
            enabled={state.riders[a.code]?.enabled ?? false}
            value={state.riders[a.code]?.value ?? ""}
            onToggle={(enabled) => setRider(a.code, { enabled })}
            onChange={(value) => setRider(a.code, { value })}
          />
        ))}
      </div>
    </form>
  );
}
```

- [ ] **Step 6: `src/components/QuoteResultPanel.tsx`**

```tsx
import type { QuoteResult, PayMode } from "@/calc/types";
import { PAY_MODE_LABEL } from "@/calc/types";
import { formatBaht } from "@/calc/money";
import { WarningList } from "./WarningList";
import { CopySummaryButton } from "./CopySummaryButton";

export function QuoteResultPanel({ result, mode, summary }: { result: QuoteResult; mode: PayMode; summary: string }) {
  return (
    <section className="space-y-4">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-slate-500">
            <th className="py-2">รายการ</th>
            <th className="py-2 text-right">ทุน / แผน</th>
            <th className="py-2 text-right">เบี้ยรายปี</th>
            <th className="py-2 text-right">เบี้ย{PAY_MODE_LABEL[mode]}</th>
          </tr>
        </thead>
        <tbody>
          {result.items.map((it) => (
            <tr key={it.code} className="border-b">
              <td className="py-2">
                {it.name}
                {it.message && <div className="text-xs text-red-600">{it.message}</div>}
              </td>
              <td className="py-2 text-right">{it.amount.toLocaleString("en-US")}</td>
              <td className="py-2 text-right tabular-nums">{it.eligible ? formatBaht(it.annual) : "-"}</td>
              <td className="py-2 text-right tabular-nums">{it.eligible ? formatBaht(it.modal) : "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="rounded-lg bg-emerald-50 p-4">
        <div className="text-sm text-emerald-800">รวมเบี้ยต่องวด ({PAY_MODE_LABEL[mode]})</div>
        <div className="text-3xl font-semibold tabular-nums text-emerald-900">{formatBaht(result.totalModal)} บาท</div>
        <div className="mt-1 text-sm text-emerald-800">รวมเบี้ยรายปี {formatBaht(result.totalAnnual)} บาท</div>
      </div>

      <WarningList warnings={result.warnings} />
      <CopySummaryButton text={summary} />
      <p className="text-xs text-slate-400">ตารางเบี้ยเวอร์ชัน {result.meta.version} ใช้ได้ถึง {result.meta.expiresOn}</p>
    </section>
  );
}
```

- [ ] **Step 7: `src/app/page.tsx`**

```tsx
"use client";
import { useMemo, useState } from "react";
import { quote } from "@/calc/quote";
import { getPlan, listPlans } from "@/calc/plans/registry";
import type { QuoteInput, RiderInput } from "@/calc/types";
import { QuoteForm, type FormState } from "@/components/QuoteForm";
import { QuoteResultPanel } from "@/components/QuoteResultPanel";
import { ExpiryBanner } from "@/components/ExpiryBanner";
import { summaryText } from "@/lib/summary";

const INITIAL: FormState = {
  planCode: "PLB", variant: "PLB12", age: 35, sex: "M", mode: "annual", sumAssured: 1_000_000, riders: {},
};

function toQuoteInput(s: FormState): QuoteInput | null {
  if (s.age === "" || s.sumAssured === "") return null;
  const riders: RiderInput[] = [];
  const plan = getPlan(s.planCode);
  if (!plan) return null;
  for (const code of plan.riderOrder) {
    const r = s.riders[code];
    if (!r?.enabled || r.value === "") continue;
    const isPlan = plan.rates.riders[code]?.kind === "fixedByAgePlan";
    riders.push(isPlan ? { code, plan: r.value } : { code, sumAssured: r.value });
  }
  return { planCode: s.planCode, variant: s.variant, age: s.age, sex: s.sex, mode: s.mode, sumAssured: s.sumAssured, riders };
}

export default function Home() {
  const [state, setState] = useState<FormState>(INITIAL);
  const plan = getPlan(state.planCode)!;
  const input = useMemo(() => toQuoteInput(state), [state]);
  const result = useMemo(() => (input ? quote(input) : null), [input]);
  const summary = useMemo(() => (input && result ? summaryText(input, result) : ""), [input, result]);

  // availability for the form must exist even when the input is incomplete
  const availability = useMemo(() => {
    const probe: QuoteInput = { ...INITIAL, ...state, age: state.age === "" ? plan.rules.base.ageMin : state.age,
      sumAssured: state.sumAssured === "" ? plan.rules.base.saMin : state.sumAssured, riders: [] };
    return quote(probe).availability;
  }, [state, plan]);

  return (
    <main className="mx-auto max-w-5xl p-4 sm:p-6">
      <h1 className="mb-1 text-2xl font-semibold">คำนวณเบี้ยประกัน</h1>
      <p className="mb-4 text-sm text-slate-500">{plan.rates.planName} · ตารางเบี้ย {plan.rates.version}</p>
      <ExpiryBanner expired={result?.meta.expired ?? false} expiresOn={plan.rates.expiresOn} version={plan.rates.version} />
      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-lg border bg-white p-4">
          <QuoteForm
            state={state}
            plans={listPlans()}
            variants={plan.rates.base.variants.map((v) => ({ code: v, label: plan.variantLabels[v] ?? v }))}
            baseAgeRange={{ min: plan.rules.base.ageMin, max: plan.rules.base.ageMax }}
            baseSaMin={plan.rules.base.saMin}
            availability={availability}
            onChange={setState}
          />
        </div>
        <div className="rounded-lg border bg-white p-4">
          {result && input ? (
            <QuoteResultPanel result={result} mode={input.mode} summary={summary} />
          ) : (
            <p className="text-sm text-slate-500">กรอกอายุและจำนวนเงินเอาประกันภัยเพื่อคำนวณ</p>
          )}
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 8: Run and verify manually**

Run: `npm run dev` and open http://localhost:3000. Check:
1. Default shows PLB12 male 35 SA 1,000,000 annual → base 5,470.00, total 5,470.00.
2. Switch to รายเดือน → base 492.30 and a red warning "เบี้ยประกันภัยรายเดือนต่ำกว่า 1,000 บาท".
3. Enable AP 1,000,000 + ECARE 500,000 + MEB 1000 (monthly) → four rows, total = sum.
4. Set SA 300,000, AP 1,000,000, ECARE 600,000 → both rows show "AP+ECARE เกิน 5 เท่าของสัญญาหลัก", excluded from total.
5. Age 15 → ECARE row greyed with "16 - 60 ปี" and "ไม่สามารถซื้อได้"; base shows ineligible + warning "อายุรับประกัน 20 - 59 ปี".
6. Age 12 → MEB plan dropdown offers only 500 and 1,000.
7. Click "คัดลอกสรุปส่ง LINE" → clipboard has the multi-line summary.
8. Resize to 375px wide → columns stack, nothing overflows horizontally.

- [ ] **Step 9: Lint and build**

Run: `npm run lint && npm run build`
Expected: no errors.

- [ ] **Step 10: Commit**

```bash
git add src/app src/components
git commit -m "feat(ui): single-page premium calculator for PLB

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 12: Deploy to Vercel

**Files:** none new (Vercel reads the repo).

- [ ] **Step 1: Ask the user to connect the GitHub repo in Vercel**

Vercel deploy is an outward-facing action; the user does it:
1. Open https://vercel.com/new, import `pheerapatpisitdev/insurance-ai-assistant`.
2. Framework preset: Next.js (auto). No environment variables needed.
3. Deploy. Note the URL.

Alternative if the user prefers CLI and approves: `npx vercel --prod` (requires `vercel login`).

- [ ] **Step 2: Smoke-test the deployed URL**

Open the URL on a phone and repeat manual checks 1, 2, 4 from Task 11 Step 8.

- [ ] **Step 3: Record the URL**

Append to `docs/superpowers/specs/2026-09-03-premium-calculator-design.md` a line under section 9: `Deployed: <url> (2026-MM-DD)`. Commit:
```bash
git add docs && git commit -m "docs: record production URL

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
git push
```

---

## After this plan

Each remaining plan (iShield, ไลฟ์เทรเชอร์, ไอสมาร์ท 80-6, Life Protect Plus 9/19/99) gets its own plan document following the same shape: (1) extract facts table from its Excel file, (2) extend `extract_rates.py` with a per-plan function, (3) add new rider kinds under `src/calc/riders/` only when a table shape is genuinely new (e.g. iHealthy Ultra by sex × age × plan, WPD/WPDD by payer age), (4) rules JSON, (5) register in `registry.ts`, (6) golden cases. The engine, UI and tests above must not need structural changes for that; if they do, fix the structure in that plan rather than special-casing.
