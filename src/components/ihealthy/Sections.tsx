import { Fold, H2, Rule } from "@/components/sales/Blocks";
import type { IHealthyFacts } from "@/lib/ihealthy-facts";

const millions = (baht: number) => (baht / 1_000_000).toLocaleString("en-US");

export function Hero({ facts }: { facts: IHealthyFacts }) {
  const ceilings = facts.plans.map((p) => p.annualMax);
  return (
    <header className="ihu-hero">
      <div className="ihu-eyebrow">
        <svg width="20" height="22" viewBox="0 0 24 26" fill="none" aria-hidden="true">
          <path d="M12 2 3 6v7c0 5 5 9 9 11 4-2 9-6 9-11V6L12 2Z" stroke="currentColor" strokeWidth="1.7" />
          <path d="M12 8v8M8 12h8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
        ประกันสุขภาพ · iHealthy Ultra
      </div>
      <h1>
        <span className="ihu-title-label">ค่ารักษาพยาบาล</span>
        <span className="ihu-title-name">iHealthy <span>Ultra</span></span>
      </h1>
      <p className="ihu-intro">
        เหมาจ่ายค่ารักษาต่อปี ตั้งแต่ {millions(Math.min(...ceilings))} ล้าน
        ถึงสูงสุด {millions(Math.max(...ceilings))} ล้านบาท
        เลือกได้ {facts.plans.length} แผน ต่ออายุได้ถึงอายุ {facts.terms.renewalToAge} ปี
      </p>
      <div className="ihu-highlights" aria-label="จุดเด่นความคุ้มครอง">
        <div><span>วงเงินสูงสุดต่อปี</span><strong>{millions(Math.max(...ceilings))} <small>ล้านบาท</small></strong></div>
        <div><span>เลือกความคุ้มครอง</span><strong>{facts.plans.length} <small>แผน</small></strong></div>
        <div><span>ต่ออายุได้ถึง</span><strong>{facts.terms.renewalToAge} <small>ปี</small></strong></div>
      </div>
      <div className="ihu-section-label"><span>ออกแบบความคุ้มครองของคุณ</span><span aria-hidden="true">↓</span></div>
    </header>
  );
}

export function TermsSection({ facts }: { facts: IHealthyFacts }) {
  const t = facts.terms;
  return (
    <section className="py-10">
      <H2>เงื่อนไขที่ต้องรู้ก่อนตัดสินใจ</H2>
      <div className="mt-5">
        <Fold summary={`ไม่คุ้มครอง ${t.waitingDays} วันแรก และ ${t.specialWaitingDays} วันแรกสำหรับบางโรค`}>
          <p>
            การป่วยที่เกิดใน {t.waitingDays} วันแรกนับจากวันเริ่มคุ้มครองไม่ได้รับความคุ้มครอง
            และอีก {t.specialWaitingDiseases.length} กลุ่มโรคนี้ต้องรอถึง {t.specialWaitingDays} วัน
          </p>
          <ul className="mt-2 grid gap-x-6 gap-y-1 sm:grid-cols-2">
            {t.specialWaitingDiseases.map((d) => <li key={d}>· {d}</li>)}
          </ul>
        </Fold>
        <Fold summary="สภาพที่เป็นมาก่อนทำประกัน">
          <p>{t.preExisting}</p>
        </Fold>
        {/* Three years, which is what the paragraph inside says. "ทั้งปี" appears nowhere in
            the contract: it was a compression that changed the condition, on the one line a
            reader sees without opening anything. */}
        <Fold summary={`ไม่เคลม 3 ปีติดต่อกัน ลดเบี้ย ${t.noClaimDiscountPercent} เปอร์เซ็นต์`}>
          <p>{t.noClaimDiscount}</p>
        </Fold>
        <Fold summary="บริษัทขอให้ร่วมจ่ายตอนต่ออายุได้">
          <p>{t.renewalCopay}</p>
        </Fold>
        <Fold summary="เบี้ยปีต่ออายุเปลี่ยนได้">
          <p>{t.premiumChanges}</p>
        </Fold>
        <Fold summary={`รักษานอกอาณาเขต คุ้มครองฉุกเฉิน ${t.outOfTerritoryDays} วันแรกของการเดินทาง`}>
          <p>{t.outOfTerritory}</p>
        </Fold>
        {/* how many there are is the company's own first sentence; counting them again here
            would be a number nobody re-reads when the contract is re-issued */}
        <Fold summary="ข้อยกเว้นที่บริษัทไม่คุ้มครอง">
          <p>{t.exclusions}</p>
        </Fold>
      </div>
    </section>
  );
}

export function Disclaimer({ facts, rateVersion }: { facts: IHealthyFacts; rateVersion: string }) {
  return (
    <section className="py-10">
      <Rule />
      <p className="pt-6 text-xs leading-[1.9] text-[var(--lg-mute)] opacity-80">
        {facts.disclaimer}
      </p>
      <p className="mt-3 text-xs leading-[1.9] text-[var(--lg-mute)] opacity-80">
        เบี้ยที่แสดงเป็นเบี้ยปีแรกของอาชีพชั้น 1 เบี้ยปีต่อไปคิดตามอายุที่เพิ่มขึ้น ·
        ไม่ใช่ใบเสนอราคา เบี้ยและความคุ้มครองจริงเป็นไปตามผลการพิจารณารับประกัน ·
        อัตราเบี้ยชุด {rateVersion}
      </p>
    </section>
  );
}
