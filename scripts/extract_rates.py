#!/usr/bin/env python3
"""Extract rate tables from the company Excel proposal files into data/rates/<plan>.json.

Deterministic: running twice on the same Excel files yields byte-identical JSON.
Never edit data/rates/*.json by hand; edit this script and re-run `npm run extract`.
"""
import json
import sys
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parents[1]
XLSX_DIR = ROOT / "ไฟล์คำนวน"
OUT_DIR = ROOT / "data" / "rates"
MODE_MAP = {"รายปี": "annual", "ราย 6 เดือน": "semi", "รายเดือน": "monthly"}


def cell(ws, r, c):
    return ws.cell(r, c).value


def write_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"wrote {path} ({path.stat().st_size} bytes)")


def mode_factors(cal):
    """Cal!I2:J5 — Thai mode label → factor."""
    out = {MODE_MAP[cell(cal, r, 9)]: cell(cal, r, 10) for r in range(2, 6) if cell(cal, r, 9) in MODE_MAP}
    assert set(out) == {"annual", "semi", "monthly"}, out
    return out


def age_class_table(ws, first_row, last_row):
    """Rows first..last: col A = age, cols B..E = occupation classes 1..4."""
    out = {}
    for r in range(first_row, last_row + 1):
        age = cell(ws, r, 1)
        assert isinstance(age, (int, float)), f"{ws.title} row {r}: bad age {age!r}"
        out[str(int(age))] = [cell(ws, r, c) for c in range(2, 6)]
    return out


def meb_table(ws, header_row, first_row, last_row):
    """Header row: plans in B..G; rows: col A = age, B..G = fixed annual premium (0 = not offered)."""
    plans = [cell(ws, header_row, c) for c in range(2, 8)]
    prem = {str(int(cell(ws, r, 1))): [cell(ws, r, c) for c in range(2, 8)] for r in range(first_row, last_row + 1)}
    return plans, prem


# --------------------------------------------------------------------------- PLB
def extract_plb():
    src = XLSX_DIR / "Protection Life (PLB)_A2026-1_01042026.xlsx"
    wb = openpyxl.load_workbook(src, data_only=True)
    inp, cal, pm = wb["กรอกข้อมูล"], wb["Cal"], wb["Premium&Maturity"]
    variants = ["PLB05", "PLB10", "PLB12", "PLB15"]
    meta = {
        "planCode": "PLB",
        "planName": f"{inp['E61'].value} (PLB)",
        "version": inp["E59"].value,
        "effectiveText": inp["E58"].value,
        "expiresOn": inp["G58"].value.strftime("%Y-%m-%d"),
        "sourceFile": src.name,
    }
    # base rates: Premium&Maturity N1:V59, sheet row == age
    header = {cell(pm, 1, c): c for c in range(14, 23)}
    rates = {}
    for v in variants:
        rates[v] = {}
        for sex in "MF":
            col = header[f"{v}{sex}"]
            table = {}
            for r in range(2, 60):
                val = cell(pm, r, col)
                if val is not None:
                    assert cell(pm, r, 14) == r, f"age column mismatch at row {r}"
                    table[str(r)] = val
            assert len(table) == 40, f"{v}{sex}: expected 40 ages, got {len(table)}"
            rates[v][sex] = table
    # discount: Cal A27:K31
    disc_header = {cell(cal, 27, c): c for c in range(2, 12)}
    thresholds = [cell(cal, r, 1) for r in range(28, 32)]
    by_variant = {v: [cell(cal, r, disc_header[v]) for r in range(28, 32)] for v in variants}
    ap = age_class_table(wb["AP"], 7, 67)        # ages 0..60
    ecare = age_class_table(wb["ECARE"], 7, 51)  # ages 16..60
    meb_plans, meb = meb_table(wb["MEB"], 6, 7, 75)  # ages 6..74
    assert len(ap) == 61 and len(ecare) == 45 and len(meb) == 69
    out = {
        **meta,
        "modeFactors": mode_factors(cal),
        "base": {"variants": variants, "rates": rates},
        "discount": {"thresholds": thresholds, "byVariant": by_variant},
        "riders": {
            "AP": {"kind": "ratePerThousandByAgeClass", "rates": ap},
            "ECARE": {"kind": "ratePerThousandByAgeClass", "rates": ecare},
            "MEB": {"kind": "fixedByAgePlan", "plans": meb_plans, "premiums": meb},
        },
    }
    write_json(OUT_DIR / "plb.json", out)


# ----------------------------------------------------------------------- iShield
def extract_ishield():
    src = XLSX_DIR / "iShield_A2026-1_01042026.xlsx"
    wb = openpyxl.load_workbook(src, data_only=True)
    inp, cal, pm, rr, pb = wb["กรอกข้อมูล"], wb["Cal"], wb["Premium&Maturity"], wb["Rate Rider"], wb["Rate PB"]
    variants = ["WLCI05", "WLCI10", "WLCI15", "WLCI20"]
    meta = {
        "planCode": "ISHIELD",
        "planName": inp["E59"].value,
        "version": inp["E58"].value,
        "effectiveText": inp["E57"].value,
        "expiresOn": inp["G57"].value.strftime("%Y-%m-%d"),
        "sourceFile": src.name,
    }
    # base: Premium&Maturity header row 2 cols P..W, sheet row = age + 3
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
                    assert cell(pm, r, 15) == r - 3, f"age column mismatch at row {r}"
                    table[str(r - 3)] = val
            assert len(table) == 57, (v, sex, len(table))
            rates[v][sex] = table
    # discount Cal A23:R29 (WLCI columns are all zero)
    disc_header = {cell(cal, 23, c): c for c in range(2, 19)}
    thresholds = [cell(cal, r, 1) for r in range(24, 30)]
    by_variant = {v: [cell(cal, r, disc_header[v]) or 0 for r in range(24, 30)] for v in variants}
    # AP / ECARE flat by occupation class: Rate Rider AB3:AD6
    ap = [cell(rr, r, 29) for r in range(3, 7)]
    ecare = [cell(rr, r, 30) for r in range(3, 7)]
    # MEB: Rate Rider A4:G73 (ages 6..74)
    meb_plans, meb = meb_table(rr, 4, 5, 73)
    assert len(meb) == 69
    # PLS: Rate Rider X3:Z257, key "PLS10-35", col Y = M, col Z = F
    pls_variants = ["PLS05", "PLS10", "PLS12", "PLS15"]
    pls = {v: {"M": {}, "F": {}} for v in pls_variants}
    for r in range(3, 258):
        key = cell(rr, r, 24)
        if not isinstance(key, str) or "-" not in key:
            continue
        code, age = key.split("-")
        if code in pls:
            pls[code]["M"][age] = cell(rr, r, 25)
            pls[code]["F"][age] = cell(rr, r, 26)
    for v in pls_variants:
        assert len(pls[v]["M"]) == 40 and len(pls[v]["F"]) == 40, v
    # PB: Rate PB. Parent block rows 5..227 (header row 4), spouse block rows 231..437 (header row 230).
    # Keep waive periods 3..20: pay terms are 5..20 and parent period = MIN(payTerm, 25-age) <= 20.
    def pb_block(first, last, header_row):
        periods = {c: cell(pb, header_row, c) for c in range(6, 87) if isinstance(cell(pb, header_row, c), (int, float))}
        out = {}
        for r in range(first, last + 1):
            code, sex, age = cell(pb, r, 1), cell(pb, r, 2), cell(pb, r, 4)
            if not isinstance(age, (int, float)) or sex not in ("M", "F"):
                continue
            row = {str(int(p)): cell(pb, r, c) for c, p in periods.items() if p <= 20 and cell(pb, r, c) is not None}
            if row:
                out.setdefault(code, {}).setdefault(sex, {})[str(int(age))] = row
        return out

    pb_rates = pb_block(5, 227, 4)
    pb_rates.update(pb_block(231, 437, 230))
    assert set(pb_rates) == {"PBPDD", "PBPDDCI", "PBSDD", "PBSDDCI"}, set(pb_rates)
    out = {
        **meta,
        "modeFactors": mode_factors(cal),
        "base": {"variants": variants, "payTerm": {v: int(v[-2:]) for v in variants}, "rates": rates},
        "discount": {"thresholds": thresholds, "byVariant": by_variant},
        "riders": {
            "PB": {
                "kind": "payorBenefit",
                "rates": pb_rates,
                "options": {
                    "FIT": {"name": inp["I68"].value, "parent": inp["K68"].value, "spouse": inp["K70"].value},
                    "BEYOND": {"name": inp["I69"].value, "parent": inp["K69"].value, "spouse": inp["K71"].value},
                },
            },
            "AP": {"kind": "flatRateByClass", "rates": ap},
            "ECARE": {"kind": "flatRateByClass", "rates": ecare},
            "MEB": {"kind": "fixedByAgePlan", "plans": meb_plans, "premiums": meb},
            "PLS": {
                "kind": "ratePerThousandByVariantAgeSex",
                "variants": pls_variants,
                "rates": pls,
                "discountThresholds": [500000, 1000000],
                "discountValues": [0.5, 1],
            },
        },
    }
    write_json(OUT_DIR / "ishield.json", out)


EXTRACTORS = {"plb": extract_plb, "ishield": extract_ishield}


def main(argv):
    names = argv or list(EXTRACTORS)
    for n in names:
        if n not in EXTRACTORS:
            sys.exit(f"unknown plan {n}; choose from {list(EXTRACTORS)}")
        EXTRACTORS[n]()


if __name__ == "__main__":
    main(sys.argv[1:])
