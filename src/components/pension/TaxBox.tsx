"use client";
import { useState } from "react";
import { MoneyInput } from "@/components/MoneyInput";
import { pensionTax } from "@/calc/pension/engine";

// dropped, not rounded — the rule every premium in this app is shown by
const baht = (n: number) => Math.floor(n).toLocaleString("en-US");
const field = "mt-1 w-full rounded border px-3 py-2";

const RATES = [0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35];

/** คำนวณภาษี: how much more annuity premium still comes off this year's tax. */
export function TaxBox() {
  const [income, setIncome] = useState<number | "">(1_200_000);
  const [funds, setFunds] = useState<number | "">(0);
  const [life, setLife] = useState<number | "">(0);
  const [annuity, setAnnuity] = useState<number | "">(0);
  const [rate, setRate] = useState(0.2);
  const n = (v: number | "") => (v === "" ? 0 : v);
  const t = pensionTax({ income: n(income), retirementFunds: n(funds), lifePremiums: n(life), annuityPremiums: n(annuity), marginalRate: rate });

  return (
    <section className="mt-5 rounded-lg border border-[var(--op-line)] bg-[var(--op-panel)] p-4">
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <div><label className="block text-sm">เงินได้ทั้งปี</label><MoneyInput value={income} onChange={setIncome} className={field} /></div>
        <div><label className="block text-sm">กองทุนเกษียณที่ใช้แล้ว (PVD, กบข., RMF ฯลฯ)</label><MoneyInput value={funds} onChange={setFunds} className={field} /></div>
        <div><label className="block text-sm">เบี้ยประกันชีวิตที่ใช้ลดหย่อนแล้ว</label><MoneyInput value={life} onChange={setLife} className={field} /></div>
        <div><label className="block text-sm">เบี้ยบำนาญที่มีอยู่แล้ว</label><MoneyInput value={annuity} onChange={setAnnuity} className={field} /></div>
        <div>
          <label className="block text-sm">อัตราภาษีขั้นสูงสุด</label>
          <select className={field} value={rate} onChange={(e) => setRate(Number(e.target.value))}>
            {RATES.map((r) => <option key={r} value={r}>{Math.round(r * 100)}%</option>)}
          </select>
        </div>
      </div>
      <div className="mt-4 rounded-lg bg-[var(--op-figure-bg)] p-4 text-sm">
        ซื้อเบี้ยบำนาญเพิ่มเพื่อลดหย่อนได้อีกสูงสุด <span className="text-lg font-semibold tabular-nums">{baht(t.maxPremium)} บาท</span>
        {" "}· ประหยัดภาษีได้ประมาณ <span className="font-semibold tabular-nums">{baht(t.taxSaved)} บาท</span>
      </div>
    </section>
  );
}
