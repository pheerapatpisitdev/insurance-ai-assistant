/**
 * The first three seconds. A customer arriving from an ad knows neither the agency nor the
 * product, so the block promises a number, says what makes this one different, and points at
 * the calculator — and answers the objection that keeps a cold reader from scrolling at all
 * by saying, above the fold, that nothing will be asked of them.
 *
 * Kept apart from the rest of the copy because it is the part that gets rewritten every time
 * an ad is tested.
 */
export function Hero() {
  return (
    <header className="pt-8 pb-10">
      <h1 className="text-3xl font-bold leading-snug text-slate-900 sm:text-4xl">
        วันที่คุณล้ม<br />ครอบครัวต้องไม่ล้มตาม
      </h1>
      <p className="mt-4 text-base leading-relaxed text-slate-700">
        เตรียมเงินก้อน 1–10 ล้านบาทให้คนข้างหลัง จ่ายทั้งวันที่คุณจากไป{" "}
        <strong className="font-semibold text-slate-900">และวันที่คุณป่วยหนักแต่ยังอยู่</strong>
      </p>
      <a
        href="#calc"
        className="mt-6 block rounded-xl bg-emerald-600 px-5 py-4 text-center text-lg font-semibold text-white"
      >
        ดูเบี้ยของฉัน ↓
      </a>
      <p className="mt-3 text-center text-xs text-slate-500">
        อายุ 35 เริ่มต้นวันละ 14 บาท · รับอายุ 20–65 ปี · ไม่ต้องกรอกเบอร์
      </p>
    </header>
  );
}
