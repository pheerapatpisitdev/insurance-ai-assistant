/**
 * Every rule of thumb the planner assumes, in one place, so the owner can change one without
 * reading the formulas. Agreed with the owner 2026-09-25 — see
 * docs/superpowers/specs/2026-09-25-self-planner-design.md.
 */

/** ดูแลลูกจนถึงอายุนี้ */
export const CHILD_SUPPORTED_UNTIL = 22;
/** ไม่มีลูก แต่มีพ่อแม่/คู่สมรสที่ต้องดูแล: ดูแลกี่ปี */
export const YEARS_FOR_OTHER_DEPENDANTS = 10;
/** ทุนการศึกษาต่อลูกหนึ่งคน ตั้งแต่เกิดจนอายุ 22 (ลดลงตามอายุลูก) */
export const EDUCATION_PER_CHILD = 1_000_000;
/** ค่าทำศพ */
export const FUNERAL = 100_000;
/** ทุนโรคร้ายแรงที่ควรมี = รายได้กี่ปี */
export const CI_YEARS_OF_INCOME = 3;
/** งบเบี้ยตั้งต้น = กี่ส่วนของเงินเดือน (ก่อนหักเบี้ยที่จ่ายอยู่) */
export const DEFAULT_BUDGET_SHARE = 0.1;
/** เงินที่ควรมีใช้ต่อเดือนหลังเกษียณ = กี่ส่วนของค่าใช้จ่ายวันนี้ */
export const RETIRE_SHARE_OF_EXPENSE = 0.7;
/** อายุเกษียณที่ให้เลือก = อายุเริ่มรับบำนาญ สมาร์ท 95 ที่มี */
export const RETIRE_AGES = [55, 60, 65] as const;
export type RetireAge = (typeof RETIRE_AGES)[number];
/** อายุเกษียณตั้งต้น (ถ้าอายุที่เลือกรับไม่ได้ ใช้อายุถัดไปที่รับได้) */
export const PENSION_FROM_AGE: RetireAge = 60;
/** เงินก้อนเพื่อเกษียณ หารให้พอใช้ถึงอายุนี้ ไม่คิดดอกผล */
export const LUMP_LASTS_TO_AGE = 85;
/** อายุเฉลี่ยที่ลูกค้าเลือกเองได้ (หน้า FHC) — ใช้แทน LUMP_LASTS_TO_AGE เมื่อกรอกมา */
export const LIFE_EXPECTANCY = { min: 75, max: 100 } as const;
/** บำนาญที่ไม่ได้อยู่ท้ายลำดับ: ลดทีละเท่านี้ (บาท/เดือน) จนเบี้ยพอดีงบ */
export const PENSION_STEP = 1_000;
/** Life Protect x 2 จ่ายสองเท่าเมื่อเสียชีวิตก่อนอายุนี้ — the test checks it against the rate table */
export const LIFE_DOUBLE_BEFORE_AGE = 60;
/** อายุที่หน้านี้รับ */
export const PLANNER_AGE = { min: 20, max: 70 } as const;

/** คำถาม "อยากได้ประกันชีวิตแบบไหน" */
export type LifeWant = "cover" | "save";
export const LIFE_WANT_LABEL: Record<LifeWant, { title: string; note: string }> = {
  cover: { title: "จ่ายเบี้ยน้อย คุ้มครองสูง", note: "ไม่ห่วงว่าเบี้ยจะจ่ายทิ้ง" },
  save: { title: "คุ้มครองด้วย ออมไปด้วย", note: "ไม่อยากจ่ายทิ้ง จ่ายเบี้ยสูงขึ้นได้" },
};

/**
 * The life plan each answer gets — the owner's pick 2026-09-25. "cover" is PLB paid 15 years,
 * which only takes ages 20–59; anyone else gets Life Protect x 2 paid to 99 instead.
 * PLB stops at the PLB page's own ceiling so the link shows the same sum.
 */
export const LIFE_PLANS = {
  term: { variant: "PLB15", product: "Protection Life (PLB) ชำระ 15 ปี", href: "/plb", doubles: false, years: 15, maxSum: 5_000_000 },
  to99: { variant: "WLF99H", product: "Life Protect x 2", href: "/lifeprotect", doubles: true },
  pay19: { variant: "WLF19H", product: "Life Protect x 2 ชำระ 19 ปี", href: "/lifeprotect", doubles: true },
} as const;

export type Hospital = "public" | "private" | "premium";
export const HOSPITAL_LABEL: Record<Hospital, string> = {
  public: "โรงพยาบาลรัฐ",
  private: "เอกชนทั่วไป",
  premium: "เอกชนชั้นนำ",
};
/** โรงพยาบาลที่อยากใช้ → แผน iHealthy Ultra */
export const HOSPITAL_TIER: Record<Hospital, string> = { public: "SMART", private: "SILVER", premium: "GOLD" };

/** iHealthy Ultra's six plans, smallest first (data/riders/ihealthy-ultra.json) */
export const HEALTH_TIERS: { code: string; name: string; room: number }[] = [
  { code: "SMART", name: "สมาร์ท", room: 1_500 },
  { code: "BRONZE", name: "บรอนซ์", room: 3_000 },
  { code: "SILVER", name: "ซิลเวอร์", room: 5_500 },
  { code: "GOLD", name: "โกลด์", room: 9_000 },
  { code: "DIAMOND", name: "ไดมอนด์", room: 15_000 },
  { code: "PLATINUM", name: "แพลทินัม", room: 21_000 },
];

/** the sums the Life Protect page offers: every 500,000 to 10 million, then every million to 50 */
export const LIFE_SUMS: number[] = [
  ...Array.from({ length: 20 }, (_, i) => (i + 1) * 500_000),
  ...Array.from({ length: 40 }, (_, i) => (i + 11) * 1_000_000),
];

/** CI 123 set tiers (data/bundles/ci123.json) */
export const CI_TIERS = [
  { no: 1, sum: 500_000 }, { no: 2, sum: 1_000_000 }, { no: 3, sum: 2_000_000 }, { no: 4, sum: 3_000_000 },
  { no: 5, sum: 4_000_000 }, { no: 6, sum: 5_000_000 }, { no: 7, sum: 10_000_000 },
];

/** Cancer set tiers by cancer cover (data/bundles/cancer.json) */
export const CANCER_TIERS = [
  { no: 1, sum: 300_000 }, { no: 2, sum: 500_000 }, { no: 3, sum: 750_000 }, { no: 4, sum: 1_000_000 },
  { no: 5, sum: 2_000_000 }, { no: 6, sum: 3_000_000 }, { no: 7, sum: 4_000_000 }, { no: 8, sum: 5_000_000 },
];
