#!/usr/bin/env python3
"""Generate tests/golden/<plan>.json by letting LibreOffice recalculate the company Excel file.

Usage: python3 scripts/make_golden.py [plb|ishield ...]   (default: all)

For each case: copy the workbook, write inputs into 'กรอกข้อมูล', batch-convert with
`soffice --headless` (forced recalculation via a private profile), read back outputs.
"""
import json
import random
import subprocess
import sys
import tempfile
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parents[1]
XLSX_DIR = ROOT / "ไฟล์คำนวน"
GOLDEN_DIR = ROOT / "tests" / "golden"
SOFFICE = "/Applications/LibreOffice.app/Contents/MacOS/soffice"

SEX_TH = {"M": "ชาย", "F": "หญิง"}
MODE_TH = {"annual": "รายปี", "semi": "ราย 6 เดือน", "monthly": "รายเดือน"}
MEB_PLANS = [500, 1000, 2000, 3000, 4000, 5000]

PROFILE_XCU = """<?xml version="1.0" encoding="UTF-8"?>
<oor:items xmlns:oor="http://openoffice.org/2001/registry" xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
<item oor:path="/org.openoffice.Office.Calc/Formula/Load"><prop oor:name="OOXMLRecalcMode" oor:op="fuse"><value>0</value></prop></item>
</oor:items>
"""


def num_or_zero(v):
    return v if v is not None else 0


def meb_plan_for(rng, age):
    if age < 6 or age > 65:
        return None
    allowed = [p for p in MEB_PLANS if p <= (500 if age <= 10 else 1000 if age <= 15 else 5000)]
    return rng.choice(allowed)


# ------------------------------------------------------------------------------ PLB
PLB_SA_POOL = [300000, 349999, 350000, 400000, 499999, 500000, 650000, 699999, 700000, 999999, 1000000, 1500000, 3000000, 20000000]


def plb_random_cases(seed, count):
    rng = random.Random(seed)
    cases = []
    for _ in range(count):
        age = rng.randint(20, 59)
        sa = rng.choice(PLB_SA_POOL)
        riders = {}
        if rng.random() < 0.6:
            riders["AP"] = rng.choice([100000, 250000, 500000, 1000000, 2000000, min(5 * sa, 10000000)])
        if rng.random() < 0.5:
            riders["ECARE"] = rng.choice([100000, 300000, 500000, 1000000])
        if rng.random() < 0.5:
            riders["MEB"] = rng.choice(MEB_PLANS)
        cases.append({"variant": rng.choice(["PLB05", "PLB10", "PLB12", "PLB15"]), "age": age, "sex": rng.choice("MF"),
                      "mode": rng.choice(["annual", "semi", "monthly"]), "sumAssured": sa, "riders": riders})
    return cases


def plb_write(case, wb):
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


def plb_read(wb):
    ws, cal = wb["กรอกข้อมูล"], wb["Cal"]
    return {
        "modal": {"BASE": num_or_zero(ws["I19"].value), "AP": num_or_zero(ws["I23"].value), "ECARE": num_or_zero(ws["I24"].value), "MEB": num_or_zero(ws["I27"].value)},
        "annual": {"BASE": cal["G13"].value or 0, "AP": cal["G17"].value or 0, "ECARE": cal["G18"].value or 0, "MEB": cal["G21"].value or 0},
        "totalModal": num_or_zero(ws["I32"].value),
        "monthlyMessage": ws["J32"].value,
    }


# -------------------------------------------------------------------------- iShield
ISHIELD_MAX_AGE = {"WLCI05": 52, "WLCI10": 51, "WLCI15": 56, "WLCI20": 52}
ISHIELD_NAME = {"WLCI05": "iShield 05", "WLCI10": "iShield 10", "WLCI15": "iShield 15", "WLCI20": "iShield 20"}
ISHIELD_SA_POOL = [100000, 150000, 250000, 300000, 500000, 750000, 1000000, 2000000, 3000000, 5000000]
PB_NAME = {"FIT": "PB Fit", "BEYOND": "PB Beyond"}


def ishield_random_cases(seed, count):
    rng = random.Random(seed)
    cases = []
    for _ in range(count):
        variant = rng.choice(list(ISHIELD_MAX_AGE))
        age = rng.randint(0, ISHIELD_MAX_AGE[variant])
        case = {"variant": variant, "age": age, "sex": rng.choice("MF"), "mode": rng.choice(["annual", "semi", "monthly"])}
        if rng.random() < 0.2:
            case["basis"] = "premium"
            case["targetPremium"] = rng.choice([1000, 3000, 5000, 10000, 20000, 50000])
            sa = 500000  # only used to size rider choices below
        else:
            sa = rng.choice(ISHIELD_SA_POOL)
            case["sumAssured"] = sa
        riders = {}
        if rng.random() < 0.4:
            case["payer"] = {"age": rng.randint(20, 70), "sex": rng.choice("MF")}
            riders["PB"] = rng.choice(["FIT", "BEYOND"])
        if rng.random() < 0.5:
            ap_max = min(1000000, 2 * sa) if age < 16 else min(5 * sa, 10000000)
            riders["AP"] = rng.choice([x for x in [100000, 200000, 500000, 1000000, ap_max] if x <= ap_max])
        if age >= 16 and rng.random() < 0.4:
            riders["ECARE"] = rng.choice([x for x in [100000, 300000, 500000] if x <= min(10000000, 5 * sa)])
        meb = meb_plan_for(rng, age) if rng.random() < 0.4 else None
        if meb:
            riders["MEB"] = meb
        if 20 <= age <= 59 and rng.random() < 0.4:
            riders["PLS"] = [rng.choice(["PLS05", "PLS10", "PLS12", "PLS15"]), rng.choice([x for x in [300000, 500000, 1000000] if x <= 5 * sa])]
        case["riders"] = riders
        cases.append(case)
    return cases


def ishield_write(case, wb):
    ws = wb["กรอกข้อมูล"]
    ws["C6"] = case["age"]
    ws["C7"] = SEX_TH[case["sex"]]
    ws["C8"] = MODE_TH[case["mode"]]
    ws["C14"] = ISHIELD_NAME[case["variant"]]
    if case.get("basis") == "premium":
        ws["C16"] = "เบี้ยประกันภัย"
        ws["C22"] = case["targetPremium"]
    else:
        ws["C16"] = "จำนวนเงินเอาประกันภัย"
        ws["C19"] = case["sumAssured"]
    payer = case.get("payer")
    ws["C11"] = payer["age"] if payer else None
    ws["C12"] = SEX_TH[payer["sex"]] if payer else None
    r = case["riders"]
    ws["A27"] = PB_NAME.get(r.get("PB"), "PB Fit")
    ws["D27"] = "ซื้อ" if "PB" in r else "ไม่ซื้อ"
    ws["D28"] = r.get("AP")
    ws["D29"] = r.get("ECARE")
    ws["D30"] = r.get("MEB", "ไม่ซื้อ")
    if "PLS" in r:
        ws["A31"], ws["D31"] = r["PLS"]
    else:
        ws["A31"], ws["D31"] = "PLS10", None


def ishield_read(wb):
    ws, cal = wb["กรอกข้อมูล"], wb["Cal"]
    return {
        "sumAssured": num_or_zero(ws["D26"].value),
        "modal": {"BASE": num_or_zero(ws["F26"].value), "PB": num_or_zero(ws["F27"].value), "AP": num_or_zero(ws["F28"].value),
                  "ECARE": num_or_zero(ws["F29"].value), "MEB": num_or_zero(ws["F30"].value), "PLS": num_or_zero(ws["F31"].value)},
        "annual": {"BASE": cal["G13"].value or 0, "PB": cal["G14"].value or 0, "AP": cal["G16"].value or 0,
                   "ECARE": cal["G17"].value or 0, "MEB": cal["G19"].value or 0, "PLS": cal["G21"].value or 0},
        "totalModal": num_or_zero(ws["F32"].value),
        "monthlyMessage": ws["C37"].value,
    }


PLANS = {
    "plb": {"src": "Protection Life (PLB)_A2026-1_01042026.xlsx", "random": plb_random_cases, "write": plb_write, "read": plb_read},
    "ishield": {"src": "iShield_A2026-1_01042026.xlsx", "random": ishield_random_cases, "write": ishield_write, "read": ishield_read},
}


def run_plan(name):
    p = PLANS[name]
    src = XLSX_DIR / p["src"]
    spec = json.loads((GOLDEN_DIR / f"cases-{name}.json").read_text(encoding="utf-8"))
    cases = spec["explicit"] + p["random"](spec["random"]["seed"], spec["random"]["count"])
    with tempfile.TemporaryDirectory() as tmpdir:
        tmp = Path(tmpdir)
        profile = tmp / "profile" / "user"
        profile.mkdir(parents=True)
        (profile / "registrymodifications.xcu").write_text(PROFILE_XCU, encoding="utf-8")
        indir, outdir = tmp / "in", tmp / "out"
        indir.mkdir()
        outdir.mkdir()
        for i, c in enumerate(cases):
            wb = openpyxl.load_workbook(src)
            p["write"](c, wb)
            wb.save(indir / f"case{i:03}.xlsx")
        cmd = [SOFFICE, f"-env:UserInstallation=file://{tmp / 'profile'}", "--headless",
               "--convert-to", "xlsx", "--outdir", str(outdir)] + sorted(str(x) for x in indir.glob("*.xlsx"))
        subprocess.run(cmd, check=True, capture_output=True)
        results = []
        for i, c in enumerate(cases):
            wb = openpyxl.load_workbook(outdir / f"case{i:03}.xlsx", data_only=True)
            results.append({"input": c, "expected": p["read"](wb)})
    out = GOLDEN_DIR / f"{name}.json"
    out.write_text(json.dumps({"source": "libreoffice-recalc", "sourceFile": src.name, "cases": results}, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"wrote {out} with {len(results)} cases")


def main(argv):
    if not Path(SOFFICE).exists():
        sys.exit(f"LibreOffice not found at {SOFFICE}. Run: brew reinstall --cask libreoffice")
    for name in argv or list(PLANS):
        if name not in PLANS:
            sys.exit(f"unknown plan {name}; choose from {list(PLANS)}")
        run_plan(name)


if __name__ == "__main__":
    main(sys.argv[1:])
