import type { IShieldCopyFacts } from "@/lib/ishield-facts";

/**
 * The first three seconds. Life Protect opens on the family left behind; this plan opens on
 * the person still here, because that is the half of it a customer is deciding about — the
 * money arrives while they are alive, and arrives again if they are still alive at 85.
 */
export function Hero({ facts }: { facts: IShieldCopyFacts }) {
  return (
    <header className="pt-14 pb-12">
      <p
        className="lg-rise text-xs font-medium uppercase tracking-[0.22em] text-[var(--lg-gold)]"
        style={{ animationDelay: "0ms" }}
      >
        ประกันชีวิตและโรคร้ายแรงตลอดชีพ iShield
      </p>

      {/* The headline is the moment, not the figure. The sums are two lines below, where
          someone who has already stopped scrolling will read them. */}
      <h1
        className="lg-rise mt-5 max-w-3xl text-[2.1rem] font-medium leading-[1.25] text-[var(--lg-white)] sm:text-[2.7rem]"
        style={{ animationDelay: "90ms" }}
      >
        วันที่หมอบอกให้หยุดทำงาน
        <br />
        <span className="lg-metal-text">รายได้หยุด แต่รายจ่ายไม่หยุด</span>
      </h1>

      <p className="lg-rise mt-5 max-w-2xl text-base leading-[1.85] text-[var(--lg-mute)]" style={{ animationDelay: "180ms" }}>
        <span className="font-medium text-[var(--lg-white)]">
          โรคร้ายแรงพรากรายได้ไปพร้อมกับที่ค่าใช้จ่ายพุ่งขึ้น
        </span>{" "}
        iShield จ่ายเป็นเงินก้อนตั้งแต่ระยะเริ่มต้น คุ้มครอง {facts.illnessTotal} โรค เบี้ยเท่าเดิมทุกปี
        จ่ายจบใน 5 ถึง 20 ปี คุ้มครองถึงอายุ {facts.maturityAge} และถ้าอยู่ครบ รับคืนเต็มทุน
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
            <>ทุน {facts.fromSum} เริ่มต้นวันละ {facts.fromPerDay} บาท (หญิง {facts.fromAge}) · </>
          )}
          รับแรกเกิด–{facts.ageMax} ปี · ไม่ต้องกรอกเบอร์
        </p>
      </div>
    </header>
  );
}
