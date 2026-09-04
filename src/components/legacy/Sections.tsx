import { riderDiseases } from "@/calc/riders/diseases";

/** A heading that reads at arm's length on a phone, without shouting on a desktop. */
function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[1.4rem] font-medium leading-snug text-[var(--lg-white)] sm:text-2xl">
      {children}
    </h2>
  );
}

/** The engraved hairline that separates one part of the page from the next. */
function Rule() {
  return <hr className="lg-rule" />;
}

/**
 * A folding block. `<details>` is the browser's own — it opens with no JavaScript at all,
 * which on a phone over mobile data is the difference between a list that works and a list
 * that waits for a bundle to arrive.
 */
function Fold({ summary, children }: { summary: string; children: React.ReactNode }) {
  return (
    <details className="group border-b border-[var(--lg-panel-line)] last:border-b-0">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-sm font-medium text-[var(--lg-white)] marker:hidden">
        {summary}
        <span
          aria-hidden
          className="shrink-0 text-lg leading-none text-[var(--lg-gold)] transition-transform duration-300 group-open:rotate-45"
        >
          +
        </span>
      </summary>
      <div className="pb-5 text-sm leading-[1.85] text-[var(--lg-mute)]">{children}</div>
    </details>
  );
}

/**
 * Why any of this matters, in the three obligations that do not stop when an income does.
 * Money owed and children mid-education are the two things a family cannot pause, and the
 * third is the one people believe they have covered because they have savings.
 *
 * Numbered rather than boxed: three counted obligations read as a reckoning, which is what
 * they are.
 */
export function WhySection() {
  const truths = [
    { title: "ลูกยังเรียนไม่จบ", body: "ค่าเรียนจนจบปริญญาตรีเป็นหลักล้าน ถ้าไม่มีคุณ ใครจ่ายต่อ" },
    { title: "บ้านยังผ่อนไม่หมด", body: "หนี้ไม่ได้หายไปพร้อมกับเรา มันตกไปอยู่กับคนที่ยังอยู่" },
    { title: "เงินเก็บมีก้อนเดียว", body: "ค่ารักษาโรคร้ายครั้งเดียวกินเงินเก็บทั้งชีวิต แล้วเหลืออะไรให้ลูก" },
  ];
  return (
    <section className="py-12">
      <H2>เงินที่คุณหาได้ทุกวันนี้ ครอบครัวใช้ต่อได้อีกกี่ปี</H2>
      <div className="mt-7 space-y-6">
        {truths.map((t, i) => (
          <div key={t.title} className="flex gap-4">
            <span className="lg-figure shrink-0 text-sm tabular-nums text-[var(--lg-gold)]">
              {String(i + 1).padStart(2, "0")}
            </span>
            <div>
              <div className="font-medium text-[var(--lg-white)]">{t.title}</div>
              <p className="mt-1.5 text-sm leading-[1.85] text-[var(--lg-mute)]">{t.body}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/**
 * The one thing this arrangement does that a plain legacy policy does not. It is the reason
 * the bundle puts most of the sum into the critical-illness rider rather than the base plan,
 * so it gets the page's only framed panel.
 */
export function DifferenceSection() {
  return (
    <section className="relative overflow-hidden rounded-sm border border-[var(--lg-hair)] bg-[var(--lg-raise)] px-6 py-9">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-24 h-48 bg-[radial-gradient(60%_100%_at_50%_100%,var(--lg-gold-glow),transparent_70%)]"
      />
      <h2 className="relative text-[1.4rem] font-medium leading-snug sm:text-2xl">
        <span className="text-[var(--lg-mute)]">ประกันมรดกทั่วไป จ่ายวันที่คุณไม่อยู่</span>
        <br />
        <span className="lg-metal-text">แบบนี้จ่ายตั้งแต่วันที่คุณยังอยู่</span>
      </h2>
      <p className="relative mt-5 text-sm leading-[1.9] text-[var(--lg-mute)]">
        ตรวจพบมะเร็งระยะลุกลาม เส้นเลือดสมองแตก ไตวายเรื้อรัง หรือ 1 ใน 31 โรคตามคำนิยามในกรมธรรม์{" "}
        <span className="font-medium text-[var(--lg-white)]">รับเงินก้อนเต็มวงเงินทันที</span>{" "}
        เอาไปรักษา เอาไปส่งลูกเรียน เอาไปปิดหนี้บ้าน — ทั้งที่คุณยังอยู่ดูแลเขาเอง
      </p>
      <p className="relative mt-4 text-xs text-[var(--lg-mute)] opacity-70">
        ความคุ้มครองโรคร้ายแรงมีถึงอายุ 75 ปี
      </p>
    </section>
  );
}

/**
 * What the customer is actually buying, itemised. A page that shows a premium without saying
 * what makes it up is asking to be taken on trust by someone who has no reason to give it.
 *
 * Laid out as a deed: the parts, a gold rule, then the sum they come to.
 */
export function StructureSection() {
  const parts = [
    { label: "ประกันชีวิตตลอดชีพ Life Protect x 2 (ชำระเบี้ยถึงอายุ 99)", sum: "150,000" },
    { label: "สัญญาเพิ่มเติมโรคร้ายแรง DCI", sum: "850,000" },
  ];
  return (
    <section className="py-12">
      <H2>ชุดนี้ประกอบด้วยอะไร</H2>
      <p className="mt-2 text-sm text-[var(--lg-mute)]">ตัวอย่างแผนมรดก 1 ล้านบาท</p>
      <div className="mt-7 space-y-5">
        {parts.map((p) => (
          <div key={p.label}>
            <div className="text-sm leading-relaxed text-[var(--lg-mute)]">{p.label}</div>
            <div className="lg-figure mt-1 text-base tabular-nums text-[var(--lg-white)]">
              ทุน {p.sum} บาท
            </div>
          </div>
        ))}
      </div>
      <div className="mt-6">
        <Rule />
        <div className="pt-5">
          <div className="text-sm text-[var(--lg-mute)]">ครอบครัวได้รับ</div>
          <div className="lg-figure mt-1 text-3xl tabular-nums">
            <span className="lg-metal-text">1,000,000</span>{" "}
            <span className="text-lg text-[var(--lg-gold)]">บาท</span>
          </div>
        </div>
      </div>
      <p className="mt-5 text-sm leading-[1.85] text-[var(--lg-mute)]">
        ✦ เสียชีวิตก่อนอายุ 60 ปี ได้ 1,150,000 บาท เพราะทุนหลักจ่ายสองเท่า
      </p>
      <p className="mt-2 text-sm leading-[1.85] text-[var(--lg-mute)] opacity-80">
        สัญญาเพิ่มเติมโรคร้ายแรงคุ้มครองถึงอายุ 75 ปี ตั้งแต่อายุ 75 เป็นต้นไป
        เหลือทุนของประกันชีวิตหลัก 150,000 บาท
      </p>
    </section>
  );
}

/**
 * The illnesses, named. The list comes from the company's own benefit sheet through the
 * calculator's data rather than being retyped here, so a change to the sheet reaches this
 * page too — a sales page listing a cover the policy no longer names is the worst kind of
 * stale.
 */
export function DiseaseSection() {
  const info = riderDiseases("DCI");
  if (!info) return null;
  return (
    <section className="py-12">
      <Rule />
      <div className="pt-8">
        <H2>คุ้มครอง {info.diseases.length} โรคร้ายแรง</H2>
        <div className="mt-5 border-t border-[var(--lg-panel-line)]">
          <Fold summary={`ดูรายชื่อ ${info.diseases.length} โรคที่คุ้มครอง`}>
            <ol className="space-y-1.5 sm:columns-2 sm:gap-x-8">
              {info.diseases.map((d, i) => (
                <li key={d} className="flex gap-2.5 break-inside-avoid">
                  <span className="shrink-0 tabular-nums text-[var(--lg-gold)] opacity-70">
                    {i + 1}.
                  </span>
                  <span>{d}</span>
                </li>
              ))}
            </ol>
            <p className="mt-4 text-xs opacity-75">{info.note}</p>
          </Fold>
        </div>
      </div>
    </section>
  );
}

/**
 * The objections, answered before they are raised. The premium rising with age leads, because
 * it is the fact most likely to be discovered later and resented — said plainly here it turns
 * into the reason to start now, which is what it honestly is.
 */
export function FaqSection() {
  const faqs = [
    {
      q: "เบี้ยคงที่ตลอดไหม",
      a: "ส่วนประกันชีวิตหลักคงที่ ส่วนสัญญาเพิ่มเติมโรคร้ายแรงคิดตามอายุ จึงปรับขึ้นทุกปี ยิ่งเริ่มเร็วยิ่งได้เปรียบ — ชายอายุ 30 วงเงิน 1 ล้าน ปีแรกจ่าย 4,897 บาท ถ้ารอถึงอายุ 45 ปีแรกจ่าย 10,716 บาท เท่าตัวกว่า",
    },
    {
      q: "คุ้มครองยาวถึงอายุเท่าไหร่",
      a: "ประกันชีวิตหลักคุ้มครองถึงอายุ 99 ปี ส่วนสัญญาเพิ่มเติมโรคร้ายแรงคุ้มครองถึงอายุ 75 ปี — แผนมรดก 1 ล้าน ครอบครัวจึงได้ 1 ล้านเมื่อเสียชีวิตก่อนอายุ 75 และได้ทุนของสัญญาหลัก 150,000 บาท ตั้งแต่อายุ 75 เป็นต้นไป ถ้าต้องการวงเงินเต็มยาวกว่านี้ ทักมาคุยกัน มีแบบอื่นที่จัดให้ได้",
    },
    {
      q: "ต้องตรวจสุขภาพไหม",
      a: "ขึ้นกับอายุ วงเงิน และประวัติสุขภาพ บางกรณีตอบคำถามสุขภาพอย่างเดียว บางกรณีบริษัทขอให้ตรวจ ตัวแทนเช็กให้ได้ก่อนสมัคร",
    },
    {
      q: "ถ้าเป็นโรคร้ายแรงแล้วได้เงินไปแล้ว ครอบครัวยังได้อีกไหม",
      a: "สัญญาเพิ่มเติมโรคร้ายแรงจ่ายครั้งเดียวแล้วสิ้นสุด ส่วนประกันชีวิตหลักยังอยู่ และจ่ายให้ครอบครัวเมื่อเสียชีวิต",
    },
    {
      q: "จ่ายไม่ไหวกลางทางทำยังไง",
      a: "ปรับลดวงเงินหรือเปลี่ยนงวดชำระได้ คุยกับตัวแทนก่อนขาดส่ง อย่าปล่อยให้กรมธรรม์สิ้นผลไปเอง",
    },
    {
      q: "สมัครยังไง",
      a: "ทักแชท บอกอายุกับวงเงินที่ต้องการ ตัวแทนส่งใบเสนอฉบับเต็มให้ดูก่อนตัดสินใจ ปรึกษาไม่มีค่าใช้จ่าย",
    },
  ];
  return (
    <section className="pb-12">
      <H2>คำถามที่พบบ่อย</H2>
      <div className="mt-5 border-t border-[var(--lg-panel-line)]">
        {faqs.map((f) => (
          <Fold key={f.q} summary={f.q}>
            {f.a}
          </Fold>
        ))}
      </div>
    </section>
  );
}

/** What the figures on this page are and are not. Required of any insurance advertisement. */
export function Disclaimer() {
  return (
    <footer className="pb-10">
      <Rule />
      <div className="pt-7 text-xs leading-[1.9] text-[var(--lg-mute)] opacity-80">
        <p>
          เบี้ยที่แสดงเป็นเบี้ยปีแรกโดยประมาณ คำนวณจากตารางเบี้ยฉบับ A2026-1
          ใช้ประกอบการตัดสินใจเบื้องต้นเท่านั้น ไม่ใช่ใบเสนอราคาและไม่ใช่ส่วนหนึ่งของสัญญาประกันภัย
        </p>
        <p className="mt-2.5">
          ความคุ้มครอง ข้อยกเว้น ระยะเวลารอคอย และคำนิยามโรคร้ายแรง เป็นไปตามที่ระบุในกรมธรรม์
          การพิจารณารับประกันเป็นไปตามหลักเกณฑ์ของบริษัท
        </p>
        <p className="mt-2.5 font-medium text-[var(--lg-white)]">
          ผู้ซื้อควรทำความเข้าใจรายละเอียดความคุ้มครองและเงื่อนไขก่อนตัดสินใจทำประกันภัยทุกครั้ง
        </p>
      </div>
    </footer>
  );
}
