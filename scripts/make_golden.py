#!/usr/bin/env python3
"""Generate tests/golden/<plan>.json by letting LibreOffice recalculate the company Excel file.

Usage: python3 scripts/make_golden.py [plb|ishield ...]   (default: all)

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
    """Excel puts a message where a number would go when a rider is excluded; treat that as 0."""
    return v if isinstance(v, (int, float)) else 0


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
        # E65 = IF(AND(mode="รายเดือน", total<1000), "no", "yes") — the real monthly-minimum flag.
        # (C37 is a different message: "sum assured is zero".)
        "monthlyBelowMinimum": ws["E65"].value == "no",
    }


PLANS = {
    "plb": {"src": "Protection Life (PLB)_A2026-1_01042026.xlsx", "random": plb_random_cases, "write": plb_write, "read": plb_read},
    "ishield": {"src": "iShield_A2026-1_01042026.xlsx", "random": ishield_random_cases, "write": ishield_write, "read": ishield_read},
}




# -------------------------------------------------------------------------- W family
# ไอสมาร์ท 80/6, ไลฟ์เทรเชอร์ and ไลฟ์ โพรเทค+ share one input layout; only the row the base
# plan sits on differs (19 vs 20), so every cell is addressed relative to that row.
W_FILES = {
    "ismart": ("ไอสมาร์ท 80-6_A2026-1.xlsx", 19),
    "lifetreasure": ("ไลฟ์เทรเชอร์_A2026-1.xlsx", 19),
    "lifeprotect": ("Sales proposal_Life Protect Plus 9 19 99_2026821_update benefit graph.xlsx", 20),
}
PB_TH = {"FIT": "PB Fit", "BEYOND": "PB Beyond"}
WP_TH = {"FIT": "WP Fit", "BEYOND": "WP Beyond"}
IHU_PLANS_UNDER_11 = ["SMART", "BRONZE"]
IHU_PLANS_TH = ["SMART", "BRONZE", "SILVER", "GOLD"]
IHU_PLANS_ANY = ["DIAMOND", "PLATINUM"]
RRSS_PLANS = {"any": ["แผน S", "แผน M"], "11+": ["แผน L"], "12-65": ["แผน XL"]}


def w_packages(plan):
    """Package list from data/rates/<plan>.json so the generator and the engine agree."""
    d = json.loads((ROOT / "data" / "rates" / f"{plan}.json").read_text(encoding="utf-8"))
    return d["base"]["packages"]


def w_sa_min(plan, pkg):
    rules = json.loads((ROOT / "data" / "rules" / f"{plan}.json").read_text(encoding="utf-8"))
    return rules["base"].get("saMinByVariant", {}).get(pkg["code"], rules["base"]["saMin"]), pkg["code"] in rules["base"].get("saExactVariants", [])


def w_random_cases(plan):
    def gen(seed, count):
        rng = random.Random(seed)
        pkgs = w_packages(plan)
        cases = []
        while len(cases) < count:
            pkg = rng.choice(pkgs)
            age = rng.randint(pkg["ageMin"], pkg["ageMax"])
            sa_min, exact = w_sa_min(plan, pkg)
            sa = sa_min if exact else rng.choice([x for x in [sa_min, 300000, 500000, 1000000, 2000000, 5000000, 10000000, 20000000] if x >= sa_min][:5])
            seq = pkg["seq"]
            health_pkg = seq >= 7 if plan == "lifeprotect" else seq >= 5
            case = {"variant": pkg["code"], "age": age, "sex": rng.choice("MF"),
                    "mode": rng.choice(["annual", "semi", "monthly"]), "sumAssured": sa}
            riders = {}
            # payor / waiver (exclusive), not on health packages
            if not health_pkg:
                pick = rng.random()
                if pick < 0.3:
                    case["payer"] = {"age": rng.randint(20, 70), "sex": rng.choice("MF")}
                    riders["PB"] = rng.choice(["FIT", "BEYOND"])
                elif pick < 0.55 and 16 <= age <= 70:
                    riders["WP"] = rng.choice(["FIT", "BEYOND"])
            if age <= 60 and rng.random() < 0.4:
                ap_max = min(3000000, 2 * sa) if age < 16 else min(5 * sa, 10000000)
                riders["AP"] = rng.choice([x for x in [100000, 300000, 500000, 1000000, ap_max] if x <= ap_max])
            if not health_pkg and 16 <= age <= 60 and rng.random() < 0.3:
                riders["ECARE"] = rng.choice([x for x in [100000, 300000, 500000] if x <= min(10000000, 5 * sa)])
            # medical: MEX or MEB or iHealthy (HIC excludes all three)
            med = rng.random()
            want_ihu = (health_pkg and (plan != "lifeprotect" and seq == 5 or plan == "lifeprotect" and seq == 7))
            want_mex = (health_pkg and (plan != "lifeprotect" and seq == 6 or plan == "lifeprotect" and seq == 8))
            if want_mex or (not health_pkg and med < 0.25 and age <= 70):
                riders["MEX"] = rng.choice(["1200", "2200", "3200"] if age <= 10 else ["1200", "2200", "3200", "4200", "6200"])
            elif want_ihu or (not health_pkg and med < 0.5 and 6 <= age <= 80):
                if age < 11:
                    plan_name, territory = rng.choice(IHU_PLANS_UNDER_11), "ประเทศไทย"
                elif rng.random() < 0.5:
                    plan_name, territory = rng.choice(IHU_PLANS_TH), "ประเทศไทย"
                else:
                    plan_name, territory = rng.choice(IHU_PLANS_ANY), rng.choice(["ประเทศไทย", "เอเชีย", "ทั่วโลก"])
                riders["IHU"] = [plan_name, territory, rng.choice(["Full Coverage", "Deductible"])]
            elif not health_pkg and med < 0.7:
                meb = meb_plan_for(rng, age)
                if meb:
                    riders["MEB"] = meb
            # critical illness family
            ci = rng.random()
            if 20 <= age <= 65 and ci < 0.25:
                riders["DCI"] = rng.choice([200000, 500000, 1000000])
            elif not health_pkg and age <= 65 and ci < 0.5:
                cpr_max = min(5000000, 5 * sa)
                riders["CPR"] = rng.choice([x for x in [300000, 500000, 1000000] if x <= cpr_max])
                if "MEX" not in riders and "MEB" not in riders and "IHU" not in riders and rng.random() < 0.5:
                    riders["HIC"] = rng.choice([1000, 3000, 5000, 10000])
            if not health_pkg and 20 <= age <= 59 and rng.random() < 0.3:
                riders["PLS"] = [rng.choice(["PLS05", "PLS10", "PLS12", "PLS15"]), rng.choice([x for x in [300000, 500000, 1000000] if x <= 5 * sa])]
            if age <= 65 and rng.random() < 0.3:
                pool = RRSS_PLANS["any"] + (RRSS_PLANS["11+"] if age >= 11 else []) + (RRSS_PLANS["12-65"] if 12 <= age <= 65 else [])
                riders["RRSS"] = rng.choice(pool)
            if age <= 75 and rng.random() < 0.35:
                riders["CI123"] = rng.choice([500000, 1000000, 2000000, 5000000])
            case["riders"] = riders
            cases.append(case)
        return cases
    return gen


def w_write(plan):
    fname, base = W_FILES[plan]

    def write(case, wb):
        ws = wb["กรอกข้อมูล"]
        pkg = next(p for p in w_packages(plan) if p["code"] == case["variant"])
        ws["C5"] = case["age"]
        ws["C6"] = SEX_TH[case["sex"]]
        ws["C7"] = MODE_TH[case["mode"]]
        ws["C14"] = pkg["name"]
        # ไลฟ์ โพรเทค+ keys its package table on payment-term name + product, so the product
        # selector has to be set too or an "L" package silently resolves to its "H" twin.
        if pkg.get("productName"):
            ws["C15"] = pkg["productName"]
        payer = case.get("payer")
        ws["C11"] = payer["age"] if payer else None
        ws["C12"] = SEX_TH[payer["sex"]] if payer else None
        r = case["riders"]
        ws[f"D{base}"] = case["sumAssured"]
        ws[f"A{base+1}"] = PB_TH.get(r.get("PB"), "PB Fit")
        ws[f"D{base+1}"] = "ซื้อ" if "PB" in r else "ไม่ซื้อ"
        ws[f"A{base+2}"] = WP_TH.get(r.get("WP"), "WP Fit")
        ws[f"D{base+2}"] = "ซื้อ" if "WP" in r else "ไม่ซื้อ"
        ws[f"D{base+3}"] = r.get("AP")
        ws[f"D{base+4}"] = r.get("ECARE")
        ws[f"D{base+5}"] = int(r["MEX"]) if "MEX" in r else "ไม่ซื้อ"
        ws[f"D{base+6}"] = r.get("MEB", "ไม่ซื้อ")
        ws[f"D{base+7}"] = r.get("DCI")
        if "PLS" in r:
            ws[f"A{base+8}"], ws[f"D{base+8}"] = r["PLS"]
        else:
            ws[f"A{base+8}"], ws[f"D{base+8}"] = "PLS10", None
        ws[f"D{base+9}"] = r.get("CPR")
        ws[f"D{base+10}"] = r.get("HIC")
        if "IHU" in r:
            plan_name, territory, coverage = r["IHU"]
            ws[f"D{base+11}"] = plan_name
            ws[f"D{base+12}"] = coverage
            ws[f"D{base+18}"] = territory
        else:
            ws[f"D{base+11}"] = "ไม่ซื้อ"
            ws[f"D{base+12}"] = None
            ws[f"D{base+18}"] = "ประเทศไทย"
        ws[f"D{base+13}"] = r.get("RRSS")
        ws[f"D{base+14}"] = r.get("CI123")
        # The app always quotes occupation class 1. Some shipped workbooks carry class 4 in a
        # rider's class cell (ไลฟ์เทรเชอร์ has 4 for โรคร้ายโซชิลด์), which multiplies by 1.5.
        for off in (1, 2, 3, 4, 5, 6, 11, 13):
            ws[f"E{base+off}"] = 1
        # ไลฟ์เทรเชอร์'s CI 123 formulas read '[3]Rate CI 123' — an external workbook LibreOffice cannot
        # open. The same table exists as a sheet inside the file, so rewrite the link to that sheet.
        for row in ws.iter_rows(min_row=26, max_row=36, min_col=37, max_col=41):  # AK..AO
            for c in row:
                if isinstance(c.value, str) and "[3]Rate CI 123" in c.value:
                    c.value = c.value.replace("'[3]Rate CI 123'", "'Rate CI 123'")
    return write


def w_read(plan):
    fname, base = W_FILES[plan]

    def read(wb):
        ws, cal = wb["กรอกข้อมูล"], wb["Cal"]
        f = lambda off: num_or_zero(ws[f"F{base+off}"].value)
        # The yes/no flag sits beside a label in column D ("ถ้าเบี้ยรวมเท่ากับศูนย์ หรือ เบี้ยรายเดือน…").
        # It is "no" when the total is zero OR (monthly and < 1,000); the test applies the mode.
        flag_row = next((r for r in range(55, 85) if isinstance(ws[f"D{r}"].value, str) and ws[f"D{r}"].value.startswith("ถ้าเบี้ย")), None)
        total_cell = ws[f"F{base+18}"].value
        if isinstance(total_cell, str):
            # ไลฟ์ โพรเทค+ replaces the total with a message when the flag is "no"; sum the rows instead
            total = sum(num_or_zero(ws[f"F{r}"].value) for r in range(base, base + 18))
        else:
            total = num_or_zero(total_cell)
        return {
            "sumAssured": 0 if ws[f"H{base}"].value == "ไม่คุ้มครอง" else num_or_zero(ws[f"D{base}"].value),
            "modal": {"BASE": f(0), "PB": f(1), "WP": f(2), "AP": f(3), "ECARE": f(4), "MEX": f(5), "MEB": f(6),
                      "DCI": f(7), "PLS": f(8), "CPR": f(9), "HIC": f(10), "IHU": f(11), "RRSS": f(13),
                      "CI123": f(14), "CI123_1": f(15), "CI123_2": f(16), "CI123_3": f(17)},
            "annual": {"BASE": cal["G13"].value or 0},
            "totalModal": total,
            "totalIsText": isinstance(total_cell, str),
            "excelFlagNo": (ws[f"E{flag_row}"].value == "no") if flag_row else None,
        }
    return read


for _plan in W_FILES:
    PLANS[_plan] = {"src": W_FILES[_plan][0], "random": w_random_cases(_plan), "write": w_write(_plan), "read": w_read(_plan)}


CACHE_DIR = ROOT / ".golden-cache"


def run_plan(name, reread=False):
    p = PLANS[name]
    src = XLSX_DIR / p["src"]
    spec = json.loads((GOLDEN_DIR / f"cases-{name}.json").read_text(encoding="utf-8"))
    cases = spec["explicit"] + p["random"](spec["random"]["seed"], spec["random"]["count"])
    outdir = CACHE_DIR / name
    if not reread:
        with tempfile.TemporaryDirectory() as tmpdir:
            tmp = Path(tmpdir)
            profile = tmp / "profile" / "user"
            profile.mkdir(parents=True)
            (profile / "registrymodifications.xcu").write_text(PROFILE_XCU, encoding="utf-8")
            indir = tmp / "in"
            indir.mkdir()
            if outdir.exists():
                shutil.rmtree(outdir)
            outdir.mkdir(parents=True)
            for i, c in enumerate(cases):
                wb = openpyxl.load_workbook(src)
                p["write"](c, wb)
                wb.save(indir / f"case{i:03}.xlsx")
            cmd = [SOFFICE, f"-env:UserInstallation=file://{tmp / 'profile'}", "--headless",
                   "--convert-to", "xlsx", "--outdir", str(outdir)] + sorted(str(x) for x in indir.glob("*.xlsx"))
            subprocess.run(cmd, check=True, capture_output=True)
    results = []
    for i, c in enumerate(cases):
        path = outdir / f"case{i:03}.xlsx"
        try:
            wb = openpyxl.load_workbook(path, data_only=True)
            results.append({"input": c, "expected": p["read"](wb)})
        except Exception as e:  # keep going: one bad case must not cost the whole run
            results.append({"input": c, "error": f"{type(e).__name__}: {e}"})
    out = GOLDEN_DIR / f"{name}.json"
    out.write_text(json.dumps({"source": "libreoffice-recalc", "sourceFile": src.name, "cases": results}, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    errors = sum(1 for r in results if "error" in r)
    print(f"wrote {out} with {len(results)} cases ({errors} read errors); recalculated workbooks kept in {outdir}")


def main(argv):
    reread = "--reread" in argv
    names = [a for a in argv if not a.startswith("--")]
    if not reread and not Path(SOFFICE).exists():
        sys.exit(f"LibreOffice not found at {SOFFICE}. Run: brew reinstall --cask libreoffice")
    for name in names or list(PLANS):
        if name not in PLANS:
            sys.exit(f"unknown plan {name}; choose from {list(PLANS)}")
        run_plan(name, reread=reread)


if __name__ == "__main__":
    main(sys.argv[1:])
