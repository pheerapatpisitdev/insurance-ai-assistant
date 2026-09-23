import { CancerCalculator } from "@/components/CancerCalculator";
import { cancerTable } from "@/lib/cancer-table";
import { perDay } from "@/lib/legacy-cta";
import {
  BenefitSection, DailySection, Disclaimer, FaqSection, Hero, MoneySection, StatsSection, StructureSection,
  TermsSection,
} from "@/components/cancer/Sections";

export const metadata = {
  title: "ประกันมะเร็ง — เจอมะเร็งระยะแรก ก็ได้เงินก้อน",
  description:
    "จ่ายตามระยะของมะเร็งตั้งแต่ระยะแรก ลุกลามรับเต็มทุนสูงสุด 5 ล้าน พร้อมชดเชยรายวันตอนนอนโรงพยาบาล คำนวณเบี้ยของคุณเองได้ทันที",
};

/** The hero quotes a woman of this age on the smallest tier, the cheapest honest opening. */
const FROM_AGE = 30;

/**
 * The CI 123 page's order, told about cancer: what it is, what it costs, how close cancer
 * is, why a lump sum, how it pays, the daily sum, what is in it, what it will not pay.
 */
export default async function CancerPage() {
  const table = cancerTable();
  const from = table.premiums.F[0][FROM_AGE - table.ageMin];
  const fromPerDay = table.expired || !from ? null : perDay(from[0]);
  return (
    <main className="mx-auto max-w-lg px-4 pb-28 sm:max-w-2xl sm:pb-10">
      <Hero table={table} fromPerDay={fromPerDay} fromAge={FROM_AGE} />
      <section id="calc" className="scroll-mt-4">
        <CancerCalculator table={table} sticky />
      </section>
      <StatsSection />
      <MoneySection />
      <BenefitSection />
      <DailySection table={table} />
      <StructureSection table={table} />
      <TermsSection />
      <FaqSection table={table} />
      <Disclaimer table={table} />
    </main>
  );
}
