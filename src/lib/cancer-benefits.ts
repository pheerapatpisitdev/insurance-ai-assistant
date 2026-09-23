/**
 * What the cancer riders pay, read off the workbook's `ผลประโยชน์ (cancer)` sheet in
 * ไอสมาร์ท 80-6_A2026-1.xlsx (the same pair is sold on Life Protect+ and ไลฟ์เทรเชอร์).
 * The rate tables price these riders but say nothing about the payout, so the shares live
 * here, next to the one sentence of the sheet each comes from.
 */

/** สัญญาเพิ่มเติมคุ้มครองโรคมะเร็ง — a lump sum by the stage of the cancer */
export const CANCER_RIDER = "CPR";
/** สัญญาเพิ่มเติมค่าชดเชยรายวันเนื่องจากโรคมะเร็ง — a daily sum while in hospital */
export const CANCER_DAILY_RIDER = "HIC";

/** HIC pays for at most this many days; an invasive cancer extends it by the next figure */
export const HIC_MAX_DAYS = 365;
export const HIC_INVASIVE_EXTRA_DAYS = 180;

export interface CprStage {
  label: string;
  /** share of the CPR sum assured */
  share: number;
  /** the most this stage pays, when the sheet caps it */
  cap: number | null;
  /** the biopsy must be taken this many days after cover starts */
  waitingDays: number;
  /** what the sheet adds under the stage */
  note?: string;
  /** stages 2 and 3 may be claimed again, within the sum assured */
  repeatable?: true;
  /** the stage that pays the sum assured, less whatever was already paid */
  major?: true;
}

/**
 * Stages 2 and 3 can be claimed more than once (rows 12 and 18), but all claims together never
 * pass the sum assured; stage 4 pays the sum assured less whatever the earlier stages already paid.
 */
export const CPR_STAGES: readonly CprStage[] = [
  // L8: MIN(D28*10/100, 50,000)
  {
    label: "ขั้น 1 มะเร็งระยะไม่ลุกลามขั้นต้น", share: 0.1, cap: 50_000, waitingDays: 120,
    note: "รวมมะเร็งผิวหนังชนิดบาเซลเซลและสแควมัสเซล",
  },
  // L13: D28*15/100 — L14 caps cervical cancer / CIN III at 100,000
  {
    label: "ขั้น 2 มะเร็งระยะไม่ลุกลาม", share: 0.15, cap: null, waitingDays: 90, repeatable: true,
    note: "รวมมะเร็งรังไข่ระยะแรก · มะเร็งปากมดลูกหรือ CIN III จ่ายไม่เกิน 100,000 บาท",
  },
  // L19: D28*30/100
  {
    label: "ขั้น 3 ระยะไม่ลุกลาม ผ่าตัดอวัยวะออก", share: 0.3, cap: null, waitingDays: 90, repeatable: true,
    note: "ผ่าตัดแบบ Radical surgery ที่อวัยวะที่กำหนด · เคยเคลมขั้น 2 ที่อวัยวะเดิม จ่าย 15%",
  },
  // L23: the whole sum assured
  {
    label: "ขั้น 4 มะเร็งระยะลุกลาม", share: 1, cap: null, waitingDays: 60, major: true,
    note: "จ่ายเต็มทุน หักส่วนที่จ่ายไปแล้ว",
  },
];

export function cprStagePays(stage: CprStage, sumAssured: number): number {
  const pays = Math.round(sumAssured * stage.share);
  return stage.cap === null ? pays : Math.min(pays, stage.cap);
}

/**
 * What the family receives from every contract in the set, told as the owner asked: death
 * on its own, and death after an invasive cancer was found.
 *
 * Neither rider pays on death — CPR pays on a diagnosis and HIC on a hospital day — so the
 * first case is the base contract alone, and the second is CPR's whole sum (stage 4 pays it
 * less whatever the earlier stages already paid, so the total never passes it) on top. HIC
 * is left out: what it adds depends on days nobody can know in advance.
 *
 * One band, the one this person is in now, because the card already lists both bands of the
 * death benefit and a four-row total would repeat it.
 */
export interface DeathTotals {
  /** the age the base contract's death benefit steps down at, when this person is under it */
  beforeAge?: number;
  rows: { label: string; amount: number }[];
}

export function cancerDeathTotals(
  cpr: number, death: { beforeAge: number; sumBefore: number; sumFrom: number }, age: number,
): DeathTotals {
  const before = age < death.beforeAge;
  const sum = before ? death.sumBefore : death.sumFrom;
  return {
    ...(before ? { beforeAge: death.beforeAge } : {}),
    rows: [
      { label: "เสียชีวิตทั่วไป", amount: sum },
      { label: "ตรวจพบมะเร็งระยะลุกลาม แล้วเสียชีวิต", amount: cpr + sum },
    ],
  };
}

export function deathTotalsTitle(t: DeathTotals): string {
  return `รวมทุกสัญญา กรณีเสียชีวิต${t.beforeAge ? `ก่อนอายุ ${t.beforeAge} ปี` : ""}`;
}
