#!/usr/bin/env python3
"""Turn the อีซี่ โพรเทค 6 calculator's own JSON into data/rates + data/cash-values.

Every other plan here is extracted from the company workbook by extract_rates.py. This one
has no workbook on this machine: what exists is the standalone calculator the agency already
runs at Advisortool/easy-protect6, whose data/easy-protect-rates.json was extracted from the
A2026-1 sheet when that tool was built. So this script converts that file rather than an
.xlsx, and is written the same way — deterministic, run again to rebuild, never hand-edit the
JSON it writes.

    EASY_PROTECT_DIR=/path/to/easy-protect6/source/data python3 scripts/import_easyprotect.py

The rider rates are not in that file in a shape this engine can read, and they do not have to
be: PB/WP/MEB/DCI/PLS/IHU/CI123 are priced off the rider's own plancode, sex and age, not off
the base plan, and the A2026-1 rider blocks are byte-identical in ไลฟ์เทรเชอร์, ไอสมาร์ท and
ไลฟ์ โพรเทค. They are copied from ไลฟ์เทรเชอร์ and the script asserts that identity, so the
day one of them changes, this stops instead of quietly quoting a stale rider.
"""
import json
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC_DIR = Path(
    os.environ.get("EASY_PROTECT_DIR")
    or Path.home() / "Documents/APP/Advisortool/easy-protect6/source/data"
)
RATES_OUT = ROOT / "data" / "rates" / "easyprotect.json"
CV_OUT = ROOT / "data" / "cash-values" / "easyprotect.json"

VARIANT = "W99F06A"
# A2026-1 is the edition every other plan in data/rates is on, and the source file carries the
# same version string, so the window it is sold in is that edition's window.
EFFECTIVE_TEXT = "1 มกราคม 2569 ถึง 31 มีนาคม 2570"
EXPIRES_ON = "2027-03-31"

# What the plan sells. Read off the source calculator, which keeps PB, WP, MEB, DCI, PLS,
# iHealthy Ultra and CI 123 and forces AP, ECARE, MEX, CPR, HIC and โรคร้ายโซชิลด์ to zero
# for this plan — see normalizeInput() in easy-protect6/source/calculator.ts.
RIDERS = ["PB", "WP", "MEB", "DCI", "PLS", "IHU", "CI123"]
# the plans whose rider blocks must agree before any of them may be copied
RIDER_TWINS = ["lifetreasure", "ismart", "lifeprotect"]


def write_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"wrote {path} ({path.stat().st_size} bytes)")


def rider_block():
    plans = {name: json.loads((ROOT / "data" / "rates" / f"{name}.json").read_text("utf-8")) for name in RIDER_TWINS}
    first = plans[RIDER_TWINS[0]]["riders"]
    for code in RIDERS:
        shapes = {name: json.dumps(p["riders"][code], sort_keys=True, ensure_ascii=False) for name, p in plans.items()}
        assert len(set(shapes.values())) == 1, f"{code} differs between plans; copy it by hand or extract it"
    return {code: first[code] for code in RIDERS}


def main():
    src = json.loads((SRC_DIR / "easy-protect-rates.json").read_text("utf-8"))
    product = src["product"]
    assert product["planCode"] == VARIANT, product["planCode"]

    rates = {
        "planCode": "EASYPROTECT",
        "planName": product["name"],
        "version": product["version"],
        "effectiveText": EFFECTIVE_TEXT,
        "expiresOn": EXPIRES_ON,
        "sourceFile": "easy-protect6/source/data/easy-protect-rates.json",
        # The source tool also sells a quarterly mode. This engine has three modes and the
        # owner asked for it to stay at three, so quarterly is dropped rather than invented
        # elsewhere in the app.
        "modeFactors": {
            "annual": src["modes"]["annual"]["factor"],
            "semi": src["modes"]["semiannual"]["factor"],
            "monthly": src["modes"]["monthly"]["factor"],
        },
        "base": {
            "variants": [VARIANT],
            "packages": [{
                "code": VARIANT,
                "plancode": VARIANT,
                "name": f"ชำระเบี้ย {product['premiumPaymentYears']} ปี",
                "ageMin": product["minIssueAge"],
                "ageMax": product["maxIssueAge"],
                "seq": 1,
                "payTerm": product["premiumPaymentYears"],
                "rateKey": "06",
            }],
            "payTerm": {VARIANT: product["premiumPaymentYears"]},
            "rates": {VARIANT: {
                sex: {str(age): rate for age, rate in sorted(table.items(), key=lambda kv: int(kv[0]))}
                for sex, table in src["premiumRates"].items()
            }},
        },
        # อีซี่ โพรเทค 6 has no sum-assured discount: the source tool prices every sum at the
        # table rate. An empty threshold list is how discountPerThousand() reads "none".
        "discount": {"thresholds": [], "byVariant": {VARIANT: []}},
        "riders": rider_block(),
    }

    last_covered = product["coverageToAge"] - 1
    factors = {}
    for sex, by_age in src["cashValues"].items():
        out = {}
        for age_key, by_year in by_age.items():
            age = int(age_key)
            years = last_covered - age + 1
            row = [by_year[str(y)] for y in range(1, years + 1)]
            tail = [by_year[k] for k in by_year if int(k) > years]
            assert not any(tail), f"{sex} age {age}: surrender value past age {last_covered}"
            out[str(age)] = row
        factors[sex] = out

    cash_values = {
        "planCode": "EASYPROTECT",
        "source": "easy-protect6/source/data/easy-protect-rates.json",
        "lastCoveredAge": last_covered,
        "note": "surrender value = round(factor * sumAssured / 1000); factor per policy year, from year 1",
        "factors": {VARIANT: factors},
    }

    write_json(RATES_OUT, rates)
    write_json(CV_OUT, cash_values)


if __name__ == "__main__":
    main()
