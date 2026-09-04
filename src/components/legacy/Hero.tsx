/**
 * The first three seconds. A customer arriving from an ad knows neither the agency nor the
 * product, so the block promises a number, says what makes this one different, and points at
 * the calculator — and answers the objection that keeps a cold reader from scrolling at all
 * by saying, above the fold, that nothing will be asked of them.
 *
 * The four lines arrive in order rather than at once, which walks the eye down to the button.
 *
 * Kept apart from the rest of the copy because it is the part that gets rewritten every time
 * an ad is tested.
 */
export function Hero() {
  return (
    <header className="pt-14 pb-12">
      <p
        className="lg-rise text-xs font-medium uppercase tracking-[0.22em] text-[var(--lg-gold)]"
        style={{ animationDelay: "0ms" }}
      >
        ประกันมรดกเพื่อครอบครัว
      </p>

      <h1
        className="lg-rise mt-5 text-[2rem] font-medium leading-[1.28] text-[var(--lg-white)] sm:text-[2.6rem]"
        style={{ animationDelay: "90ms" }}
      >
        วันที่คุณล้ม
        <br />
        <span className="text-[var(--lg-gold)]">ครอบครัวต้องไม่ล้มตาม</span>
      </h1>

      <p
        className="lg-rise mt-5 text-base leading-[1.85] text-[var(--lg-mute)]"
        style={{ animationDelay: "180ms" }}
      >
        เตรียมเงินก้อน 1–10 ล้านบาทให้คนข้างหลัง จ่ายทั้งวันที่คุณจากไป{" "}
        <span className="font-medium text-[var(--lg-white)]">และวันที่คุณป่วยหนักแต่ยังอยู่</span>
      </p>

      <div className="lg-rise" style={{ animationDelay: "270ms" }}>
        <a
          href="#calc"
          className="mt-9 block rounded-sm bg-[var(--lg-gold)] px-5 py-4 text-center text-lg font-medium tracking-wide text-[var(--lg-navy)]"
        >
          ดูเบี้ยของฉัน ↓
        </a>
        <p className="mt-4 text-center text-xs leading-relaxed text-[var(--lg-mute)]">
          อายุ 35 เริ่มต้นวันละ 14 บาท · รับอายุ 20–65 ปี · ไม่ต้องกรอกเบอร์
        </p>
      </div>
    </header>
  );
}
