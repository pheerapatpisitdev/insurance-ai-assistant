import Link from "next/link";
import { Fold, H2, Rule } from "@/components/sales/Blocks";
import type { LifeProtectCopyFacts } from "@/lib/lifeprotect-facts";

/**
 * What sets a level-premium, limited-pay whole life apart from the cover people think they
 * already have. Three counted points, as on /legacy: a reckoning, not a feature list.
 */
export function WhySection() {
  const points = [
    { title: "เบี้ยเท่าเดิมทุกปี", body: "คิดจากอายุวันที่เริ่ม ไม่ขึ้นตามอายุ ไม่ต้องลุ้นทุกปีว่าจะจ่ายไหวไหม" },
    { title: "จ่าย 9 หรือ 19 ปีแล้วจบ", body: "แต่ความคุ้มครองอยู่ถึงอายุ 99 จ่ายจบตอนยังทำงานอยู่ ไม่ต้องจ่ายตอนเกษียณ" },
    { title: "ไม่ใช่จ่ายทิ้ง", body: "กรมธรรม์มีมูลค่าเงินสดสะสม ต้องใช้ฉุกเฉินก็เวนคืนหรือกู้ได้ตามเงื่อนไข" },
  ];
  return (
    <section className="py-12">
      <H2>ประกันที่จ่ายจบ แล้วอยู่กับครอบครัวไปตลอด</H2>
      <div className="mt-7 space-y-6">
        {points.map((p, i) => (
          <div key={p.title} className="flex gap-4">
            <span className="lg-figure shrink-0 text-sm tabular-nums text-[var(--lg-gold)]">
              {String(i + 1).padStart(2, "0")}
            </span>
            <div>
              <div className="font-medium text-[var(--lg-white)]">{p.title}</div>
              <p className="mt-1.5 text-sm leading-[1.85] text-[var(--lg-mute)]">{p.body}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/** The secondary promise, in the page's only framed panel. */
export function DoubleSection({ facts }: { facts: LifeProtectCopyFacts }) {
  return (
    <section className="relative overflow-hidden rounded-sm border border-[var(--lg-hair)] bg-[var(--lg-raise)] px-6 py-9">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-24 h-48 bg-[radial-gradient(60%_100%_at_50%_100%,var(--lg-gold-glow),transparent_70%)]"
      />
      <h2 className="relative text-[1.4rem] font-medium leading-snug sm:text-2xl">
        <span className="text-[var(--lg-mute)]">ช่วงที่ครอบครัวพึ่งคุณที่สุด</span>
        <br />
        <span className="lg-metal-text">ก่อนอายุ {facts.boosterBeforeAge} ครอบครัวได้ 2 เท่าของทุน</span>
      </h2>
      <p className="relative mt-5 text-sm leading-[1.9] text-[var(--lg-mute)]">
        ช่วงที่ลูกยังเรียน บ้านยังผ่อน คือช่วงที่การจากไปกระทบหนักที่สุด แบบนี้จึงจ่ายสองเท่าในช่วงนั้น
      </p>
      <p className="relative mt-4 text-sm leading-[1.9] text-[var(--lg-mute)]">
        ทุน {facts.double.sum} บาท → เสียชีวิตก่อนอายุ {facts.boosterBeforeAge} ได้{" "}
        <span className="font-medium text-[var(--lg-gold)]">{facts.double.before} บาท</span>{" "}
        ตั้งแต่อายุ {facts.boosterBeforeAge} ถึง {facts.coverToAge} ได้ {facts.double.sum} บาท
      </p>
    </section>
  );
}

/**
 * The three terms side by side for one insured, so the choice the calculator asks for has
 * something to lean on. The figures are the engine's; when the table has lapsed the block
 * keeps its advice and drops its numbers.
 */
export function TermsSection({ facts }: { facts: LifeProtectCopyFacts }) {
  const advice = [
    "เหมาะกับคนที่อยากปิดภาระเร็ว จ่ายรวมน้อยที่สุด",
    "ตรงกลาง จ่ายจบก่อนเกษียณ — แบบที่เราแนะนำ",
    "เบี้ยต่อเดือนต่ำสุด สำหรับคนที่ต้องการทุนสูงด้วยงบต่อเดือนจำกัด",
  ];
  return (
    <section className="py-12">
      <H2>เลือกงวดชำระแบบไหนดี</H2>
      <p className="mt-2 text-sm text-[var(--lg-mute)]">
        ตัวอย่าง{facts.example.sex === "M" ? "ชาย" : "หญิง"}อายุ {facts.example.age} ทุน {facts.example.sum} บาท
      </p>
      <div className="mt-7 space-y-6">
        {facts.example.terms.map((t, i) => (
          <div key={t.label} className="border-b border-[var(--lg-panel-line)] pb-5 last:border-b-0">
            <div className="flex items-baseline justify-between gap-3">
              <div className="font-medium text-[var(--lg-white)]">{t.label}</div>
              {t.premium && (
                <div className="lg-figure text-lg tabular-nums text-[var(--lg-white)]">
                  {t.premium} <span className="text-sm text-[var(--lg-mute)]">บาท{t.per}</span>
                </div>
              )}
            </div>
            <p className="mt-1.5 text-sm leading-[1.85] text-[var(--lg-mute)]">
              จ่าย {t.years} ปี{t.total ? ` รวมประมาณ ${t.total} บาท` : ""} · {advice[i]}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

/** The second buyer: a parent, for whom the level premium is at its cheapest. */
export function ChildSection({ facts }: { facts: LifeProtectCopyFacts }) {
  const n = facts.newborn;
  return (
    <section className="pb-12">
      <Rule />
      <div className="pt-8">
        <H2>ของขวัญที่จ่ายจบก่อนลูกเรียนจบ</H2>
        <p className="mt-5 text-sm leading-[1.9] text-[var(--lg-mute)]">
          ลูกชายแรกเกิด ทุน {n.sum} บาท {n.termLabel}
          {n.premium ? (
            <> ราว <span className="font-medium text-[var(--lg-white)]">{n.premium} บาท{n.per}</span></>
          ) : null}
          {" "}เบี้ยล็อกที่อายุแรกเกิดตลอด {n.years} ปี พอลูกอายุ {n.years} พ่อแม่จ่ายจบ ลูกมีประกันชีวิตติดตัวถึงอายุ{" "}
          {facts.coverToAge} พร้อมมูลค่าเงินสดที่โตขึ้นทุกปี
        </p>
        <p className="mt-3 text-xs text-[var(--lg-mute)] opacity-75">ผู้เยาว์ต้องมีผู้ชำระเบี้ย ทักมาให้เราจัดให้</p>
      </div>
    </section>
  );
}

/** The objections, answered before they are raised. Whether the premium rises leads. */
export function FaqSection({ facts }: { facts: LifeProtectCopyFacts }) {
  const faqs: { q: string; a: React.ReactNode }[] = [
    {
      q: "เบี้ยจะขึ้นไหม",
      a: "ไม่ขึ้น เบี้ยของแบบหลักคิดจากอายุวันที่เริ่ม และคงที่ตลอดระยะเวลาชำระ ต่างจากสัญญาเพิ่มเติมโรคร้ายแรงที่ปรับตามอายุ",
    },
    {
      q: "ต้องตรวจสุขภาพไหม",
      a: "ขึ้นกับอายุ ทุน และประวัติสุขภาพ ตัวแทนเช็กให้ได้ก่อนสมัคร เบี้ยที่แสดงในหน้านี้เป็นเบี้ยมาตรฐาน",
    },
    {
      q: "จ่ายจบแล้วยังคุ้มครองอยู่ไหม",
      a: `อยู่ถึงอายุ ${facts.coverToAge} ปี ไม่ต้องจ่ายอะไรเพิ่ม`,
    },
    {
      q: "เวนคืนได้ไหม ได้เท่าไหร่",
      a: `ได้ตามตารางมูลค่าเวนคืนในกรมธรรม์ เช่น ชายอายุ ${facts.example.age} ทุน ${facts.example.sum} บาท จ่าย 19 ปี ที่อายุ 60 มีมูลค่าเงินสดราว ${facts.cash60} บาท เวนคืนแล้วความคุ้มครองสิ้นสุด`,
    },
    {
      q: "ต่างจาก “มรดกเพื่อครอบครัว” ยังไง",
      a: (
        <>
          ชุดนั้นใช้แบบเดียวกันนี้เป็นฐาน แล้วเพิ่มสัญญาโรคร้ายแรง ได้เงินก้อนตอนป่วยหนักด้วย
          แต่เบี้ยส่วนโรคร้ายแรงขึ้นทุกปีและคุ้มครองถึงอายุ 75 แบบนี้ไม่มีโรคร้ายแรง แต่เบี้ยไม่ขยับและจ่ายจบได้{" "}
          <Link href="/legacy" className="text-[var(--lg-gold)] underline underline-offset-4">ดูชุดมรดกเพื่อครอบครัว</Link>
        </>
      ),
    },
    {
      q: "จ่ายไม่ไหวกลางทางทำยังไง",
      a: "ปรับลดทุนได้ หรือใช้มูลค่าเงินสดตามเงื่อนไขของกรมธรรม์ คุยกับตัวแทนก่อนขาดส่ง อย่าปล่อยให้กรมธรรม์สิ้นผลไปเอง",
    },
    {
      q: "สมัครยังไง",
      a: "ทักแชท บอกอายุ ทุน และงวดที่ต้องการ ตัวแทนส่งใบเสนอฉบับเต็มให้ดูก่อนตัดสินใจ ปรึกษาไม่มีค่าใช้จ่าย",
    },
  ];
  return (
    <section className="pb-12">
      <H2>คำถามที่พบบ่อย</H2>
      <div className="mt-5 border-t border-[var(--lg-panel-line)]">
        {faqs.map((f) => (
          <Fold key={f.q} summary={f.q}>{f.a}</Fold>
        ))}
      </div>
    </section>
  );
}

/** What the figures on this page are and are not. Required of any insurance advertisement. */
export function Disclaimer({ facts }: { facts: LifeProtectCopyFacts }) {
  return (
    <footer className="pb-10">
      <Rule />
      <div className="pt-7 text-xs leading-[1.9] text-[var(--lg-mute)] opacity-80">
        <p>
          {facts.expired
            ? "ตารางเบี้ยชุดที่ใช้คำนวณหมดอายุแล้ว หน้านี้จึงไม่แสดงเบี้ย ขอราคาปัจจุบันได้ทางแชท"
            : `เบี้ยที่แสดงเป็นเบี้ยมาตรฐานโดยประมาณ คำนวณจากตารางเบี้ยฉบับ ${facts.rateVersion} ใช้ประกอบการตัดสินใจเบื้องต้นเท่านั้น ไม่ใช่ใบเสนอราคาและไม่ใช่ส่วนหนึ่งของสัญญาประกันภัย`}
        </p>
        <p className="mt-2.5">
          มูลค่าเวนคืนเป็นไปตามตารางในกรมธรรม์ ความคุ้มครองและข้อยกเว้นเป็นไปตามที่ระบุในกรมธรรม์
          การพิจารณารับประกันเป็นไปตามหลักเกณฑ์ของบริษัท
        </p>
        <p className="mt-2.5 font-medium text-[var(--lg-white)]">
          ผู้ซื้อควรทำความเข้าใจรายละเอียดความคุ้มครองและเงื่อนไขก่อนตัดสินใจทำประกันภัยทุกครั้ง
        </p>
      </div>
    </footer>
  );
}
