import type { EasyProtectCopyFacts } from "@/lib/easyprotect-facts";

/**
 * The first three seconds. The other pages open on a loss — someone ill, someone gone, an
 * estate that cannot be divided. This one opens on the thing that actually stops people
 * buying life cover: not the price of a month, but not knowing when the paying stops.
 *
 * So the headline is the end date, and the price is under it rather than in it.
 */
export function Hero({ facts }: { facts: EasyProtectCopyFacts }) {
  return (
    <header className="pt-14 pb-12">
      <p
        className="lg-rise text-xs font-medium uppercase tracking-[0.22em] text-[var(--lg-gold)]"
        style={{ animationDelay: "0ms" }}
      >
        ประกันชีวิตตลอดชีพ อีซี่ โพรเทค 6
      </p>

      <h1
        className="lg-rise mt-5 max-w-3xl text-[2.1rem] font-medium leading-[1.25] text-[var(--lg-white)] sm:text-[2.7rem]"
        style={{ animationDelay: "90ms" }}
      >
        จ่ายเบี้ยแค่ {facts.payYears} ปี
        <br />
        <span className="lg-metal-text">คุ้มครองยาวถึงอายุ {facts.coverToAge}</span>
      </h1>

      <p className="lg-rise mt-5 max-w-2xl text-base leading-[1.85] text-[var(--lg-mute)]" style={{ animationDelay: "180ms" }}>
        <span className="font-medium text-[var(--lg-white)]">
          คนส่วนใหญ่ไม่ได้กลัวเบี้ยแพง แต่กลัวว่าต้องจ่ายไปอีกนานแค่ไหน
        </span>{" "}
        แบบนี้ตอบได้ตั้งแต่วันแรกว่าจ่าย {facts.payYears} ครั้งแล้วจบ ปีที่ {facts.payYears + 1} ไม่มีเบี้ยตามมาอีก
        แต่ความคุ้มครองอยู่ต่อจนถึงอายุ {facts.coverToAge} ทุนเริ่มต้น {facts.saMinShort} รับอายุ {facts.ageMin}–{facts.ageMax}
      </p>

      <p className="lg-rise mt-3 max-w-2xl text-sm leading-[1.85] text-[var(--lg-mute)]" style={{ animationDelay: "220ms" }}>
        และถ้าไม่มีอะไรเกิดขึ้นเลย เงินก็ไม่ได้หายไปไหน —{" "}
        <span className="text-[var(--lg-gold)]">มูลค่าเวนคืนโตขึ้นทุกปี</span>{" "}
        จนเท่าทุนประกันเต็มจำนวนเมื่ออายุ {facts.coverToAge}
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
          {facts.from.premium !== null && (
            <>
              ทุน {facts.saMinShort} เริ่มต้น {facts.from.premium} บาท{facts.from.per}
              {" "}({facts.from.sex === "M" ? "ชาย" : "หญิง"} {facts.from.age} ปี) ·{" "}
            </>
          )}
          รับ {facts.ageMin}–{facts.ageMax} ปี · ไม่ต้องกรอกเบอร์
        </p>
      </div>
    </header>
  );
}
