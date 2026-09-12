import { IHealthyCalculator } from "@/components/IHealthyCalculator";
import { iHealthyTable } from "@/lib/ihealthy-table";
import { iHealthyFacts } from "@/lib/ihealthy-facts";
import { IHEALTHY_OPENING } from "@/lib/ihealthy-choice";
import { Disclaimer, Hero, TermsSection } from "@/components/ihealthy/Sections";
import { ExpiryBanner } from "@/components/ExpiryBanner";

export const metadata = {
  title: "ไอเฮลท์ตี้ อัลตร้า — ค่ารักษาพยาบาลเหมาจ่ายถึง 100 ล้านต่อปี",
  description:
    "ประกันสุขภาพเหมาจ่าย 6 แผน วงเงิน 3 ถึง 100 ล้านบาทต่อปี ต่ออายุได้ถึงอายุ 98 ปี เทียบผลประโยชน์ครบ 28 หมวด และคำนวณเบี้ยของคุณเองได้ทันที",
};

/**
 * What it pays, what it costs, and what the contract will not do — in that order, because a
 * health rider is bought on its ceiling and kept or dropped on its exclusions.
 */
export default async function IHealthyPage() {
  const table = iHealthyTable();
  const facts = iHealthyFacts();
  // Only the rows and the plan list cross into the browser. The eight long paragraphs of
  // `terms` are three of the five kilobytes of this JSON and only server components render
  // them, so they never enter the client module graph.
  const { rows, plans, copayPercent } = facts;
  return (
    <main className="mx-auto max-w-lg px-4 pb-28 sm:max-w-2xl sm:pb-10">
      <Hero facts={facts} />
      <ExpiryBanner expired={table.expired} expiresOn={table.expiresOn} />
      <section id="calc" className="scroll-mt-4">
        <IHealthyCalculator
          table={table} data={{ rows, plans, copayPercent }}
          sharedLimit={facts.terms.sharedLimit} initial={IHEALTHY_OPENING}
        />
      </section>
      <TermsSection facts={facts} />
      <Disclaimer facts={facts} rateVersion={table.rateVersion} />
    </main>
  );
}
