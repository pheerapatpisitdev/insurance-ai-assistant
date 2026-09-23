import Link from "next/link";
import type { CancerTable } from "@/lib/cancer-table";
import { CPR_STAGES, HIC_INVASIVE_EXTRA_DAYS, HIC_MAX_DAYS } from "@/lib/cancer-benefits";
import { sumWords } from "@/lib/ci123-cta";
import { Fold, H2, Rule } from "@/components/sales/Blocks";

const pct = (share: number) => `${Math.round(share * 100)}%`;
const baht = (n: number) => n.toLocaleString("en-US");

/**
 * Thailand's figures from the WHO's cancer agency (IARC, Global Cancer Observatory, "Statistics
 * at a glance, 2024", fact sheet 764). Kept as the sheet prints them so the page can be checked
 * against it line by line; the per-day figure is the yearly count over 365.
 */
const SOURCE = "IARC Global Cancer Observatory (GLOBOCAN) ประเทศไทย, 2024";
const NEW_CASES = 176_951;
const DEATHS = 116_234;
const RISK_BEFORE_75 = "15%";
const TOP_MEN = [["ตับ", 17_976], ["ปอด", 15_199], ["ลำไส้ใหญ่และทวารหนัก", 11_269], ["ต่อมลูกหมาก", 6_894]] as const;
const TOP_WOMEN = [["เต้านม", 21_061], ["ลำไส้ใหญ่และทวารหนัก", 9_601], ["ปอด", 8_672], ["ตับ", 8_300], ["ปากมดลูก", 7_469]] as const;

/**
 * What it is and what makes it different, in three seconds: it pays from the first stage of a
 * cancer, pays the whole sum when it spreads, and pays by the day in hospital besides.
 */
export function Hero({ table, fromPerDay, fromAge }: { table: CancerTable; fromPerDay: number | null; fromAge: number }) {
  const top = table.tiers[table.tiers.length - 1];
  return (
    <header className="pt-14 pb-12">
      <p className="lg-rise text-xs font-medium uppercase tracking-[0.22em] text-[var(--lg-gold)]" style={{ animationDelay: "0ms" }}>
        ประกันมะเร็ง
      </p>
      <h1
        className="lg-rise mt-5 max-w-3xl text-[2rem] font-medium leading-[1.28] text-[var(--lg-white)] sm:text-[2.6rem]"
        style={{ animationDelay: "90ms" }}
      >
        เจอมะเร็งระยะแรก ก็ได้เงินก้อน
        <br />
        <span className="lg-metal-text">ลุกลาม รับเต็มทุนสูงสุด {sumWords(top.cpr)}</span>
      </h1>
      <p className="lg-rise mt-5 max-w-2xl text-base leading-[1.85] text-[var(--lg-mute)]" style={{ animationDelay: "180ms" }}>
        จ่ายตามระยะของมะเร็ง ตั้งแต่ระยะไม่ลุกลามขั้นต้นจนถึงระยะลุกลาม{" "}
        <span className="font-medium text-[var(--lg-white)]">
          นอนโรงพยาบาลเพราะมะเร็ง รับเพิ่มวันละสูงสุด {baht(top.hic)} บาท
        </span>
      </p>
      <div className="lg-rise sm:max-w-sm" style={{ animationDelay: "270ms" }}>
        <a href="#calc" className="lg-metal-face lg-sheen mt-9 block rounded-sm px-5 py-4 text-center text-lg font-medium tracking-wide">
          ดูเบี้ยของฉัน ↓
        </a>
        <p className="mt-4 text-center text-xs leading-relaxed text-[var(--lg-mute)]">
          {fromPerDay !== null && <>อายุ {fromAge} ทุน {sumWords(table.tiers[0].cpr)} เริ่มต้นวันละ {fromPerDay} บาท · </>}
          รับอายุแรกเกิด–{table.ageMax} ปี · ไม่ต้องกรอกเบอร์
        </p>
      </div>
    </header>
  );
}

/** How close cancer is, in the country's own figures, and which ones come first for each sex. */
export function StatsSection() {
  const perDay = Math.round(NEW_CASES / 365);
  const figures = [
    { figure: baht(NEW_CASES), body: "คนไทยป่วยเป็นมะเร็งรายใหม่ต่อปี" },
    { figure: `≈ ${perDay}`, body: "คนต่อวัน ที่ได้ยินคำว่า “คุณเป็นมะเร็ง”" },
    { figure: RISK_BEFORE_75, body: "โอกาสเป็นมะเร็งก่อนอายุ 75 ปี หรือราว 1 ใน 7 คน" },
    { figure: baht(DEATHS), body: "คนไทยเสียชีวิตจากมะเร็งต่อปี" },
  ];
  return (
    <section className="py-12">
      <H2>มะเร็ง ใกล้ตัวกว่าที่คิด</H2>
      <div className="mt-7 grid grid-cols-2 gap-x-5 gap-y-7">
        {figures.map((f) => (
          <div key={f.body}>
            <div className="lg-figure text-2xl tabular-nums text-[var(--lg-white)] sm:text-3xl">{f.figure}</div>
            <p className="mt-1 text-sm leading-relaxed text-[var(--lg-mute)]">{f.body}</p>
          </div>
        ))}
      </div>
      <div className="mt-9 grid gap-7 sm:grid-cols-2">
        {([["มะเร็งที่พบบ่อยในผู้ชาย", TOP_MEN], ["มะเร็งที่พบบ่อยในผู้หญิง", TOP_WOMEN]] as const).map(([title, rows]) => (
          <div key={title}>
            <div className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--lg-gold)]">{title}</div>
            <ol className="mt-3 space-y-2">
              {rows.map(([site, n], i) => (
                <li key={site} className="flex items-baseline justify-between gap-3 border-b border-[var(--lg-panel-line)] pb-2 text-sm">
                  <span className="text-[var(--lg-white)]">
                    <span className="mr-2 tabular-nums text-[var(--lg-gold)] opacity-70">{i + 1}.</span>
                    มะเร็ง{site}
                  </span>
                  <span className="tabular-nums text-[var(--lg-mute)]">{baht(n)} คน/ปี</span>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>
      <p className="mt-5 text-xs text-[var(--lg-mute)] opacity-60">ที่มา: {SOURCE}</p>
    </section>
  );
}

/**
 * Why a lump sum, when there is already health insurance: the hospital bill is one cost of a
 * cancer among several, and the others fall on the household rather than the hospital.
 */
export function MoneySection() {
  const points = [
    {
      title: "รักษานาน หลายขั้นตอน",
      body: "ผ่าตัด เคมีบำบัด ฉายแสง ยามุ่งเป้า การรักษามะเร็งมักต่อเนื่องเป็นเดือนหรือเป็นปี ไม่ใช่นอนโรงพยาบาลครั้งเดียวจบ",
    },
    {
      title: "รายได้หยุด แต่รายจ่ายไม่หยุด",
      body: "ระหว่างรักษาอาจทำงานเต็มที่ไม่ได้ ค่าบ้าน ค่าผ่อน ค่าเรียนลูกยังเดินต่อ เงินก้อนช่วยให้ครอบครัวไม่ต้องสะดุด",
    },
    {
      title: "ค่าใช้จ่ายนอกบิลโรงพยาบาล",
      body: "ค่าเดินทางไปรักษา คนดูแล อาหารและการฟื้นฟูร่างกาย เงินก้อนใช้ได้ตามที่จำเป็น ไม่ต้องรอใบเสร็จ",
    },
  ];
  return (
    <section className="pb-12">
      <Rule />
      <div className="pt-8">
        <H2>ทำไมต้องมีเงินก้อน ตอนเจอมะเร็ง</H2>
        <div className="mt-6 space-y-6">
          {points.map((p, i) => (
            <div key={p.title} className="flex gap-4">
              <div className="lg-figure shrink-0 text-2xl tabular-nums text-[var(--lg-gold)]">{i + 1}</div>
              <div>
                <div className="font-medium text-[var(--lg-white)]">{p.title}</div>
                <p className="mt-1 text-sm leading-[1.85] text-[var(--lg-mute)]">{p.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/** The four stages CPR pays on, from the workbook's cancer sheet, with the wait before each. */
export function BenefitSection() {
  return (
    <section className="relative overflow-hidden rounded-sm border border-[var(--lg-hair)] bg-[var(--lg-raise)] px-6 py-9">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-24 h-48 bg-[radial-gradient(60%_100%_at_50%_100%,var(--lg-gold-glow),transparent_70%)]"
      />
      <h2 className="relative text-[1.4rem] font-medium leading-snug sm:text-2xl">
        <span className="text-[var(--lg-mute)]">ไม่ต้องรอให้ลุกลาม</span>
        <br />
        <span className="lg-metal-text">จ่ายตั้งแต่มะเร็งระยะแรก</span>
      </h2>
      <table className="relative mt-6 w-full text-sm">
        <thead>
          <tr className="text-xs text-[var(--lg-mute)]">
            <th className="py-2 text-left font-normal">ระยะของมะเร็ง</th>
            <th className="py-2 text-right font-normal">จ่าย</th>
          </tr>
        </thead>
        <tbody>
          {CPR_STAGES.map((s) => (
            <tr key={s.label} className="border-t border-[var(--lg-panel-line)] align-top">
              <td className="py-3 pr-3">
                <div className={s.major ? "font-medium text-[var(--lg-white)]" : "text-[var(--lg-white)]"}>{s.label}</div>
                {s.note && <div className="mt-0.5 text-xs leading-relaxed text-[var(--lg-mute)]">{s.note}</div>}
                <div className="mt-0.5 text-xs text-[var(--lg-mute)] opacity-70">
                  ระยะรอคอย {s.waitingDays} วัน{s.repeatable ? " · เคลมได้มากกว่า 1 ครั้ง" : ""}
                </div>
              </td>
              <td className={`lg-figure py-3 text-right tabular-nums ${s.major ? "text-lg text-[var(--lg-gold)]" : "text-[var(--lg-white)]"}`}>
                {pct(s.share)}
                {s.cap !== null && (
                  <div className="text-[0.7rem] font-normal text-[var(--lg-mute)]">สูงสุด {baht(s.cap)}</div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="relative mt-4 text-xs leading-relaxed text-[var(--lg-mute)] opacity-80">
        % เทียบกับทุน CPR · รวมทุกครั้งที่จ่ายไม่เกิน 100% ของทุน · ระยะรอคอยนับถึงวันที่เก็บชิ้นเนื้อไปตรวจทางพยาธิวิทยา
      </p>
    </section>
  );
}

/** HIC: a daily sum for the days a cancer keeps someone in hospital. */
export function DailySection({ table }: { table: CancerTable }) {
  const lo = table.tiers[0].hic;
  const hi = table.tiers[table.tiers.length - 1].hic;
  return (
    <section className="py-12">
      <H2>นอนโรงพยาบาลเพราะมะเร็ง รับเงินรายวัน</H2>
      <p className="mt-3 text-sm leading-[1.85] text-[var(--lg-mute)]">
        นอกจากเงินก้อน ทุกแพ็กมีค่าชดเชยรายวัน (HIC) วันละ {baht(lo)} – {baht(hi)} บาท
        จ่ายทุกวันที่เข้ารักษาตัวในโรงพยาบาลเพราะมะเร็ง เป็นเงินของคุณเอง ไม่ต้องเอาไปจ่ายโรงพยาบาล
      </p>
      <div className="mt-6 grid grid-cols-2 gap-4">
        <div className="rounded-sm border border-[var(--lg-hair)] bg-[var(--lg-panel)] p-4">
          <div className="lg-figure text-2xl tabular-nums text-[var(--lg-white)]">{HIC_MAX_DAYS} วัน</div>
          <p className="mt-1 text-xs leading-relaxed text-[var(--lg-mute)]">จ่ายสูงสุด สำหรับมะเร็งขั้นที่ 2–4</p>
        </div>
        <div className="rounded-sm border border-[var(--lg-hair)] bg-[var(--lg-panel)] p-4">
          <div className="lg-figure text-2xl tabular-nums text-[var(--lg-gold)]">+{HIC_INVASIVE_EXTRA_DAYS} วัน</div>
          <p className="mt-1 text-xs leading-relaxed text-[var(--lg-mute)]">ขยายเพิ่ม เมื่อเป็นมะเร็งระยะลุกลาม</p>
        </div>
      </div>
      <p className="mt-4 text-xs leading-relaxed text-[var(--lg-mute)] opacity-80">
        ไม่คุ้มครองมะเร็งขั้นที่ 1 (ระยะไม่ลุกลามขั้นต้น) · ระยะรอคอยเช่นเดียวกับเงินก้อน
      </p>
    </section>
  );
}

/** What the customer is buying, itemised, and why the base grows with the cancer sum. */
export function StructureSection({ table }: { table: CancerTable }) {
  return (
    <section className="pb-12">
      <Rule />
      <div className="pt-8">
        <H2>ชุดนี้ประกอบด้วยอะไร</H2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--lg-mute)]">
          ความคุ้มครองมะเร็งเป็นสัญญาเพิ่มเติม ต้องแนบกับประกันชีวิตสัญญาหลัก และทุนมะเร็งได้ไม่เกิน 5 เท่าของทุนหลัก
          แพ็กทุนสูงจึงมาพร้อมทุนชีวิตที่สูงขึ้นด้วย
        </p>
        <ul className="mt-6 space-y-3 text-sm leading-relaxed">
          <li className="text-[var(--lg-white)]">ประกันชีวิตตลอดชีพ Life Protect x 2 (ชำระเบี้ยถึงอายุ 99)</li>
          <li className="text-[var(--lg-white)]">สัญญาเพิ่มเติมคุ้มครองโรคมะเร็ง (CPR) — เงินก้อนตามระยะ</li>
          <li className="text-[var(--lg-white)]">สัญญาเพิ่มเติมค่าชดเชยรายวันเนื่องจากโรคมะเร็ง (HIC) — เงินรายวันตอนนอนโรงพยาบาล</li>
        </ul>
        <table className="mt-6 w-full text-sm tabular-nums">
          <thead>
            <tr className="text-xs text-[var(--lg-mute)]">
              <th className="py-1.5 text-left font-normal">ทุนมะเร็ง</th>
              <th className="py-1.5 text-right font-normal">ชดเชย/วัน</th>
              <th className="py-1.5 text-right font-normal">ทุนชีวิต</th>
              <th className="py-1.5 text-right font-normal">เสียชีวิตก่อน 60</th>
            </tr>
          </thead>
          <tbody>
            {table.tiers.map((t) => (
              <tr key={t.cpr + "-" + t.hic} className="border-t border-[var(--lg-panel-line)] text-[var(--lg-white)]">
                <td className="py-2">{baht(t.cpr)}</td>
                <td className="py-2 text-right">{baht(t.hic)}</td>
                <td className="py-2 text-right">{baht(t.baseSum)}</td>
                <td className="py-2 text-right">{baht(t.death.sumBefore)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-xs text-[var(--lg-mute)] opacity-80">
          เสียชีวิตตั้งแต่อายุ 60 ครอบครัวได้เท่าทุนชีวิต คุ้มครองถึงอายุ 99
        </p>
      </div>
    </section>
  );
}

/** When it starts, what it will not pay, and how the yearly riders renew. */
export function TermsSection() {
  return (
    <section className="pb-12">
      <H2>เงื่อนไขและข้อยกเว้น</H2>
      <div className="mt-5 border-t border-[var(--lg-panel-line)]">
        <Fold summary="ระยะเวลารอคอย">
          วันที่เก็บชิ้นเนื้อไปตรวจทางพยาธิวิทยาต้องพ้นระยะรอคอยนับจากวันเริ่มคุ้มครอง
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {CPR_STAGES.map((s) => <li key={s.label}>{s.label} — {s.waitingDays} วัน</li>)}
          </ul>
        </Fold>
        <Fold summary="ข้อยกเว้นบางส่วน">
          <p>ไม่คุ้มครองโรคมะเร็งที่เกิดจาก หรือในกรณี</p>
          <ol className="mt-2 list-decimal space-y-1.5 pl-5">
            <li>โรคเรื้อรัง หรือการเจ็บป่วยที่ยังไม่ได้รักษาให้หายก่อนวันเริ่มคุ้มครอง ภาวะที่เป็นมาแต่กำเนิด หรือโรคทางพันธุกรรม</li>
            <li>การติดเชื้อ HIV หรือภาวะภูมิคุ้มกันบกพร่อง (AIDS)</li>
            <li>ปฏิเสธการรักษา หรือไม่ปฏิบัติตามคำแนะนำของแพทย์</li>
            <li>โรคมะเร็งที่ไม่เป็นไปตามคำนิยามของสัญญาเพิ่มเติม</li>
            <li>การก่อการร้าย (CPR) · การรักษาที่ผู้เอาประกันซึ่งเป็นแพทย์สั่งให้ตัวเอง หรือโดยแพทย์ที่เป็นบิดา มารดา คู่สมรส หรือบุตร (HIC)</li>
          </ol>
          <p className="mt-3 text-xs opacity-75">CPR มีข้อยกเว้นทั้งหมด 10 ข้อ HIC 16 ข้อ เป็นไปตามที่ระบุในกรมธรรม์</p>
        </Fold>
        <Fold summary="สัญญาปีต่อปี ต่ออายุได้ถึงอายุ 84">
          CPR และ HIC มีระยะเวลาเอาประกันภัยคราวละ 1 ปี ต่ออายุได้ถึงอายุ 84 ปี แต่ไม่เกินระยะเวลาของสัญญาหลัก
          เบี้ยปีต่ออายุอาจเปลี่ยนตามอายุ ขั้นอาชีพ ค่ารักษาพยาบาลที่สูงขึ้น หรือประสบการณ์การจ่ายสินไหมโดยรวม
        </Fold>
      </div>
    </section>
  );
}

export function FaqSection({ table }: { table: CancerTable }) {
  const faqs: { q: string; a: React.ReactNode }[] = [
    {
      q: "มีประกันสุขภาพอยู่แล้ว ยังต้องมีไหม",
      a: "ประกันสุขภาพจ่ายค่ารักษาให้โรงพยาบาล ส่วนประกันมะเร็งจ่ายเงินก้อนและเงินรายวันให้คุณเอง ใช้กับรายได้ที่หายไปหรือค่าใช้จ่ายในบ้าน สองแบบนี้ทำงานคนละส่วน",
    },
    {
      q: "เคลมไปแล้ว ยังเคลมได้อีกไหม",
      a: "ได้ ขั้นที่ 2 และ 3 เคลมได้มากกว่า 1 ครั้ง ถ้าต่อมาลุกลาม ยังได้ขั้นที่ 4 ส่วนที่เหลือจนครบทุน รวมทุกครั้งไม่เกิน 100% ของทุน CPR",
    },
    {
      q: "เบี้ยคงที่ตลอดไหม",
      a: "ส่วน Life Protect x 2 คงที่ ส่วน CPR และ HIC เป็นสัญญาปีต่อปี เบี้ยปรับตามอายุ ยิ่งเริ่มตอนอายุน้อยและยังสุขภาพดี ยิ่งได้เปรียบ",
    },
    {
      q: "ต่างจาก CI 123 ยังไง",
      a: (
        <>
          CI 123 คุ้มครองโรคร้ายแรงหลายกลุ่ม ส่วนชุดนี้เน้นมะเร็งอย่างเดียว และมีเงินรายวันตอนนอนโรงพยาบาลเพิ่ม
          ถ้าอยากได้ความคุ้มครองโรคร้ายแรงกว้างกว่านี้{" "}
          <Link href="/ci123" className="text-[var(--lg-gold)] underline underline-offset-4">ดู CI 123</Link>
        </>
      ),
    },
    {
      q: "ซื้อให้ลูกได้ไหม",
      a: `ได้ ตั้งแต่แรกเกิดถึงอายุ ${table.ageMax} ปี`,
    },
    {
      q: "ต้องตรวจสุขภาพไหม",
      a: "ขึ้นกับอายุ ทุน และประวัติสุขภาพ บางกรณีตอบคำถามสุขภาพอย่างเดียว บางกรณีบริษัทขอให้ตรวจ ตัวแทนเช็กให้ได้ก่อนสมัคร",
    },
    {
      q: "สมัครยังไง",
      a: "ทักแชท บอกอายุกับแพ็กที่ต้องการ ตัวแทนส่งใบเสนอฉบับเต็มให้ดูก่อนตัดสินใจ ปรึกษาไม่มีค่าใช้จ่าย",
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

export function Disclaimer({ table }: { table: CancerTable }) {
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
          ความคุ้มครอง ข้อยกเว้น ระยะเวลารอคอย และคำนิยามโรคมะเร็ง เป็นไปตามที่ระบุในกรมธรรม์
          การพิจารณารับประกันเป็นไปตามหลักเกณฑ์ของบริษัท สถิติโรคมะเร็งจาก {SOURCE}
        </p>
        <p className="mt-2.5 font-medium text-[var(--lg-white)]">
          ผู้ซื้อควรทำความเข้าใจรายละเอียดความคุ้มครองและเงื่อนไขก่อนตัดสินใจทำประกันภัยทุกครั้ง
        </p>
      </div>
    </footer>
  );
}
