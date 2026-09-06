import type { LifeProtectCopyFacts } from "@/lib/lifeprotect-facts";

/**
 * The first three seconds. The promise is a sum that arrives for certain and a premium that
 * stops, which is the opposite pitch to /legacy — and the page says so before the fold, with
 * the one figure a stranger can hold and the reassurance that nothing will be asked of them.
 */
export function Hero({ facts }: { facts: LifeProtectCopyFacts }) {
  return (
    <header className="pt-14 pb-12">
      <p className="lg-rise text-xs font-medium uppercase tracking-[0.22em] text-[var(--lg-gold)]" style={{ animationDelay: "0ms" }}>
        ประกันชีวิตตลอดชีพ Life Protect+ 100
      </p>

      <h1
        className="lg-rise mt-5 text-[2rem] font-medium leading-[1.28] text-[var(--lg-white)] sm:text-[2.6rem]"
        style={{ animationDelay: "90ms" }}
      >
        มรดกที่แน่นอน
        <br />
        <span className="lg-metal-text">จ่ายจบ ไม่ต้องจ่ายทั้งชีวิต</span>
      </h1>

      <p className="lg-rise mt-5 text-base leading-[1.85] text-[var(--lg-mute)]" style={{ animationDelay: "180ms" }}>
        เลือกจ่าย 9 ปี 19 ปี หรือถึงอายุ {facts.coverToAge} เบี้ยเท่าเดิมทุกปี คุ้มครองถึงอายุ {facts.coverToAge}{" "}
        <span className="font-medium text-[var(--lg-white)]">
          เสียชีวิตก่อน {facts.boosterBeforeAge} ครอบครัวได้ 2 เท่า
        </span>
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
            <>อายุ {facts.fromAge} เริ่มต้นวันละ {facts.fromPerDay} บาท · </>
          )}
          รับแรกเกิด–{facts.ageMax} ปี · ไม่ต้องกรอกเบอร์
        </p>
      </div>
    </header>
  );
}
