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
# The benefit sheet's own I4 ties the deductible to the plan number it reads from กรอกข้อมูล!R33:
# 1-2 → 30,000, 3-4 → 50,000, 5-6 → 100,000 — and the co-payment alternative is 20%.
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
