import Link from "next/link";
import type { Ci123Table } from "@/lib/ci123-table";
import { Fold, H2, Rule } from "@/components/sales/Blocks";

/** A share of the CI 123 sum, as the leaflet writes it. */
const pct = (share: number) => `${Math.round(share * 100)}%`;

/**
 * The first three seconds: what it is, what makes it different, and where the price is.
 * The difference is the one the company's own leaflet leads with — it pays from the first
 * stage of an illness, not only at the end, and it pays more than once.
 */
export function Hero({ table, fromPerDay, fromAge }: { table: Ci123Table; fromPerDay: number | null; fromAge: number }) {
  return (
    <header className="pt-14 pb-12">
      <p className="lg-rise text-xs font-medium uppercase tracking-[0.22em] text-[var(--lg-gold)]" style={{ animationDelay: "0ms" }}>
        ประกันโรคร้ายแรง CI 123
      </p>
      <h1
        className="lg-rise mt-5 max-w-3xl text-[2rem] font-medium leading-[1.28] text-[var(--lg-white)] sm:text-[2.6rem]"
        style={{ animationDelay: "90ms" }}
      >
        เจอเร็ว ก็ได้เงินเร็ว
        <br />
        <span className="lg-metal-text">ไม่ต้องรอให้ถึงระยะรุนแรง</span>
      </h1>
      <p className="lg-rise mt-5 max-w-2xl text-base leading-[1.85] text-[var(--lg-mute)]" style={{ animationDelay: "180ms" }}>
        คุ้มครอง {table.diseaseCount} โรคร้ายแรง จ่ายตั้งแต่ระยะก่อนเริ่มต้นถึงระยะรุนแรง{" "}
        <span className="font-medium text-[var(--lg-white)]">เคลมได้หลายครั้งตามระยะของโรค</span>
      </p>
      <div className="lg-rise sm:max-w-sm" style={{ animationDelay: "270ms" }}>
        <a href="#calc" className="lg-metal-face lg-sheen mt-9 block rounded-sm px-5 py-4 text-center text-lg font-medium tracking-wide">
          ดูเบี้ยของฉัน ↓
        </a>
        <p className="mt-4 text-center text-xs leading-relaxed text-[var(--lg-mute)]">
          {fromPerDay !== null && <>อายุ {fromAge} ทุน 5 แสน เริ่มต้นวันละ {fromPerDay} บาท · </>}
          รับอายุแรกเกิด–{table.ageMax} ปี · ไม่ต้องกรอกเบอร์
        </p>
      </div>
    </header>
  );
}

/**
 * Why now, in the company's own three reasons. The older page carried these as a picture;
 * set as text they read on a dark page and on a phone, and a screen reader can say them.
 */
export function WhySection() {
  const columns = [
    {
      title: "พฤติกรรมการใช้ชีวิต",
      facts: [
        { figure: "46%", body: "มีภาวะเครียดสูงจากงาน", source: "ThaiJO, 2023" },
        { figure: "76%", body: "นั่งทำงานนานเกิน 7 ชม./วัน", source: "PLOS One, 2023" },
        { figure: "30%", body: "ขาดการออกกำลังกาย", source: "The MATTER, 2023" },
      ],
    },
    {
      title: "พฤติกรรมการบริโภค",
      facts: [
        { figure: "90%", body: "บริโภคน้ำตาลเกินมาตรฐาน และ 80% บริโภคโซเดียมเกินมาตรฐาน", source: "MGR Online, 2023" },
        { figure: "50%", body: "ทานอาหารสำเร็จรูป 2 วัน/สัปดาห์", source: "Thairath Online, 2024" },
      ],
    },
    {
      title: "สภาพแวดล้อม",
      facts: [{ figure: "38 ล้านคน", body: "อยู่ในพื้นที่ PM2.5 เกินมาตรฐาน", source: "Hfocus, 2023" }],
    },
  ];
  return (
    <section className="py-12">
      <H2>สาเหตุที่โรคร้าย เข้าใกล้เรามากขึ้น</H2>
      <div className="mt-7 space-y-8">
        {columns.map((c) => (
          <div key={c.title}>
            <div className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--lg-gold)]">{c.title}</div>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              {c.facts.map((f) => (
                <div key={f.figure + f.body}>
                  <div className="lg-figure text-2xl tabular-nums text-[var(--lg-white)]">{f.figure}</div>
                  <p className="mt-1 text-sm leading-relaxed text-[var(--lg-mute)]">{f.body}</p>
                  <p className="mt-0.5 text-xs text-[var(--lg-mute)] opacity-60">ที่มา: {f.source}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/**
 * The benefit table: six ways of paying, how many conditions each names, and what share of
 * the sum it pays. Read off the rate table's own components, so the percentages here and the
 * premium above are priced from the same numbers.
 */
export function BenefitSection({ table }: { table: Ci123Table }) {
  return (
    <section className="relative overflow-hidden rounded-sm border border-[var(--lg-hair)] bg-[var(--lg-raise)] px-6 py-9">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-24 h-48 bg-[radial-gradient(60%_100%_at_50%_100%,var(--lg-gold-glow),transparent_70%)]"
      />
      <h2 className="relative text-[1.4rem] font-medium leading-snug sm:text-2xl">
        <span className="text-[var(--lg-mute)]">ประกันโรคร้ายแรงทั่วไป จ่ายเมื่อถึงระยะรุนแรง</span>
        <br />
        <span className="lg-metal-text">CI 123 จ่ายตั้งแต่ระยะแรก</span>
      </h2>
      <table className="relative mt-6 w-full text-sm">
        <thead>
          <tr className="text-xs text-[var(--lg-mute)]">
            <th className="py-2 text-left font-normal">ความคุ้มครอง</th>
            <th className="py-2 text-right font-normal">จำนวน</th>
            <th className="py-2 text-right font-normal">จ่าย</th>
          </tr>
        </thead>
        <tbody>
          {table.stages.map((s) => (
            <tr key={s.key} className="border-t border-[var(--lg-panel-line)] align-top">
              <td className="py-3 pr-3">
                <div className={s.major ? "font-medium text-[var(--lg-white)]" : "text-[var(--lg-white)]"}>{s.label}</div>
                {s.note && <div className="mt-0.5 text-xs leading-relaxed text-[var(--lg-mute)]">{s.note}</div>}
              </td>
              <td className="py-3 text-right tabular-nums text-[var(--lg-mute)]">
                {s.count} {s.key === "critical care benefit" ? "กรณี" : "โรค"}
              </td>
              <td className={`lg-figure py-3 text-right tabular-nums ${s.major ? "text-lg text-[var(--lg-gold)]" : "text-[var(--lg-white)]"}`}>
                {pct(s.share)}
                {s.cap !== null && (
                  <div className="text-[0.7rem] font-normal text-[var(--lg-mute)]">สูงสุด {s.cap.toLocaleString("en-US")}</div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="relative mt-4 text-xs leading-relaxed text-[var(--lg-mute)] opacity-80">
        % เทียบกับทุนประกัน CI 123 · เคลมระยะอื่นแล้วสัญญายังอยู่ต่อ จ่ายระยะรุนแรงแล้วสัญญาสิ้นสุด
        และบริษัทคืนเบี้ยส่วนความคุ้มครองอื่นที่ยังไม่ได้ให้ความคุ้มครอง
      </p>
    </section>
  );
}

/** What the customer is buying, itemised — the rider cannot be bought on its own. */
export function StructureSection({ table }: { table: Ci123Table }) {
  return (
    <section className="py-12">
      <H2>ชุดนี้ประกอบด้วยอะไร</H2>
      <p className="mt-2 text-sm leading-relaxed text-[var(--lg-mute)]">
        CI 123 เป็นสัญญาเพิ่มเติม ต้องซื้อคู่กับประกันชีวิตสัญญาหลัก ชุดนี้จับคู่กับสัญญาหลักทุนขั้นต่ำ เบี้ยจึงเบาที่สุด
      </p>
      <div className="mt-7 space-y-5">
        <div>
          <div className="text-sm leading-relaxed text-[var(--lg-mute)]">
            ประกันชีวิตตลอดชีพ Life Protect x 2 (ชำระเบี้ยถึงอายุ 99)
          </div>
          <div className="lg-figure mt-1 text-base tabular-nums text-[var(--lg-white)]">
            ทุน {table.baseSum.toLocaleString("en-US")} บาท
          </div>
        </div>
        <div>
          <div className="text-sm leading-relaxed text-[var(--lg-mute)]">สัญญาเพิ่มเติมโรคร้ายแรง CI 123</div>
          <div className="lg-figure mt-1 text-base tabular-nums text-[var(--lg-white)]">
            ทุน {table.sums[0].toLocaleString("en-US")} – {table.sums[table.sums.length - 1].toLocaleString("en-US")} บาท
          </div>
        </div>
      </div>
      <div className="mt-6">
        <Rule />
        <p className="pt-5 text-sm leading-[1.85] text-[var(--lg-mute)]">
          ✦ เสียชีวิตก่อนอายุ {table.death.beforeAge} ปี ครอบครัวได้ {table.death.sumBefore.toLocaleString("en-US")} บาท
          ตั้งแต่อายุ {table.death.beforeAge} ได้ {table.death.sumFrom.toLocaleString("en-US")} บาท คุ้มครองถึงอายุ 99
        </p>
      </div>
    </section>
  );
}

/**
 * The conditions, named, in the policy's own groups. From `ci123-diseases.json`, the same
 * list the chat answers from, so the page and the bot cannot name different illnesses.
 */
export function DiseaseSection({ table }: { table: Ci123Table }) {
  return (
    <section className="py-12">
      <Rule />
      <div className="pt-8">
        {/* the list as a picture is handed over from the calculator's buttons — the owner
            took this section's download link out (2026-09-25) */}
        <H2>คุ้มครอง {table.diseaseCount} โรคร้ายแรง</H2>
        <div className="mt-5 border-t border-[var(--lg-panel-line)]">
          {table.groups.map((g) => (
            <Fold key={g.title} summary={`${g.title.replace(/\s*\(.*$/, "")} (${g.diseases.length})`}>
              <ol className="space-y-1.5 sm:columns-2 sm:gap-x-8">
                {g.diseases.map((d, i) => (
                  <li key={d} className="flex gap-2.5 break-inside-avoid">
                    <span className="shrink-0 tabular-nums text-[var(--lg-gold)] opacity-70">{i + 1}.</span>
                    <span>{d}</span>
                  </li>
                ))}
              </ol>
            </Fold>
          ))}
        </div>
      </div>
    </section>
  );
}

/** The company's own worked examples, as the leaflet draws them. */
export function ClaimSection() {
  const pictures = [
    { src: "/ci123/claim-1.png", alt: "ตารางการจ่ายผลประโยชน์ CI 123 ทั้ง 6 ระยะ และกรณีตรวจพบโรคร้ายแรงระยะรุนแรง" },
    { src: "/ci123/claim-2.png", alt: "ตัวอย่างการจ่ายผลประโยชน์ กรณีที่ 1 จ่าย 100% และกรณีที่ 2 จ่าย 160% + 100,000 บาท" },
    { src: "/ci123/claim-3.png", alt: "ตัวอย่างการจ่ายผลประโยชน์ กรณีที่ 3 จ่าย 100% และกรณีที่ 4 จ่าย 135% + 100,000 บาท" },
  ];
  return (
    <section className="pb-12">
      <H2>ตัวอย่างการเคลม</H2>
      <p className="mt-2 text-sm leading-relaxed text-[var(--lg-mute)]">
        เคลมระยะแรกๆ แล้วยังเคลมระยะถัดไปได้ รวมสูงสุดถึง 160% ของทุน + 100,000 บาท
      </p>
      <div className="mt-5 border-t border-[var(--lg-panel-line)]">
        <Fold summary="ดูตัวอย่างการเคลมสินไหม">
          <div className="space-y-4">
            {pictures.map((p) => (
              // eslint-disable-next-line @next/next/no-img-element -- static leaflet pictures, shown at their own size
              <img key={p.src} src={p.src} alt={p.alt} loading="lazy" className="w-full rounded-sm bg-white" />
            ))}
          </div>
        </Fold>
      </div>
    </section>
  );
}

/** What it does not pay, and when it starts — the part a leaflet leaves to the small print. */
export function TermsSection() {
  return (
    <section className="pb-12">
      <H2>เงื่อนไขและข้อยกเว้น</H2>
      <div className="mt-5 border-t border-[var(--lg-panel-line)]">
        <Fold summary="ระยะเวลารอคอย 90 วัน">
          นับแต่วันเริ่มมีผลคุ้มครอง วันต่ออายุสัญญา (Reinstatement) หรือวันที่บริษัทอนุมัติเพิ่มทุน
          แล้วแต่วันใดจะเกิดภายหลัง ยกเว้นกรณีอุบัติเหตุภายใต้ความคุ้มครองกรณีภาวะวิกฤต
        </Fold>
        <Fold summary="ข้อยกเว้นบางส่วน">
          <ol className="list-decimal space-y-3 pl-5">
            <li>
              โรคร้ายแรง ไม่คุ้มครองกรณีที่เกิดจาก ความผิดปกติหรือโรคร้ายแรงที่เกิดขึ้นก่อนวันเริ่มคุ้มครอง
              (เว้นแต่แถลงแล้วบริษัทรับความเสี่ยงโดยไม่มีเงื่อนไขยกเว้น) · การฆ่าตัวตายหรือทำร้ายร่างกายตนเอง ·
              การนำสารพิษเข้าร่างกาย · การปฏิเสธการรักษาหรือไม่ปฏิบัติตามคำแนะนำของแพทย์
            </li>
            <li>
              การสูญเสียการดำรงชีพอย่างอิสระ ไม่คุ้มครองกรณีฆ่าตัวตาย พยายามฆ่าตัวตาย ทำร้ายร่างกายตนเอง
              หรือบาดเจ็บขณะก่ออาชญากรรมที่มีความผิดสถานหนัก หรือขณะหลบหนีการจับกุม
            </li>
            <li>
              ภาวะวิกฤต ไม่คุ้มครองกรณีฆ่าตัวตาย ทำร้ายร่างกายตนเอง การรักษาหรือบำบัดการติดยาเสพติด บุหรี่ สุรา
              หรือสารออกฤทธิ์ต่อจิตประสาท และการตรวจรักษาหรือผ่าตัดเพื่อเสริมสวย
            </li>
          </ol>
          <p className="mt-3 text-xs opacity-75">ข้อยกเว้นทั้งหมดเป็นไปตามที่ระบุในกรมธรรม์</p>
        </Fold>
      </div>
    </section>
  );
}

export function FaqSection({ table }: { table: Ci123Table }) {
  const faqs: { q: string; a: React.ReactNode }[] = [
    {
      q: "เบี้ยคงที่ตลอดไหม",
      a: (
        <>
          ส่วน Life Protect x 2 คงที่ ส่วน CI 123 คิดตามอายุจริง จึงปรับขึ้นเมื่ออายุมากขึ้น ยิ่งเริ่มเร็วยิ่งได้เปรียบ
          ถ้าอยากได้ความคุ้มครองโรคร้ายแรงที่เบี้ยไม่ขยับ{" "}
          <Link href="/ishield" className="text-[var(--lg-gold)] underline underline-offset-4">ดู iShield</Link>
        </>
      ),
    },
    {
      q: "เคลมไปแล้ว ยังเคลมได้อีกไหม",
      a: "ได้ เคลมระยะก่อนเริ่มต้น ระยะเริ่มต้นถึงปานกลาง โรคเด็ก เงื่อนไขพิเศษ หรือภาวะวิกฤตแล้ว สัญญายังอยู่ต่อ ยังเคลมระยะรุนแรงได้ (ภาวะวิกฤตนับรวมวงเงินเดียวกับระยะรุนแรง) จ่ายระยะรุนแรงแล้วสัญญา CI 123 สิ้นสุด",
    },
    {
      q: "ซื้อให้ลูกได้ไหม",
      a: `ได้ ตั้งแต่แรกเกิดถึงอายุ ${table.ageMax} ปี เด็กอายุ 1 เดือน – 18 ปี ได้ความคุ้มครองโรคร้ายแรงสำหรับเด็กเพิ่มอีก 17 โรค`,
    },
    {
      q: "ต้องตรวจสุขภาพไหม",
      a: "ขึ้นกับอายุ ทุน และประวัติสุขภาพ บางกรณีตอบคำถามสุขภาพอย่างเดียว บางกรณีบริษัทขอให้ตรวจ ตัวแทนเช็กให้ได้ก่อนสมัคร",
    },
    {
      q: "สมัครยังไง",
      a: "ทักแชท บอกอายุกับทุนที่ต้องการ ตัวแทนส่งใบเสนอฉบับเต็มให้ดูก่อนตัดสินใจ ปรึกษาไม่มีค่าใช้จ่าย",
    },
  ];
  return (
    <section className="pb-12">
      <H2>คำถามที่พบบ่อย</H2>
      <div className="mt-5 border-t border-[var(--lg-panel-line)]">
        {faqs.map((f) => <Fold key={f.q} summary={f.q}>{f.a}</Fold>)}
      </div>
    </section>
  );
}

export function Disclaimer({ table }: { table: Ci123Table }) {
  return (
    <footer className="pb-10">
      <Rule />
      <div className="pt-7 text-xs leading-[1.9] text-[var(--lg-mute)] opacity-80">
        <p>
          {table.expired
            ? "ตารางเบี้ยชุดที่ใช้คำนวณหมดอายุแล้ว หน้านี้จึงไม่แสดงเบี้ย ขอราคาปัจจุบันได้ทางแชท"
            : `เบี้ยที่แสดงเป็นเบี้ยปีแรกโดยประมาณ คำนวณจากตารางเบี้ยฉบับ ${table.rateVersion} ใช้ประกอบการตัดสินใจเบื้องต้นเท่านั้น ไม่ใช่ใบเสนอราคาและไม่ใช่ส่วนหนึ่งของสัญญาประกันภัย`}
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
