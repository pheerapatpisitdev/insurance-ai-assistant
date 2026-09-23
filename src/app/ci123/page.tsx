import { Ci123Calculator } from "@/components/Ci123Calculator";
import { ci123Table } from "@/lib/ci123-table";
import { perDay } from "@/lib/legacy-cta";
import {
  BenefitSection, ClaimSection, Disclaimer, DiseaseSection, FaqSection, Hero, StructureSection, TermsSection,
  WhySection,
} from "@/components/ci123/Sections";

export const metadata = {
  title: "ประกันโรคร้ายแรง CI 123 — เจอเร็ว ก็ได้เงินเร็ว",
  description:
    "คุ้มครอง 122 โรคร้ายแรง จ่ายตั้งแต่ระยะก่อนเริ่มต้นถึงระยะรุนแรง เคลมได้หลายครั้ง ทุน 5 แสน – 10 ล้าน คำนวณเบี้ยของคุณเองได้ทันที",
};

/** The hero quotes a woman of this age on the smallest sum, the cheapest honest opening. */
const FROM_AGE = 30;

/**
 * The same order as /legacy: what it is, what it costs, why now, how it pays, what is in it,
 * which illnesses, how a claim goes, what it will not pay, what is still worrying.
 */
export default async function Ci123Page() {
  const table = ci123Table();
  const from = table.premiums.F[0][FROM_AGE - table.ageMin];
  const fromPerDay = table.expired || !from ? null : perDay(from[0]);
  return (
    <main className="mx-auto max-w-lg px-4 pb-28 sm:max-w-2xl sm:pb-10">
      <Hero table={table} fromPerDay={fromPerDay} fromAge={FROM_AGE} />
      <section id="calc" className="scroll-mt-4">
        <Ci123Calculator table={table} sticky />
      </section>
      <WhySection />
      <BenefitSection table={table} />
      <StructureSection table={table} />
      <DiseaseSection table={table} />
      <ClaimSection />
      <TermsSection />
      <FaqSection table={table} />
      <Disclaimer table={table} />
    </main>
  );
}
