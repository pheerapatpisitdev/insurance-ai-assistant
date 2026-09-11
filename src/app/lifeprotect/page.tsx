import { LifeProtectCalculator } from "@/components/LifeProtectCalculator";
import { lifeProtectTable } from "@/lib/lifeprotect-table";
import { lifeProtectFacts } from "@/lib/lifeprotect-facts";
import { Hero } from "@/components/lifeprotect/Hero";
import {
  ChildSection, Disclaimer, DoubleSection, FaqSection, TermsSection, WhySection,
} from "@/components/lifeprotect/Sections";

export const metadata = {
  title: "Life Protect+ 100 — ทำทุน 1 ล้าน ครอบครัวได้ 2 ล้าน",
  description:
    "ประกันชีวิตตลอดชีพ เสียชีวิตก่อนอายุ 60 ครอบครัวได้ 2 เท่าของทุน เบี้ยเท่าเดิมทุกปี เลือกจ่าย 9 ปี 19 ปี หรือถึงอายุ 99 คำนวณเบี้ยของคุณเองได้ทันที",
};

/**
 * What is this, what does it cost, why twice the sum, what else is true of it, which term,
 * who else is it for, what am I still worried about. The doubled sum is the page's pitch, so
 * its panel comes straight after the price rather than after the reasons.
 */
export default async function LifeProtectPage() {
  const table = lifeProtectTable();
  const facts = lifeProtectFacts();
  return (
    <main className="mx-auto max-w-lg px-4 pb-28 sm:max-w-2xl sm:pb-10 lg:max-w-6xl">
      <Hero facts={facts} />

      {/* One column on a phone and on a tablet held upright, where the reasons have to be
          scrolled past to reach the price. Wide enough for two, the price sits beside the
          reasons instead of below them — a desktop reader compares the two by looking, not
          by scrolling back up. Neither column is pinned: the calculator is the tallest block
          on the page, and a sticky panel taller than the window hides its own bottom, which
          here is the chart and the table. */}
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_26rem] lg:items-start lg:gap-x-14">
        <section id="calc" className="scroll-mt-4 lg:order-2 lg:col-start-2">
          <LifeProtectCalculator table={table} sticky />
        </section>
        <div className="lg:order-1 lg:col-start-1 lg:row-start-1">
          <DoubleSection facts={facts} />
          <WhySection facts={facts} />
          <TermsSection facts={facts} />
          <ChildSection facts={facts} />
          <FaqSection facts={facts} />
        </div>
      </div>

      <Disclaimer facts={facts} />
    </main>
  );
}
