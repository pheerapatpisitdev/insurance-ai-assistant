import { describe, expect, it } from "vitest";
import { quoteCard, type QuoteCard } from "@/lib/quote-card";

const TODAY = new Date("2026-09-23");

/** Every highlighted row on a card, as "section | label". */
function marked(card: QuoteCard | undefined): string[] {
  return (card?.sections ?? []).flatMap((s) => s.rows.filter((r) => r.mark).map((r) => `${s.title} | ${r.label}`));
}

const plan = (planCode: string, variant: string, sumAssured = 1_000_000) =>
  quoteCard({ kind: "plan", planCode, variant, age: 35, sex: "M", sumAssured, mode: "annual" }, TODAY);
const bundle = (bundleCode: string, tier: number) =>
  quoteCard({ kind: "bundle", bundleCode, tier, age: 35, sex: "M", mode: "annual" }, TODAY);

/**
 * One figure per card gets the highlighter, chosen for what the product is bought for — the
 * price lines are marked on every card by the drawing itself. More than one and the yellow
 * stops meaning anything.
 */
describe("the one figure each card highlights", () => {
  it.each([
    ["Life Protect", () => plan("LIFEPROTECT", "WLF99H"), "ครอบครัวได้รับเมื่อเสียชีวิต | เสียชีวิตก่อนอายุ 60 ปี"],
    ["iSmart 80/6", () => plan("ISMART", "W80F06"), "มูลค่าเงินสดสะสม (หากเวนคืน) | อายุ 80 ปี"],
    ["Easy Protect", () => plan("EASYPROTECT", "W99F06A"), "ครอบครัวได้รับเมื่อเสียชีวิต | ทุกช่วงอายุ ถึงอายุ 99"],
    ["Life Treasure", () => plan("LIFETREASURE", "H99F06A", 10_000_000), "ครอบครัวได้รับเมื่อเสียชีวิต | ทุกช่วงอายุ ถึงอายุ 99"],
    ["iShield", () => plan("ISHIELD", "WLCI05"), "รับเงินก้อนเมื่อ | ตรวจพบโรคร้ายแรงระยะรุนแรง (50 โรค)"],
    ["PLB", () => plan("PLB", "PLB05"), "ครอบครัวได้รับเมื่อเสียชีวิต | ตลอด 5 ปีที่คุ้มครอง (ถึงอายุ 40)"],
    ["Family Legacy", () => bundle("LEGACY_FAMILY", 1), "ครอบครัวได้รับเมื่อเสียชีวิต | เสียชีวิตก่อนอายุ 60 ปี"],
    ["CI 123", () => bundle("CI123_SET", 2), "ตรวจพบโรคร้ายแรง รับเงินก้อนตามระยะของโรค | โรคร้ายแรงระยะรุนแรง"],
    ["ประกันมะเร็ง", () => bundle("CANCER_SET", 4), "รวมทุกสัญญา กรณีเสียชีวิตก่อนอายุ 60 ปี | ตรวจพบมะเร็งระยะลุกลาม แล้วเสียชีวิต"],
  ])("%s", (_, card, expected) => {
    expect(marked(card())).toEqual([expected]);
  });
});
