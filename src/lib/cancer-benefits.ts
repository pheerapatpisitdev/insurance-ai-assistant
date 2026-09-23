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
}

/**
 * Stages 1–3 can each be claimed more than once, but all claims together never pass the
 * sum assured; stage 4 pays the sum assured less whatever the earlier stages already paid.
 */
export const CPR_STAGES: readonly CprStage[] = [
  // L8: MIN(D28*10/100, 50,000)
  { label: "ขั้น 1 มะเร็งระยะไม่ลุกลามขั้นต้น", share: 0.1, cap: 50_000 },
  // L13: D28*15/100 — L14 caps cervical cancer / CIN III at 100,000
  { label: "ขั้น 2 มะเร็งระยะไม่ลุกลาม", share: 0.15, cap: null },
  // L19: D28*30/100
  { label: "ขั้น 3 ระยะไม่ลุกลาม ผ่าตัดอวัยวะออก", share: 0.3, cap: null },
  // L23: the whole sum assured
  { label: "ขั้น 4 มะเร็งระยะลุกลาม", share: 1, cap: null },
];

export function cprStagePays(stage: CprStage, sumAssured: number): number {
  const pays = Math.round(sumAssured * stage.share);
  return stage.cap === null ? pays : Math.min(pays, stage.cap);
}
