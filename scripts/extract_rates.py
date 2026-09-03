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


# --------------------------------------------------------------------- W family
# ไอสมาร์ท 80/6, ไลฟ์เทรเชอร์ and ไลฟ์ โพรเทค+ share one workbook layout: the same
# sheets, the same rider list and the same Cal formulas. Only row positions on the
# input sheet, the Premium&Maturity sheet name and the package list differ, so every
# anchor below is found by label rather than hard-coded.

W_FAMILY = {
    "ISMART": "ไอสมาร์ท 80-6_A2026-1.xlsx",
    "LIFETREASURE": "ไลฟ์เทรเชอร์_A2026-1.xlsx",
    "LIFEPROTECT": "Sales proposal_Life Protect Plus 9 19 99_2026821_update benefit graph.xlsx",
}
IHU_PLAN_NO = {"SMART": 1, "BRONZE": 2, "SILVER": 3, "GOLD": 4, "DIAMOND": 5, "PLATINUM": 6}
IHU_TERRITORY = {"ประเทศไทย": "", "เอเชีย": "A", "ทั่วโลก": "W"}
IHU_COVERAGE = {"Full Coverage": "", "Deductible": "D", "Co-Payment": "C"}
RRSS_PLAN_NO = {"แผน S": 1, "แผน M": 2, "แผน L": 3, "แผน XL": 4}
CI123_COMPONENTS = [
    # (component key in 'Rate CI 123', share of the CI 123 sum assured, cap)
    ("Major CI", 1.0, None),
    ("Critical Care Benefit", 0.25, None),
    ("Juvenile CI", 0.25, None),
    ("Pre-Early CI", 0.20, 100000),
    ("Early to Intermediate CI", 0.25, None),
    ("Special conditions", 0.10, None),
]


def find_row(ws, label, col=1, first=1, last=140):
    for r in range(first, last + 1):
        v = ws.cell(r, col).value
        if isinstance(v, str) and v.strip() == label:
            return r
    raise AssertionError(f"{ws.title}: label {label!r} not found in column {col}")


def keyed_age_table(ws, header_row, first_row, last_row, key_col_offset=0, first_col=2):
    """Header row holds '<key>-<sex>' labels; each following row is one age (row = age + first_row)."""
    out = {}
    for c in range(first_col, ws.max_column + 1):
        head = ws.cell(header_row, c).value
        if not isinstance(head, str) or "-" not in head:
            continue
        key, sex = head.rsplit("-", 1)
        key, sex = key.strip(), sex.strip()
        if sex not in ("M", "F"):
            continue
        table = {}
        for r in range(first_row, last_row + 1):
            v = ws.cell(r, c).value
            if isinstance(v, (int, float)) and v > 0:
                table[str(r - first_row)] = v
        if table:
            out.setdefault(key, {}).setdefault(sex, {}).update(table)
    return out


def rate_rider_key_block(ws, codes):
    """Rate Rider cols X/Y/Z: key '<CODE>-<age>', Y = male rate, Z = female rate."""
    out = {c: {"M": {}, "F": {}} for c in codes}
    for r in range(2, ws.max_row + 1):
        key = ws.cell(r, 24).value
        if not isinstance(key, str) or "-" not in key:
            continue
        code, age = key.rsplit("-", 1)
        if code in out and age.isdigit():
            out[code]["M"][age] = ws.cell(r, 25).value
            out[code]["F"][age] = ws.cell(r, 26).value
    return out


def extract_w_family(plan_code, filename):
    src = XLSX_DIR / filename
    wb = openpyxl.load_workbook(src, data_only=True)
    inp, cal = wb["กรอกข้อมูล"], wb["Cal"]
    pm_name = next(n for n in wb.sheetnames if n.startswith("Premium&Maturity"))
    pm, rr, pb, wp = wb[pm_name], wb["Rate Rider"], wb["Rate PB"], wb["Rate WP"]

    # --- metadata (label anchors, because row positions differ per file) ---
    eff_row = find_row(inp, "Effective Date", col=4, first=40, last=90)
    meta = {
        "planCode": plan_code,
        "planName": cell(inp, eff_row + 2, 5),
        "version": cell(inp, eff_row + 1, 5),
        "effectiveText": cell(inp, eff_row, 5),
        "expiresOn": cell(inp, eff_row, 7).strftime("%Y-%m-%d"),
        "sourceFile": src.name,
    }

    # --- packages: the plan's "variants" (Premium Payment Term table) ---
    # ไลฟ์ โพรเทค+ sells the same payment terms under two products ("+50" and "+100"), so the
    # workbook keys its package table on payment-term name + booster. Read that map, and read
    # the Payment Year column as a *formula* because "ครบอายุ 99 ปี" is 99 − age, not a constant.
    inp_f = openpyxl.load_workbook(src)["กรอกข้อมูล"]
    pkg_row = find_row(inp, "Premium Payment Term", col=1, first=40, last=110)
    # The product map (Thai name, English name, booster) sits above the package table; stop
    # before that table, whose own columns G and I would otherwise overwrite these entries.
    boosters = {}
    for r in range(55, pkg_row):
        name, factor = cell(inp, r, 7), cell(inp, r, 9)
        if isinstance(name, str) and isinstance(factor, (int, float)):
            boosters[factor] = name.strip()
    plancode_to_term = {}
    for r in range(27, 40):
        code, term = cell(cal, r, 14), cell(cal, r, 15)
        if isinstance(code, str) and term is not None:
            plancode_to_term[code] = str(term)
    packages = []
    for r in range(pkg_row + 1, pkg_row + 12):
        name, plancode = cell(inp, r, 1), cell(inp, r, 6)
        if not isinstance(name, str) or not isinstance(plancode, str) or plancode not in plancode_to_term:
            continue
        booster = cell(inp, r, 9)
        term_formula = inp_f.cell(r, 8).value
        pkg = {
            "code": f"{plancode}#{len(packages)}" if any(p["plancode"] == plancode for p in packages) else plancode,
            "plancode": plancode,
            "name": name.strip(),
            "ageMin": cell(inp, r, 3),
            "ageMax": cell(inp, r, 4),
            "seq": cell(inp, r, 5),
            "payTerm": cell(inp, r, 8),
            "rateKey": plancode_to_term[plancode],
        }
        if isinstance(term_formula, str) and term_formula.startswith("="):
            # e.g. "=99-$C$5": the premium-paying term runs to a fixed age
            digits = "".join(ch for ch in term_formula.split("-")[0] if ch.isdigit())
            if digits:
                pkg["payTermToAge"] = int(digits)
        if isinstance(booster, (int, float)):
            pkg["booster"] = booster
            if booster in boosters:
                pkg["productName"] = boosters[booster]
        packages.append(pkg)
    assert packages, f"{plan_code}: no packages found"

    # --- base rates: Premium&Maturity header row 2 = '<termCode><sex>', sheet row = age + 6 ---
    base_rates = {}
    for c in range(2, pm.max_column + 1):
        head = cell(pm, 2, c)
        if not isinstance(head, str) or len(head) < 2:
            continue
        term, sex = head[:-1], head[-1]
        if sex not in ("M", "F"):
            continue
        table = {}
        for r in range(6, 87):
            v = cell(pm, r, c)
            if isinstance(v, (int, float)):
                table[str(r - 6)] = v
        if table:
            base_rates.setdefault(term, {})[sex] = table
    for p in packages:
        assert p["rateKey"] in base_rates, f"{plan_code}: no base rates for {p['rateKey']}"

    # --- high sum-assured discount: Cal A27:E34, columns keyed by the rate key ---
    disc_header = {str(cell(cal, 27, c)): c for c in range(2, 7) if cell(cal, 27, c) is not None}
    disc_thresholds = [cell(cal, r, 1) for r in range(28, 34)]
    # iSmart hard-codes Cal!F13 = 0, i.e. the discount table is not applied.
    uses_discount = isinstance(openpyxl.load_workbook(src)["Cal"]["F13"].value, str)
    discount = {k: [cell(cal, r, c) or 0 for r in range(28, 34)] for k, c in disc_header.items()} if uses_discount else {}
    # Cal!F13 looks the discount column up by LEFT(rateKey, 2), so "19H" and "19L" share the "19" column.
    discount_prefix = 2

    # --- riders ---
    def pb_block(first, last, header_row):
        periods = {c: cell(pb, header_row, c) for c in range(6, 90) if isinstance(cell(pb, header_row, c), (int, float))}
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

    # WP: male block key in col A with periods from col D; female block key in col CH (86) with periods from col CK
    wp_rates = {}
    for key_col, first_period_col in ((1, 4), (86, 89)):
        for r in range(5, wp.max_row + 1):
            key = cell(wp, r, key_col)
            if not isinstance(key, str) or len(key) < 4:
                continue
            code, rest = key[:-3], key[-3:]
            sex, age = rest[0], rest[1:]
            if sex not in ("M", "F") or not age.isdigit():
                continue
            row = {}
            for c in range(first_period_col, first_period_col + 60):
                period = cell(wp, 4, c)
                v = cell(wp, r, c)
                if isinstance(period, (int, float)) and isinstance(v, (int, float)):
                    row[str(int(period))] = v
            if row:
                wp_rates.setdefault(code, {}).setdefault(sex, {})[age] = row
    assert wp_rates, f"{plan_code}: no WP rates"

    ap = [cell(rr, r, 29) for r in range(3, 7)]
    ecare = [cell(rr, r, 30) for r in range(3, 7)]
    meb_plans, meb = meb_table(rr, 4, 5, 73)
    key_rates = rate_rider_key_block(rr, ["DCI", "PLS05", "PLS10", "PLS12", "PLS15", "CPR", "HIC"])

    # MEX: 'Rate rider_MEX' row 5 = '<sex>-<plan>', rows 6.. = ages
    mex_ws = wb["Rate rider_MEX"]
    mex = {}
    mex_plans = []
    for c in range(2, 12):
        head = cell(mex_ws, 5, c)
        if not isinstance(head, str) or "-" not in head:
            continue
        sex, plan = head.split("-")
        if plan not in mex_plans:
            mex_plans.append(plan)
        for r in range(6, 96):
            age = cell(mex_ws, r, 1)
            v = cell(mex_ws, r, c)
            if isinstance(age, (int, float)) and isinstance(v, (int, float)) and v > 0:
                mex.setdefault(plan, {}).setdefault(sex, {})[str(int(age))] = v

    ihu = keyed_age_table(wb["iHealthy Ultra Rate"], 9, 13, 111)
    rrss = keyed_age_table(wb["CI MED EX RATE"], 9, 13, 111)

    # CI 123: 'Rate CI 123' key in col F, rates from col G (age 0) onwards
    ci_ws = wb["Rate CI 123"]
    ci_rates = {}
    for r in range(2, ci_ws.max_row + 1):
        head = cell(ci_ws, r, 6)
        if not isinstance(head, str) or "-" not in head:
            continue
        comp, sex = head.rsplit("-", 1)
        comp, sex = comp.strip(), sex.strip().upper()
        if sex not in ("M", "F"):
            continue
        table = {}
        for c in range(7, ci_ws.max_column + 1):
            v = cell(ci_ws, r, c)
            if isinstance(v, (int, float)):
                table[str(c - 7)] = v
        if table:
            ci_rates.setdefault(comp.lower(), {}).setdefault(sex, table)
    for comp, _, _ in CI123_COMPONENTS:
        assert comp.lower() in ci_rates, f"{plan_code}: CI 123 component {comp} missing"

    # Re-key the base rates and the discount by package code so the engine sees the same
    # shape as PLB/iShield: base.rates[variant][sex][age] and discount.byVariant[variant].
    rates_by_variant = {p["code"]: base_rates[p["rateKey"]] for p in packages}
    discount_by_variant = {p["code"]: discount.get(p["rateKey"][:discount_prefix], [0] * len(disc_thresholds)) for p in packages}

    out = {
        **meta,
        "modeFactors": mode_factors(cal),
        "base": {
            "variants": [p["code"] for p in packages],
            "packages": packages,
            "payTerm": {p["code"]: p["payTerm"] for p in packages if "payTermToAge" not in p},
            "payTermToAge": {p["code"]: p["payTermToAge"] for p in packages if "payTermToAge" in p},
            "rates": rates_by_variant,
        },
        "discount": {"thresholds": disc_thresholds, "byVariant": discount_by_variant},
        "riders": {
            "PB": {"kind": "premiumBased", "by": "payer", "rates": pb_rates,
                   "options": {"FIT": {"name": "สัญญาเพิ่มเติมพีบี ฟิต", "parent": "PBPDD", "spouse": "PBSDD"},
                               "BEYOND": {"name": "สัญญาเพิ่มเติมพีบี บียอนด์", "parent": "PBPDDCI", "spouse": "PBSDDCI"}}},
            "WP": {"kind": "premiumBased", "by": "insured", "rates": wp_rates,
                   "options": {"FIT": {"name": "สัญญาเพิ่มเติมดับบลิวพี ฟิต", "parent": "WPTPD", "spouse": "WPTPD"},
                               "BEYOND": {"name": "สัญญาเพิ่มเติมดับบลิวพี บียอนด์", "parent": "WPTPDCI", "spouse": "WPTPDCI"}}},
            "AP": {"kind": "flatRateByClass", "rates": ap},
            "ECARE": {"kind": "flatRateByClass", "rates": ecare},
            "MEB": {"kind": "fixedByAgePlan", "plans": meb_plans, "premiums": meb},
            "MEX": {"kind": "fixedByKeyAge", "keyBy": "plan", "plans": mex_plans, "rates": mex},
            "IHU": {"kind": "fixedByKeyAge", "keyBy": "ihealthyUltra", "rates": ihu,
                    "planNo": IHU_PLAN_NO, "territory": IHU_TERRITORY, "coverage": IHU_COVERAGE},
            "RRSS": {"kind": "fixedByKeyAge", "keyBy": "rokeRaiSoShield", "rates": rrss, "planNo": RRSS_PLAN_NO},
            "DCI": {"kind": "ratePerThousandByVariantAgeSex", "variants": ["DCI"], "rates": {"DCI": key_rates["DCI"]},
                    "discountThresholds": [], "discountValues": []},
            "PLS": {"kind": "ratePerThousandByVariantAgeSex", "variants": ["PLS05", "PLS10", "PLS12", "PLS15"],
                    "rates": {k: key_rates[k] for k in ("PLS05", "PLS10", "PLS12", "PLS15")},
                    "discountThresholds": [500000, 1000000], "discountValues": [0.5, 1]},
            "CPR": {"kind": "ratePerThousandByVariantAgeSex", "variants": ["CPR"], "rates": {"CPR": key_rates["CPR"]},
                    "discountThresholds": [], "discountValues": []},
            "HIC": {"kind": "ratePerThousandByVariantAgeSex", "variants": ["HIC"], "rates": {"HIC": key_rates["HIC"]},
                    "discountThresholds": [], "discountValues": [], "rounding": "round"},
            "CI123": {"kind": "compositeCI", "rates": ci_rates, "minAnnual": 1000,
                      "components": [{"key": k.lower(), "share": s, "cap": c} for k, s, c in CI123_COMPONENTS]},
        },
    }
    write_json(OUT_DIR / f"{plan_code.lower()}.json", out)


EXTRACTORS = {
    "plb": extract_plb,
    "ishield": extract_ishield,
    "ismart": lambda: extract_w_family("ISMART", W_FAMILY["ISMART"]),
    "lifetreasure": lambda: extract_w_family("LIFETREASURE", W_FAMILY["LIFETREASURE"]),
    "lifeprotect": lambda: extract_w_family("LIFEPROTECT", W_FAMILY["LIFEPROTECT"]),
}



def main(argv):
    names = argv or list(EXTRACTORS)
    for n in names:
        if n not in EXTRACTORS:
            sys.exit(f"unknown plan {n}; choose from {list(EXTRACTORS)}")
        EXTRACTORS[n]()


if __name__ == "__main__":
    main(sys.argv[1:])
