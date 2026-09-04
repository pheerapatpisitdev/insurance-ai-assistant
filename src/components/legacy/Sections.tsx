import { riderDiseases } from "@/calc/riders/diseases";

/** A heading that reads at arm's length on a phone, without shouting on a desktop. */
function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="text-xl font-bold leading-snug text-slate-900 sm:text-2xl">{children}</h2>;
}

/**
 * A folding block. `<details>` is the browser's own — it opens with no JavaScript at all,
 * which on a phone over mobile data is the difference between a list that works and a list
 * that waits for a bundle to arrive.
 */
function Fold({ summary, children }: { summary: string; children: React.ReactNode }) {
  return (
    <details className="group border-b border-slate-200 last:border-b-0">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 py-4 text-sm font-medium text-slate-800 marker:hidden">
        {summary}
        <span aria-hidden className="shrink-0 text-slate-400 transition-transform group-open:rotate-45">
          +
        </span>
      </summary>
      <div className="pb-4 text-sm leading-relaxed text-slate-600">{children}</div>
    </details>
  );
}

/**
 * Why any of this matters, in the three obligations that do not stop when an income does.
 * Money owed and children mid-education are the two things a family cannot pause, and the
 * third is the one people believe they have covered because they have savings.
 */
export function WhySection() {
  const truths = [
    {
      title: "ลูกยังเรียนไม่จบ",
      body: "ค่าเรียนจนจบปริญญาตรีเป็นหลักล้าน ถ้าไม่มีคุณ ใครจ่ายต่อ",
    },
    {
      title: "บ้านยังผ่อนไม่หมด",
      body: "หนี้ไม่ได้หายไปพร้อมกับเรา มันตกไปอยู่กับคนที่ยังอยู่",
    },
    {
      title: "เงินเก็บมีก้อนเดียว",
      body: "ค่ารักษาโรคร้ายครั้งเดียวกินเงินเก็บทั้งชีวิต แล้วเหลืออะไรให้ลูก",
    },
  ];
  return (
    <section className="py-10">
      <H2>เงินที่คุณหาได้ทุกวันนี้ ครอบครัวใช้ต่อได้อีกกี่ปี</H2>
      <div className="mt-5 space-y-3">
        {truths.map((t) => (
          <div key={t.title} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="font-semibold text-slate-900">{t.title}</div>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">{t.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/**
 * The one thing this arrangement does that a plain legacy policy does not. It is the reason
 * the bundle puts most of the sum into the critical-illness rider rather than the base plan,
 * so it gets the page's strongest heading.
 */
export function DifferenceSection() {
  return (
    <section className="rounded-2xl bg-slate-900 px-5 py-8 text-white">
      <h2 className="text-xl font-bold leading-snug sm:text-2xl">
        ประกันมรดกทั่วไปจ่ายวันที่คุณไม่อยู่
        <br />
        <span className="text-emerald-400">แบบนี้จ่ายตั้งแต่วันที่คุณยังอยู่</span>
      </h2>
      <p className="mt-4 text-sm leading-relaxed text-slate-300">
        ตรวจพบมะเร็งระยะลุกลาม เส้นเลือดสมองแตก ไตวายเรื้อรัง หรือ 1 ใน 31 โรคตามคำนิยามในกรมธรรม์{" "}
        <strong className="font-semibold text-white">รับเงินก้อนเต็มวงเงินทันที</strong>{" "}
        เอาไปรักษา เอาไปส่งลูกเรียน เอาไปปิดหนี้บ้าน — ทั้งที่คุณยังอยู่ดูแลเขาเอง
      </p>
    </section>
  );
}

/**
 * What the customer is actually buying, itemised. A page that shows a premium without saying
 * what makes it up is asking to be taken on trust by someone who has no reason to give it.
 */
export function StructureSection() {
  const parts = [
    { label: "ประกันชีวิตตลอดชีพ Life Protect x 2 (ชำระเบี้ยถึงอายุ 99)", sum: "150,000" },
    { label: "สัญญาเพิ่มเติมโรคร้ายแรง DCI", sum: "850,000" },
  ];
  return (
    <section className="py-10">
      <H2>ชุดนี้ประกอบด้วยอะไร</H2>
      <p className="mt-2 text-sm text-slate-500">ตัวอย่างแผนมรดก 1 ล้านบาท</p>
      <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-5">
        {parts.map((p) => (
          <div key={p.label} className="border-b border-slate-100 pb-3 first:pt-0 [&:not(:first-child)]:pt-3">
            <div className="text-sm leading-relaxed text-slate-700">{p.label}</div>
            <div className="mt-0.5 text-sm font-semibold tabular-nums text-slate-900">ทุน {p.sum} บาท</div>
          </div>
        ))}
        <div className="pt-4">
          <div className="text-sm text-slate-600">ครอบครัวได้รับ</div>
          <div className="text-2xl font-bold tabular-nums text-emerald-700">1,000,000 บาท</div>
        </div>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-emerald-800">
        ✦ เสียชีวิตก่อนอายุ 60 ปี ได้ 1,150,000 บาท เพราะทุนหลักจ่ายสองเท่า
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
    <section className="py-10">
      <H2>คุ้มครอง {info.diseases.length} โรคร้ายแรง</H2>
      <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-5">
        <Fold summary={`ดูรายชื่อ ${info.diseases.length} โรคที่คุ้มครอง`}>
          <ol className="space-y-1 sm:columns-2 sm:gap-x-6">
            {info.diseases.map((d, i) => (
              <li key={d} className="flex gap-2 break-inside-avoid">
                <span className="shrink-0 tabular-nums text-slate-400">{i + 1}.</span>
                <span>{d}</span>
              </li>
            ))}
          </ol>
          <p className="mt-3 text-xs text-slate-500">{info.note}</p>
        </Fold>
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
    <section className="py-10">
      <H2>คำถามที่พบบ่อย</H2>
      <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-5">
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
    <footer className="border-t border-slate-200 py-8 text-xs leading-relaxed text-slate-500">
      <p>
        เบี้ยที่แสดงเป็นเบี้ยปีแรกโดยประมาณ คำนวณจากตารางเบี้ยฉบับ A2026-1
        ใช้ประกอบการตัดสินใจเบื้องต้นเท่านั้น ไม่ใช่ใบเสนอราคาและไม่ใช่ส่วนหนึ่งของสัญญาประกันภัย
      </p>
      <p className="mt-2">
        ความคุ้มครอง ข้อยกเว้น ระยะเวลารอคอย และคำนิยามโรคร้ายแรง เป็นไปตามที่ระบุในกรมธรรม์
        การพิจารณารับประกันเป็นไปตามหลักเกณฑ์ของบริษัท
      </p>
      <p className="mt-2 font-medium text-slate-600">
        ผู้ซื้อควรทำความเข้าใจรายละเอียดความคุ้มครองและเงื่อนไขก่อนตัดสินใจทำประกันภัยทุกครั้ง
      </p>
    </footer>
  );
}
