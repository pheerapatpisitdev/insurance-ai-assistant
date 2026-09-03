# Premium Calculator — W-family (ไอสมาร์ท 80/6, ไลฟ์เทรเชอร์, ไลฟ์ โพรเทค+) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Add the last three Excel workbooks to the calculator, matching each to the satang.

**Architecture:** The three files are one family: identical sheet set, identical rider list, same `กรอกข้อมูล`/`Cal` layout (Life Protect Plus is shifted one row down and has more packages). One extractor with a per-file row offset produces three rate JSONs; the engine gains four rider kinds and the family's cross-rider rules; registry and UI are already generic.

**Tech Stack:** unchanged.

**Previous plans:** `2026-09-03-premium-calculator-plb.md`, `2026-09-03-premium-calculator-ishield.md`.

---

## Facts (established from the workbooks; do not re-derive)

Files, all version `A2026-1`, expiry 2027-03-31 (Life Protect Plus differs — read from its own cells):

| Plan code | File | Base plancodes (packages) |
|---|---|---|
| ISMART | `ไอสมาร์ท 80-6_A2026-1.xlsx` | `W80F06` (ชำระเบี้ย 6 ปี, issue 25–65) |
| LIFETREASURE | `ไลฟ์เทรเชอร์_A2026-1.xlsx` | `H99F06A` / `H99F12A` / `H99F18A` (6/12/18 ปี, issue 0–70) |
| LIFEPROTECT | `Sales proposal_Life Protect Plus 9 19 99_…xlsx` | `WLF99L`, `WLF09H`, `WLF19H`, `WLF99H`, `WLF99HX` ×2 packages (issue 0–80 / 6–80 / 6–70) |

**Input sheet (`กรอกข้อมูล`), iSmart/LifeTreasure rows; Life Protect Plus = +1:**

| Cell | Meaning |
|---|---|
| `C5` age, `C6` sex (ชาย/หญิง), `C7` mode | รายปี 1 / ราย 6 เดือน 0.52 / รายเดือน 0.09 (`Cal!I2:J5`) |
| `C11`, `C12` | payer age (20–70), payer sex |
| `C14` | package name → `A78:H83` gives seq (`I14`), plancode (`F78…`), pay term (`K14`) |
| `D19` | base sum assured; `F19` base modal premium; `F37` total |
| rows 20–36 col A | riders: PB, WP, AP, ECARE, MEX, MEB, DCI, PLS, CPR, HIC, iHealthy Ultra, Roke Rai So Shield, CI 123 (+3 mandatory CI 123 endorsements) |
| `E64` version, `G63` expiry, `E65` Thai name | |

**Base premium (`Cal!G13/H13`):** key = payTermCode + sex (e.g. `06F`); rate = `HLOOKUP(key, 'Premium&Maturity'!A2:C86, age+5)` — sheet row = age + 6, `-` means not issuable. `annual = ROUNDDOWN((rate - highSaDiscount) * ROUNDDOWN(SA/1000, 3), 2)`, `modal = ROUNDDOWN(annual * factor, 2)`. High-SA discount table `Cal!A28:E34` (thresholds 300k/500k/700k/1M/3M/5M, per plancode column).

**Rider premium formulas:**

| Rider | Rate source | Premium |
|---|---|---|
| PB (Fit `PBSDD`/`PBPDD`, Beyond `PBSDC`/`PBPDC` → PIP codes `PBSDDCI`/`PBPDDCI`) | `Rate PB` key plancode+sex+payerAge, col = waive period + 1; parent block rows 5–227 (header row 4), spouse rows 231–437 (header row 230) | `annual = TRUNC(rate × TRUNC(baseAnnual/100, 3), 2)`, `modal = TRUNC(annual × factor, 2)`; period = age ≤ 15 ? MIN(payTerm, 25−age) : payTerm |
| WP (Fit `WPTPD`, Beyond `WPTCI`) | `Rate WP` key plancode+sex+age; male block `A5:CF119` col = payTerm+1, female block `CH4:FM119` col = 86+payTerm | same shape as PB, driven by insured age |
| AP / ECARE | `Rate Rider!AB3:AD6` flat by occupation class | `ROUNDDOWN(rate × SA/1000, 2)` |
| MEB | `Rate Rider!A4:G73` (ages 6–74, plans 500…5000) | fixed annual; `modal = ROUNDDOWN(annual × factor, 2)` |
| MEX | `Rate rider_MEX!A5:K95` key sex+"-"+plan (1200…6200), row = age + 6 | fixed annual |
| DCI / PLS05-15 / CPR / HIC | `Rate Rider!X:Z` key `CODE-age`, col Y = M, Z = F. Rows: DCI 43–97 (20–74), PLS05 98–137, PLS10 138–177, PLS12 178–217, PLS15 218–257 (all 20–59), CPR 258–342 (0–84), HIC 343–427 (0–84) | `ROUNDDOWN((rate − disc) × SA/1000, 2)`; PLS disc 0.5 at 500k, 1 at 1M; HIC uses `ROUND` not `ROUNDDOWN` |
| iHealthy Ultra | `iHealthy Ultra Rate` row 9 header `<MHPkey>-<sex>`, row = age + 13 | fixed annual. Key = `MHP` + coverageLetter + planNo + (age<11 ? `J` : `S`) + territoryLetter, trimmed. planNo: Smart 1, Bronze 2, Silver 3, Gold 4, Diamond 5, Platinum 6. territory: ประเทศไทย ``, เอเชีย `A`, ทั่วโลก `W`. coverage: Full ``, Deductible `D`, Co-Payment `C` |
| Roke Rai So Shield | `CI MED EX RATE` row 9 header `MCI<n>-<sex>`, row = age + 13 | fixed annual. แผน S/M/L/XL → MCI1/2/3/4 |
| CI 123 | `Rate CI 123!F4:DB15` key `<component>-<sex>`, col = age + 7 | six components, each `TRUNC(rate × TRUNC(componentSA/1000, 3), 2)`; component SAs from the main CI 123 SA: Major 100 %, Critical Care 25 %, Juvenile 25 %, Pre-Early MIN(20 %, 100 000), Early-to-Intermediate 25 %, Special conditions 10 %. Rows shown to the user: CI 123 = Major+CriticalCare+Juvenile; the three endorsements are Pre-Early, Early-to-Intermediate, Special conditions. Whole block is void when its annual total < 1 000 |

**Cross-rider rules:**
- PB and WP are mutually exclusive (`กรุณาเลือก WP หรือ PB อย่างใดอย่างหนึ่ง`).
- AP: age ≤ 60, min 100 000, max age < 16 → MIN(3 000 000, 2×SA) else MIN(5×SA, 10 000 000).
- ECARE: 16–60, min 100 000, max MIN(10 000 000, 5×SA). `AP+ECARE เกินกว่าที่กำหนด` when the pair exceeds MIN(5×SA, 10 000 000).
- MEB 6–65 with the usual plan bands; MEX 0–70, plans 1200/2200/3200 under age 11, up to 6200 from 11.
- DCI 20–65 min 200 000; CPR 0–65 min 300 000 max MIN(5 000 000, 5×SA); `DCI+CPR เกินกว่าที่กำหนด` above 10 000 000; CPR cannot be bought with DCI.
- HIC needs CPR and excludes MEX, MEB and iHealthy Ultra.
- PLS 20–59, min 300 000, max 5×SA.
- iHealthy Ultra 6–80; plan/territory combination validated (`M29`): under 11 only Smart/Bronze in Thailand; 11+ Smart/Bronze/Silver/Gold in Thailand, Diamond/Platinum in any territory.
- Package restrictions by `I14` sequence: packages ≥ 5 drop PB, WP, ECARE, PLS, CPR, HIC and force iHealthy Ultra (seq 5) or MEX (seq 6).
- Total is 0 when the base plan is not covered, or the package's mandatory health rider is missing.

---

### Task 1: Extract the three rate files

**Files:** modify `scripts/extract_rates.py`; create `data/rates/{ismart,lifetreasure,lifeprotect}.json`; test `tests/calc/rates-w-family.test.ts`

- [x] Add `extract_w_family(plan_code, filename, row_offset)` covering every table in the Facts section, plus the package table and the iHealthy Ultra plan/territory maps.
- [x] Assert row/column counts for each table so a layout change fails loudly.
- [x] Test pins: base rate for a known age, one rate from every rider table, package list, iHealthy key map.
- [x] `npm run extract` → determinism diff → commit.

### Task 2: Engine — four new rider kinds

**Files:** `src/calc/types.ts`, `src/calc/lookup.ts`, `src/calc/riders/premium-based.ts` (generalises `payor-benefit.ts`), `src/calc/riders/fixed-by-key-age.ts`, `src/calc/riders/composite-ci.ts`; tests `tests/calc/riders-w-family.test.ts`

- [x] `premiumBased` — PB and WP: rate keyed by (plancode, sex, age) and waive period; premium from the base annual premium via `TRUNC`.
- [x] `fixedByKeyAge` — MEX, iHealthy Ultra, Roke Rai So Shield: `{key: {sex: {age: premium}}}` plus a key-builder descriptor in the JSON.
- [x] `compositeCI` — six components with derived sums assured and a minimum-premium gate.
- [x] Reuse `ratePerThousandByVariantAgeSex` for DCI/PLS/CPR/HIC (add a `rounding: "round" | "roundDown"` field for HIC).

### Task 3: Rules and quote wiring

**Files:** `data/rules/{ismart,lifetreasure,lifeprotect}.json`, `src/calc/rules.ts`, `src/calc/quote.ts`, `src/calc/plans/registry.ts`; tests `tests/calc/quote-w-family.test.ts`

- [x] Express every cross-rider rule from the Facts section as data, not code.
- [x] Package selection becomes the plan "variant"; variants carry issue-age range, pay term and mandatory riders.
- [x] Register the three plans with rider order matching the Excel row order.

### Task 4: UI

**Files:** `src/components/QuoteForm.tsx`, `RiderRow.tsx`, `src/app/page.tsx`

- [x] iHealthy Ultra needs plan + territory + coverage selects; CI 123 needs one sum assured and shows four rows.
- [x] Mandatory riders for a package are pre-ticked and cannot be turned off.

### Task 5: Golden tests, one plan at a time

**Files:** `scripts/make_golden.py`, `tests/golden/cases-{plan}.json`, `tests/golden/{plan}.json`, `tests/golden/{plan}.test.ts`

- [~] 60 cases per plan (iSmart generating; ไลฟ์เทรเชอร์ and LPP cases written, runs queued). Life Protect Plus is 7.5 MB with very large `TABCV` sheets — expect a long run; reduce to 30 cases if a run exceeds an hour.
- [ ] Run each generation with `run_in_background`, never in the foreground.

### Task 6: Merge and deploy

- [ ] Merge to `main`. Production deploys are currently BLOCKED by Vercel account configuration — the user must clear that before the site updates.
