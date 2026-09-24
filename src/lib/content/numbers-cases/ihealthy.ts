import type { Sex } from "@/calc/types";
import { IHEALTHY_OPENING } from "@/lib/ihealthy-choice";
import { iHealthyFacts } from "@/lib/ihealthy-facts";
import { baseAt, iHealthyPricing } from "@/lib/ihealthy-quote";
import { iHealthyTable } from "@/lib/ihealthy-table";
import { definePlan, money, sexWord } from "../numbers";
import { priceLines } from "./price-lines";

/** the Health Ultra Package: its base at a fixed sum, the IHU plan, and the standard daily cash */
const PACKAGE = "WLF99HX";

/**
 * iHealthy Ultra as the Health Ultra Package — the owner lifted "ห้ามระบุเบี้ย" for this
 * angle on 2026-09-24, priced as a package. Health cover is priced on age every year, so
 * every premium is the first year's, for the package as a whole. Thailand, full coverage:
 * the arrangement the page and the chat open on.
 */
export const iHealthyNumbers = definePlan<{ sex: Sex; age: number; plan: string }>({
  product: "iHealthy Ultra",
  cases: [
    { sex: "F", age: 30, plan: "SMART" },
    { sex: "M", age: 35, plan: "BRONZE" },
    { sex: "F", age: 45, plan: "SILVER" },
  ],
  claims: [
    "เหมาจ่ายค่ารักษาต่อปี",
    "ต่ออายุได้ถึงอายุ {renew}",
    "ไม่เคลม 3 ปีติดต่อกัน ลดเบี้ย {ncd}%",
  ],
  price: (p, claims, today) => {
    const table = iHealthyTable(today);
    const plan = table.plans.find((x) => x.code === p.plan);
    if (table.expired || !plan) return null;
    const base = baseAt(table, PACKAGE);
    const sum = base.fixedSum ?? base.saMin;
    const priced = iHealthyPricing(table, {
      base: PACKAGE, sex: p.sex, age: p.age, sumAssured: sum, plan: p.plan,
      territory: IHEALTHY_OPENING.territory, coverage: IHEALTHY_OPENING.coverage,
    });
    const lines = priceLines(priced?.total, table.expired, true);
    if (!priced || !lines) return null;
    const { terms } = iHealthyFacts();
    return {
      product: "iHealthy Ultra",
      sumLine: `ประกันสุขภาพวงเงินค่ารักษาปีละ ${money(plan.annualMax)} บาท`,
      sumNote: `แพ็กเกจรวมประกันชีวิตทุน ${money(sum)} บาท${priced.standard ? " และค่าชดเชยรายวัน" : ""}`,
      premiumLine: lines.premiumLine,
      perDayLine: lines.perDayLine,
      claims: claims.map((c) => c.replace("{renew}", String(terms.renewalToAge)).replace("{ncd}", String(terms.noClaimDiscountPercent))),
      who: `${sexWord(p.sex)} ${p.age} ปี`,
      poster: { big: lines.big, small: `วงเงินปีละ ${money(plan.annualMax)} บาท · ปีแรกตกวันละ ${lines.day} บาท` },
    };
  },
});
