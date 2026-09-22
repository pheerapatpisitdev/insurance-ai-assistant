import { pensionFacts } from "@/lib/pension-facts";
import { Hero } from "@/components/pension/Hero";
import { PensionCalculator } from "@/components/pension/PensionCalculator";
import {
  Disclaimer, FaqSection, TaxSection, WhatItPaysSection, WhySection,
} from "@/components/pension/Sections";

export const metadata = {
  title: "บำนาญ สมาร์ท 95 — รับบำนาญทุกปีจนถึงอายุ 95",
  description:
    "ประกันบำนาญลดหย่อนภาษีได้ เลือกรับบำนาญตั้งแต่อายุ 55 60 65 หรือ 70 ถึงอายุ 95 บำนาญเพิ่มขึ้นตามอายุ "
    + "รับประกันจ่าย 15 ปีแรก คำนวณเบี้ยจากบำนาญที่อยากได้ต่อเดือนได้ทันที",
};

/**
 * The problem retirement has, the calculator, what the contract pays, why an annuity, what
 * it takes off this year's tax, and what is still being worried about.
 *
 * The calculator comes second, not last: the reader of this page has one question — "what
 * does 10,000 a month cost me" — and every section after it is for someone who has seen the
 * answer and is deciding.
 */
export default function PensionPage() {
  const facts = pensionFacts();
  return (
    <main className="mx-auto max-w-lg px-4 pb-28 sm:max-w-2xl sm:pb-10">
      <Hero facts={facts} />
      <section id="calc" className="scroll-mt-4">
        <PensionCalculator sticky />
      </section>
      <div className="mt-12">
        <WhatItPaysSection facts={facts} />
      </div>
      <WhySection />
      <TaxSection />
      <FaqSection facts={facts} />
      <Disclaimer facts={facts} />
    </main>
  );
}
