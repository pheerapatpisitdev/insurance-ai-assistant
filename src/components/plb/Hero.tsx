import type { PlbCopyFacts } from "@/lib/plb-facts";

/**
 * The first three seconds. iShield opens on the person still here; Life Protect on the
 * family left behind. This one opens on a length of time — the years the family still has
 * something left to pay off, which is the only reason to buy cover that ends.
 */
export function Hero({ facts }: { facts: PlbCopyFacts }) {
  return (
    <header className="pt-14 pb-12">
      <p
        className="lg-rise text-xs font-medium uppercase tracking-[0.22em] text-[var(--lg-gold)]"
        style={{ animationDelay: "0ms" }}
      >
        ประกันชีวิตแบบคุ้มครอง Protection Life
      </p>

      {/* The headline is the window, not the figure. The sums are two lines below, where
          someone who has already stopped scrolling will read them. */}
      <h1
        className="lg-rise mt-5 max-w-3xl text-[2.1rem] font-medium leading-[1.25] text-[var(--lg-white)] sm:text-[2.7rem]"
        style={{ animationDelay: "90ms" }}
      >
        หนี้บ้านอีกสิบกว่าปี ลูกอีกหลายปีกว่าจะจบ
        <br />
        <span className="lg-metal-text">ช่วงนี้แหละที่ต้องมีทุนให้พอ</span>
      </h1>

      <p className="lg-rise mt-5 max-w-2xl text-base leading-[1.85] text-[var(--lg-mute)]" style={{ animationDelay: "180ms" }}>
        <span className="font-medium text-[var(--lg-white)]">
          Protection Life ซื้อทุนก้อนใหญ่ด้วยเบี้ยที่ถูกที่สุด
        </span>{" "}
        เสียชีวิตระหว่างสัญญา ครอบครัวรับเต็มทุน เบี้ยคงที่ทุกปี เลือกคุ้มครอง 5 10 12 หรือ 15 ปี
        รับอายุ {facts.ageMin}–{facts.ageMax} ทุนเริ่ม {facts.saMinShort}
      </p>

      {/* the one thing that gets found out late and resented, said in the hero instead */}
      <p className="lg-rise mt-3 max-w-2xl text-sm leading-[1.85] text-[var(--lg-mute)]" style={{ animationDelay: "220ms" }}>
        แลกมาด้วยข้อเดียว — อยู่ครบสัญญาแล้ว{" "}
        <span className="text-[var(--lg-gold)]">ไม่มีเงินคืน</span> เบี้ยทุกบาทไปอยู่ที่ความคุ้มครองล้วน ๆ
        จึงได้ทุนสูงกว่าแบบที่มีเงินคืนมาก
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
          {facts.from.perDay !== null && (
            <>
              ทุน {facts.from.sumShort} เริ่มต้นวันละ {facts.from.perDay} บาท
              ({facts.from.sexWord} {facts.from.age} · {facts.from.termShort}) ·{" "}
            </>
          )}
          รับ {facts.ageMin}–{facts.ageMax} ปี · ไม่ต้องกรอกเบอร์
        </p>
      </div>
    </header>
  );
}
