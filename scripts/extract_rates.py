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
    return ws.cell(r, c).value


def age_class_table(ws, first_row, last_row):
    """Rows first..last: col A = age, cols B..E = occupation classes 1..4."""
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
    expires = inp["G58"].value  # datetime
    meta = {
        "planCode": "PLB",
        "planName": f"{inp['E61'].value} (PLB)",
        "version": inp["E59"].value,
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
    ap = age_class_table(wb["AP"], 7, 67)        # ages 0..60
    ecare = age_class_table(wb["ECARE"], 7, 51)  # ages 16..60
    meb_ws = wb["MEB"]
    meb_plans = [cell(meb_ws, 6, c) for c in range(2, 8)]
    meb = {}
    for r in range(7, 76):                       # ages 6..74
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
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"wrote {OUT} ({OUT.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
