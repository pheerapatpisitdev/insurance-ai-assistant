import { formatBaht } from "@/calc/money";
import type { DeathBenefit, PayMode, Sex } from "@/calc/types";
import { PAY_MODE_LABEL } from "@/calc/types";
import { PER } from "@/lib/legacy-cta";
import { deathBenefitRows } from "@/lib/death-benefit";
import type { IHealthyShown } from "@/components/IHealthyCalculator";

const SEX_WORD: Record<Sex, string> = { M: "ชาย", F: "หญิง" };
const INSTALMENT_ORDER: PayMode[] = ["monthly", "semi", "annual"];

/**
 * How a coverage reads inside a sentence, as against the bare words the picker lists.
 *
 * Full Coverage is the empty one: it is the contract as the whole page describes it, and
 * naming it would make the ordinary arrangement sound like a variant of something else. The
 * other two change what the customer pays on a claim, so they are never left unsaid.
 */
const COVERAGE_WORD: Record<string, string> = {
  "Full Coverage": "",
  Deductible: "แบบมีความรับผิดส่วนแรก",
  "Co-Payment": "แบบร่วมจ่าย",
};

/**
 * Everything the two texts below are written from — which is everything the card prints, and
 * nothing else.
 *
 * The riders from the agent's fold are deliberately not here. They live in that panel's own
 * state, and lifting them up would make the panel controlled for the sake of a line of text;
 * the quote an agent copies is the arrangement the customer is looking at, and the fold's
 * own total stays inside the fold.
 */
export interface IHealthyCtaFacts {
  /**
   * What is being priced: the health plan, where it covers, and how a bill is shared. The
   * five travel together or not at all — undefined is an age the company has no arrangement
   * to sell at, which the card says in its own words and these say in the customer's.
   */
  arrangement?: {
    /** the health plan's own name, e.g. "โกลด์" */
    planName: string;
    /** what the plan pays for treatment in one policy year, in baht */
    annualMax: number;
    territory: string;
    /** as the rate key spells it: "Full Coverage", "Deductible", "Co-Payment" */
    coverage: string;
    /** what the customer carries before the plan pays, in baht */
    deductible: number;
  };
  /** the share of a covered bill a co-payment arrangement leaves with the customer */
  copayPercent: number;
  age: number;
  sex: Sex;
  /** what prose calls the base plan, e.g. "ไลฟ์ โพรเทค+ x 2" */
  baseLabel: string;
  sumAssured: number;
  death: DeathBenefit;
  mode: PayMode;
  /** the company's smallest monthly instalment, in baht */
  minMonthly: number;
  /**
   * The three figures on the card, or nothing at all — the page's single "may a price be
   * quoted" gate. An expired rate set and an arrangement with no rate both arrive here as
   * undefined, so neither text below has a second question to ask.
   */
  shown: IHealthyShown | undefined;
}

/**
 * What the customer's chat opens with, so whoever answers starts from the figures already on
 * screen.
 *
 * Each shortfall says what it wants instead of falling silent: an age with no arrangement
 * behind it asks for one that fits, and a withheld price asks for the current one — the
 * customer still wants that arrangement, they just cannot be told here what it costs.
 */
export function iHealthyMessage(f: IHealthyCtaFacts): string {
  const head = "สนใจประกันสุขภาพ ไอเฮลท์ตี้ อัลตร้า";
  const someone = `${SEX_WORD[f.sex]} ${f.age} ปี`;
  const a = f.arrangement;
  if (a === undefined) return `${head} ${someone} ขอแบบที่เหมาะกับอายุนี้`;
  const cover = COVERAGE_WORD[a.coverage] ?? "";
  const who = `${head} แผน${a.planName} ${a.territory}${cover ? ` ${cover}` : ""} ${someone}`;
  if (!f.shown) return `${who} ขอราคาปัจจุบัน`;
  return `${who} เบี้ยรวมประมาณ ${formatBaht(f.shown.total)} บาท${PER[f.mode]}`;
}

/**
 * The quote as text, for the agent to paste into whichever chat the customer is already in.
 *
 * A pasted quote outlives the page it came from: nothing around it will ever say again that
 * this is a first-year premium on a rider that re-prices at every birthday, so that sentence
 * and the occupation class it assumes are part of the quote rather than part of the page.
 *
 * For the same reason it carries no per-day figure, though every other plan on the site
 * does. Theirs are level for the whole paying term, so "ตกวันละ 126 บาท" stays true;
 * this one would read as a standing subscription price and quietly contradict the line
 * underneath it.
 *
 * Undefined when no price may be shown — `ContactButtons` then hides the copy button, and
 * there is no half-quote for an agent to send by mistake.
 */
export function iHealthyQuoteText(f: IHealthyCtaFacts): string | undefined {
  const shown = f.shown;
  // the two cannot in fact disagree — nothing is priced without an arrangement to price it
  // for — but the types say they might, and a summary is not worth guessing a plan name for
  const a = f.arrangement;
  if (!shown || a === undefined) return undefined;
  const baht = (n: number) => n.toLocaleString("en-US");
  // what the plan pays and what the customer keeps of the bill, exactly as the card pairs them
  const ceiling = `วงเงินค่ารักษา ${baht(a.annualMax)} บาทต่อปี`
    + (a.coverage === "Deductible" ? ` · รับผิดส่วนแรก ${baht(a.deductible)} บาทต่อปี` : "")
    + (a.coverage === "Co-Payment" ? ` · ร่วมจ่าย ${f.copayPercent} เปอร์เซ็นต์ของค่าใช้จ่ายที่คุ้มครอง` : "");
  const instalments = [{ mode: f.mode, total: shown.total }, ...shown.others];
  return [
    // an emoji a heading, no more: the text is pasted into a customer's chat, where a wall
    // of them reads as a broadcast rather than as an agent answering
    `🏥 ไอเฮลท์ตี้ อัลตร้า แผน${a.planName}`,
    `${ceiling} · อาณาเขต${a.territory}`,
    "",
    `${SEX_WORD[f.sex]} อายุ ${f.age} ปี`,
    // the total first and its two halves under it: a customer asked what it costs, and the
    // split is what an agent needs when they are asked why
    `💰 เบี้ยรวมประมาณ ${formatBaht(shown.total)} บาท${PER[f.mode]}`,
    `- ${f.baseLabel} ทุน ${baht(f.sumAssured)} บาท · ${formatBaht(shown.base)} บาท`,
    `- ค่ารักษาพยาบาล · ${formatBaht(shown.rider)} บาท`,
    "",
    // one instalment a line, smallest first, whichever the card is showing
    ...INSTALMENT_ORDER.flatMap((mode) => {
      const m = instalments.find((x) => x.mode === mode);
      if (!m) return [];
      const line = `${PAY_MODE_LABEL[mode]} ${formatBaht(m.total)} บาท`;
      // The flag belongs to the instalment the card is showing, and the floor it is measured
      // against is a monthly one — so only the monthly line can ever carry the warning, and
      // an instalment the company refuses is named with the reason rather than dropped.
      return [mode === f.mode && shown.belowMinimum
        ? `${line} (ต่ำกว่าขั้นต่ำ ${baht(f.minMonthly)} บาท บริษัทไม่รับชำระรายเดือน)`
        : line];
    }),
    "",
    "👪 ครอบครัวได้รับเมื่อเสียชีวิต",
    ...deathBenefitRows(f.death).map((r) => `- ${r.label} ${baht(r.amount)} บาท`),
    "",
    "📌 เบี้ยปีแรก เบี้ยปีต่อไปคิดตามอายุที่เพิ่มขึ้น",
    "เบี้ยของอาชีพชั้น 1 · ความคุ้มครองและข้อยกเว้นเป็นไปตามที่กำหนดในกรมธรรม์",
  ].join("\n");
}
