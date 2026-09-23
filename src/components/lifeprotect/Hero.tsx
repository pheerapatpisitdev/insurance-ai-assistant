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
        ประกันชีวิตตลอดชีพ Life Protect x 2
      </p>

      {/* No figure in the headline. A sum in millions is arithmetic, and a thumb moving past
          does not stop to do arithmetic — it stops for a question about its own house. The
          numbers are two lines below, where someone who has already stopped will read them. */}
      <h1
        className="lg-rise mt-5 max-w-3xl text-[2.3rem] font-medium leading-[1.2] text-[var(--lg-white)] sm:text-[3rem]"
        style={{ animationDelay: "90ms" }}
      >
        ถ้าพรุ่งนี้ไม่มีคุณ
        <br />
        <span className="lg-metal-text">บ้านนี้ไปต่อได้ไหม</span>
      </h1>

      <p className="lg-rise mt-5 max-w-2xl text-base leading-[1.85] text-[var(--lg-mute)]" style={{ animationDelay: "180ms" }}>
        <span className="font-medium text-[var(--lg-white)]">
          ช่วงที่ลูกยังเรียน บ้านยังผ่อน คือช่วงที่ครอบครัวขาดคุณไม่ได้
        </span>{" "}
        แบบนี้จึงจ่ายเป็นสองเท่าของทุนตรงช่วงนั้นพอดี เบี้ยเท่าเดิมทุกปี จ่ายจบใน 9 หรือ 19 ปี
        คุ้มครองถึงอายุ {facts.coverToAge}
      </p>

      {/* full width under a thumb; a button the width of a desktop is not a button */}
      <div className="lg-rise sm:max-w-sm" style={{ animationDelay: "270ms" }}>
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
