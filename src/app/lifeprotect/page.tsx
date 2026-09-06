import { LifeProtectCalculator } from "@/components/LifeProtectCalculator";
import { legacyChannels } from "@/lib/legacy-channels";
import { lifeProtectTable } from "@/lib/lifeprotect-table";
import { lifeProtectFacts } from "@/lib/lifeprotect-facts";
import { Hero } from "@/components/lifeprotect/Hero";
import {
  ChildSection, Disclaimer, DoubleSection, FaqSection, TermsSection, WhySection,
} from "@/components/lifeprotect/Sections";

export const metadata = {
  title: "Life Protect+ 100 — มรดกที่แน่นอน จ่ายจบ ไม่ต้องจ่ายทั้งชีวิต",
  description:
    "ประกันชีวิตตลอดชีพ เลือกจ่าย 9 ปี 19 ปี หรือถึงอายุ 99 เบี้ยคงที่ คุ้มครองถึงอายุ 99 เสียชีวิตก่อน 60 ครอบครัวได้ 2 เท่า คำนวณเบี้ยของคุณเองได้ทันที",
};

/** Regenerated hourly, as /legacy is: the contact channels are read from LINE and the database. */
export const revalidate = 3600;

/**
 * Same order of questions as /legacy — what is this, what does it cost, why would I need it,
 * what else does it do, which term, who else is it for, what am I still worried about.
 */
export default async function LifeProtectPage() {
  const channels = await legacyChannels();
  const table = lifeProtectTable();
  const facts = lifeProtectFacts();
  return (
    <main className="mx-auto max-w-lg px-4 pb-28 sm:pb-10">
      <Hero facts={facts} />
      <section id="calc" className="scroll-mt-4">
        <LifeProtectCalculator table={table} channels={channels} sticky />
      </section>
      <WhySection />
      <DoubleSection facts={facts} />
      <TermsSection facts={facts} />
      <ChildSection facts={facts} />
      <FaqSection facts={facts} />
      <Disclaimer facts={facts} />
    </main>
  );
}
