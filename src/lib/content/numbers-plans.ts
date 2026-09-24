import { formatBaht } from "@/calc/money";
import type { Sex } from "@/calc/types";
import { displayPremium, perDay } from "@/lib/legacy-cta";
import { deathBenefitOf, lifeProtectModes } from "@/lib/lifeprotect-quote";
import { lifeProtectTable } from "@/lib/lifeprotect-table";
import type { NumberSheet } from "./numbers";

/**
 * Each plan the ตัวเลขชัดๆ angle can price: three people, the claim lines the owner approved
 * (spec 2026-09-24), and how to price one person. A person the engine cannot price today —
 * an age off the table, a lapsed rate table — is skipped, and a plan with nobody left gives
 * no sheets, so the angle says so instead of writing a post without figures.
 */

interface Person { sex: Sex; age: number; sum: number; term: string }

interface NumbersPlan {
  product: string;
  cases: Person[];
  /** fixed wording; a {double} is filled from the engine */
  claims: string[];
  price: (p: Person, claims: string[], today: Date) => NumberSheet | null;
}

const sexWord = (s: Sex) => (s === "F" ? "หญิง" : "ชาย");
const money = (baht: number) => baht.toLocaleString("en-US");

/** piece i's two claims: consecutive pairs round the list, so a round of three differs */
export function claimsFor(list: string[], i: number): string[] {
  return [list[(i * 2) % list.length], list[(i * 2 + 1) % list.length]];
}

export const NUMBERS_PLANS: Record<string, NumbersPlan> = {
  "/lifeprotect": {
    product: "Life Protect x 2",
    cases: [
      { sex: "M", age: 35, sum: 1_000_000, term: "WLF99H" },
      { sex: "F", age: 30, sum: 500_000, term: "WLF19H" },
      { sex: "M", age: 45, sum: 1_000_000, term: "WLF19H" },
    ],
    claims: [
      "เบี้ยไม่เพิ่ม",
      "เบี้ยไม่ทิ้ง คุ้มครองถึงอายุ 99",
      "เสียชีวิตก่อน 60 รับ {double} บาท",
      "จ่ายจบได้ใน 9 หรือ 19 ปี",
    ],
    price: (p, claims, today) => {
      const table = lifeProtectTable(today);
      const term = table.terms.find((t) => t.variant === p.term);
      if (!term || table.expired) return null;
      const modes = lifeProtectModes(table, term, { sex: p.sex, age: p.age, sumAssured: p.sum });
      const shown = displayPremium(modes, table.expired);
      const annual = modes?.find((m) => m.mode === "annual");
      if (!shown || !annual) return null;
      const per = shown.mode === "monthly" ? "ต่อเดือน" : "ต่อปี";
      const perShort = shown.mode === "monthly" ? "/เดือน" : "/ปี";
      const double = money(deathBenefitOf(table, p.age, p.sum).sumBefore);
      const day = money(perDay(annual.total));
      // the doubled sum is only true while the insured is under the booster age
      const usable = claims.filter((c) => !c.includes("{double}") || p.age < table.boosterBeforeAge);
      return {
        product: "Life Protect x 2",
        sumLine: `ประกันชีวิตทุน ${money(p.sum)} บาท`,
        premiumLine: `เบี้ย ${formatBaht(shown.total)} บาท ${per}`,
        perDayLine: `ตกวันละ ${day} บาท`,
        claims: usable.map((c) => c.replace("{double}", double)),
        who: `${sexWord(p.sex)} ${p.age} ปี ${term.label}`,
        poster: {
          big: `เบี้ย ${formatBaht(shown.total)} บาท${perShort}`,
          small: `ทุน ${money(p.sum)} บาท · ตกวันละ ${day} บาท`,
        },
      };
    },
  },
};

/** `count` sheets for a round, one person each in turn; empty when nobody can be priced. */
export function numberSheets(href: string, count: number, today: Date = new Date()): NumberSheet[] {
  const plan = NUMBERS_PLANS[href];
  if (!plan) return [];
  const priced = plan.cases.filter((c) => plan.price(c, plan.claims, today) !== null);
  if (priced.length === 0) return [];
  return Array.from({ length: count }, (_, n) => plan.price(priced[n % priced.length], claimsFor(plan.claims, n), today)!);
}
