import Link from "next/link";
import { Fold, H2, Rule } from "@/components/sales/Blocks";
import type { LifeProtectCopyFacts } from "@/lib/lifeprotect-facts";

/**
 * The page's pitch, in its only framed panel and straight after the price: the sum the
 * customer chose, and twice it for the family while the children are still young. The
 * worked example uses the same insured as the calculator's opening state, so a reader who
 * has just seen 2,583 a month sees what that buys.
 */
export function DoubleSection({ facts }: { facts: LifeProtectCopyFacts }) {
  const term19 = facts.example.terms[1];
  return (
    <section className="relative overflow-hidden rounded-sm border border-[var(--lg-hair)] bg-[var(--lg-raise)] px-6 py-9">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-24 h-48 bg-[radial-gradient(60%_100%_at_50%_100%,var(--lg-gold-glow),transparent_70%)]"
      />
      <h2 className="relative text-[1.4rem] font-medium leading-snug sm:text-2xl">
        <span className="text-[var(--lg-mute)]">จ่ายเบี้ยจากทุน {facts.double.sumShort}</span>
        <br />
        <span className="lg-metal-text">แต่ครอบครัวได้ {facts.double.beforeShort}</span>
      </h2>
      <p className="relative mt-5 text-sm leading-[1.9] text-[var(--lg-mute)]">
        แบบนี้จ่ายเพิ่มอีก 1 เท่าของทุน เมื่อเสียชีวิตก่อนครบรอบปีกรมธรรม์ที่อายุ {facts.boosterBeforeAge}{" "}
        <span className="font-medium text-[var(--lg-white)]">
          ช่วงที่ลูกยังเรียน บ้านยังผ่อน และครอบครัวพึ่งรายได้ของคุณมากที่สุด
        </span>
      </p>
      <p className="relative mt-4 text-sm leading-[1.9] text-[var(--lg-mute)]">
        ชายอายุ {facts.example.age} ทำทุน {facts.example.sum} บาท {term19.label}
        {term19.premium ? ` เดือนละ ${term19.premium} บาท` : ""} ถ้าจากไปก่อนอายุ {facts.boosterBeforeAge} ครอบครัวได้{" "}
        <span className="font-medium text-[var(--lg-gold)]">{facts.double.before} บาท</span>{" "}
        ตั้งแต่อายุ {facts.boosterBeforeAge} ถึง {facts.coverToAge} ได้ {facts.double.sum} บาท
      </p>
    </section>
  );
}

/**
 * Why twice the sum is the thing to buy, in three counted points: it lands in the years
 * that matter, the premium is level and stops, and the cover does not end at 60.
 */
export function WhySection({ facts }: { facts: LifeProtectCopyFacts }) {
  const points = [
    {
      title: "ได้ 2 เท่าในช่วงที่เสี่ยงที่สุด",
      body: `อายุ 30–59 คือช่วงที่ภาระหนักที่สุดและครอบครัวขาดคุณไม่ได้ แบบนี้จ่าย 2 เท่าตรงช่วงนั้นพอดี ทุน ${facts.double.sum} จึงเป็น ${facts.double.before} ในวันที่ต้องใช้`,
    },
    {
      title: "เบี้ยเท่าเดิมทุกปี และจ่ายจบ",
      body: "เบี้ยคิดจากอายุวันที่เริ่ม ไม่ขึ้นตามอายุ เลือกจ่าย 9 หรือ 19 ปีแล้วจบ ความคุ้มครองอยู่ต่อโดยไม่ต้องจ่ายอีก",
    },
    {
      title: `หลังอายุ ${facts.boosterBeforeAge} ยังอยู่ต่อถึง ${facts.coverToAge}`,
      body: "ความคุ้มครองเท่าทุนต่อจนถึงอายุ 99 พร้อมมูลค่าเงินสดสะสมที่เวนคืนหรือกู้ได้ตามเงื่อนไข ไม่ใช่จ่ายทิ้ง",
    },
  ];
  return (
    <section className="py-12">
      <H2>ทุนเท่ากัน แต่ครอบครัวได้มากกว่า</H2>
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
        {" "}— ทุกแบบครอบครัวได้ {facts.double.before} ก่อนอายุ {facts.boosterBeforeAge} เท่ากัน ต่างกันที่จ่ายกี่ปี
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

/**
 * The second buyer: a parent. For a newborn the doubled sum runs for sixty years, and the
 * level premium is at its cheapest, so the same arithmetic reads even better here.
 */
export function ChildSection({ facts }: { facts: LifeProtectCopyFacts }) {
  const n = facts.newborn;
  return (
    <section className="pb-12">
      <Rule />
      <div className="pt-8">
        <H2>ให้ลูก: ทุนคูณสองไปจนถึงอายุ {facts.boosterBeforeAge} ของเขา</H2>
        <p className="mt-5 text-sm leading-[1.9] text-[var(--lg-mute)]">
          ลูกชายแรกเกิด ทำทุน {n.sum} บาท {n.termLabel}
          {n.premium ? (
            <> ราว <span className="font-medium text-[var(--lg-white)]">{n.premium} บาท{n.per}</span></>
          ) : null}
          {" "}พ่อแม่จ่ายจบตอนลูกอายุ {n.years} ลูกมีความคุ้มครอง{" "}
          <span className="font-medium text-[var(--lg-gold)]">{n.double} บาท</span> ติดตัวไปจนถึงอายุ {facts.boosterBeforeAge}{" "}
          แล้วต่อด้วย {n.sum} บาทถึงอายุ {facts.coverToAge} พร้อมมูลค่าเงินสดที่โตขึ้นทุกปี เบี้ยล็อกที่อายุแรกเกิดตลอด {n.years} ปี
        </p>
        <p className="mt-3 text-xs text-[var(--lg-mute)] opacity-75">ผู้เยาว์ต้องมีผู้ชำระเบี้ย ทักมาให้เราจัดให้</p>
      </div>
    </section>
  );
}

/** The objections, answered before they are raised. Where the doubling comes from leads. */
export function FaqSection({ facts }: { facts: LifeProtectCopyFacts }) {
  const faqs: { q: string; a: React.ReactNode }[] = [
    {
      q: "ทำไมครอบครัวถึงได้ 2 เท่า",
      a: `Life Protect+ 100 จ่ายทุนประกันบวกเพิ่มอีก 1 เท่า เมื่อเสียชีวิตก่อนครบรอบปีกรมธรรม์ที่อายุ ${facts.boosterBeforeAge} ตั้งแต่อายุ ${facts.boosterBeforeAge} เป็นต้นไปจ่ายเท่าทุนจนถึงอายุ ${facts.coverToAge} เป็นเงื่อนไขของแบบประกันเอง ไม่ต้องซื้อสัญญาเพิ่มเติม`,
    },
    {
      q: `ถ้าเริ่มทำตอนอายุ ${facts.boosterBeforeAge} ขึ้นไป ยังได้ 2 เท่าไหม`,
      a: `ไม่ได้ ส่วนเพิ่มมีเฉพาะก่อนอายุ ${facts.boosterBeforeAge} ตัวคำนวณด้านบนจะแสดงความคุ้มครองเท่าทุนให้เห็นตรง ๆ เมื่อเลือกอายุตั้งแต่ ${facts.boosterBeforeAge} ปี`,
    },
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
          ผลประโยชน์ 2 เท่าจ่ายเมื่อเสียชีวิตก่อนครบรอบปีกรมธรรม์ที่อายุ {facts.boosterBeforeAge} ตามเงื่อนไขในกรมธรรม์
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
