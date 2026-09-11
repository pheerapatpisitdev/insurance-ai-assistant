import { LegacyCalculator } from "@/components/LegacyCalculator";
import { legacyTable } from "@/lib/legacy-table";
import { legacyFacts } from "@/lib/legacy-facts";
import { Hero } from "@/components/legacy/Hero";
import {
  DifferenceSection, DiseaseSection, Disclaimer, FaqSection, StructureSection, WhySection,
} from "@/components/legacy/Sections";

export const metadata = {
  title: "มรดกเพื่อครอบครัว — เตรียมเงินก้อนให้คนข้างหลัง",
  description:
    "เตรียมเงินก้อน 1–10 ล้านบาทให้ครอบครัว จ่ายทั้งกรณีเสียชีวิตและเมื่อตรวจพบ 1 ใน 31 โรคร้ายแรง คำนวณเบี้ยของคุณเองได้ทันที",
};

/**
 * The order answers the questions in the order a stranger asks them: what is this, what does
 * it cost me, why would I need it, what makes it different, what am I buying, what exactly is
 * covered, what am I still worried about.
 *
 * The calculator comes second rather than last because the price is the second question, and
 * a page that makes a cold reader scroll past four blocks to reach it loses them at the
 * first.
 */
export default async function LegacyPage() {
  const table = legacyTable();
  const facts = legacyFacts();
  return (
    <main className="mx-auto max-w-lg px-4 pb-28 sm:pb-10">
      <Hero facts={facts} />
      <section id="calc" className="scroll-mt-4">
        <LegacyCalculator table={table} sticky />
      </section>
      <WhySection />
      <DifferenceSection facts={facts} />
      <StructureSection facts={facts} />
      <DiseaseSection />
      <FaqSection facts={facts} />
      <Disclaimer facts={facts} />
    </main>
  );
}
