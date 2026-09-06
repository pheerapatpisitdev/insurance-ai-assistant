import type { LifeProtectCopyFacts } from "@/lib/lifeprotect-facts";

/**
 * The first three seconds. The pitch is arithmetic a stranger can check on the spot: the sum
 * they choose, and twice it for the family while the children are still young. The premium
 * that stops and the cover that runs to 99 follow, and the line under the button says that
 * nothing will be asked of them for the number.
 */
export function Hero({ facts }: { facts: LifeProtectCopyFacts }) {
  return (
    <header className="pt-14 pb-12">
      <p className="lg-rise text-xs font-medium uppercase tracking-[0.22em] text-[var(--lg-gold)]" style={{ animationDelay: "0ms" }}>
        ประกันชีวิตตลอดชีพ Life Protect+ 100
      </p>

      {/* Two short lines a thumb can read mid-scroll: the customer's number, then the
          family's. Spelled "1 ล้าน", not "1,000,000" — seven digits twice is arithmetic
          homework, two words is a claim. */}
      <h1
        className="lg-rise mt-5 text-[2.2rem] font-medium leading-[1.2] text-[var(--lg-white)] sm:text-[2.9rem]"
        style={{ animationDelay: "90ms" }}
      >
        {facts.double.sumShort}ของคุณ
        <br />
        <span className="lg-metal-text">= {facts.double.beforeShort}ของครอบครัว</span>
      </h1>

      <p className="lg-rise mt-5 text-base leading-[1.85] text-[var(--lg-mute)]" style={{ animationDelay: "180ms" }}>
        <span className="font-medium text-[var(--lg-white)]">
          จากไปก่อนอายุ {facts.boosterBeforeAge} ครอบครัวรับ 2 เท่าของทุน
        </span>{" "}
        ช่วงที่ลูกยังเรียน บ้านยังผ่อน · เบี้ยเท่าเดิมทุกปี จ่ายจบใน 9 หรือ 19 ปี คุ้มครองถึงอายุ {facts.coverToAge}
      </p>

      <div className="lg-rise" style={{ animationDelay: "270ms" }}>
        <a
          href="#calc"
          className="lg-metal-face lg-sheen mt-9 block rounded-sm px-5 py-4 text-center text-lg font-medium tracking-wide"
        >
          ดูเบี้ยของฉัน ↓
        </a>
        <p className="mt-4 text-center text-xs leading-relaxed text-[var(--lg-mute)]">
          {facts.fromPerDay !== null && (
            <>ทุน {facts.fromSum} คุ้มครอง {facts.fromDouble} เริ่มต้นวันละ {facts.fromPerDay} บาท (อายุ {facts.fromAge}) · </>
          )}
          รับแรกเกิด–{facts.ageMax} ปี · ไม่ต้องกรอกเบอร์
        </p>
      </div>
    </header>
  );
}
