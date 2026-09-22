import type { PensionCopyFacts } from "@/lib/pension-facts";

/**
 * The first three seconds. The problem is not saving — the reader has been told to save all
 * their life — it is that the salary stops on a known date and the bills do not.
 */
export function Hero({ facts }: { facts: PensionCopyFacts }) {
  const { example } = facts;
  const q = example.quote;
  return (
    <header className="pt-14 pb-12">
      <p
        className="lg-rise text-xs font-medium uppercase tracking-[0.22em] text-[var(--lg-gold)]"
        style={{ animationDelay: "0ms" }}
      >
        ประกันบำนาญ ลดหย่อนภาษีได้ · บำนาญ สมาร์ท 95
      </p>

      <h1
        className="lg-rise mt-5 max-w-3xl text-[2.1rem] font-medium leading-[1.25] text-[var(--lg-white)] sm:text-[2.7rem]"
        style={{ animationDelay: "90ms" }}
      >
        เงินเดือนหยุดวันเกษียณ
        <br />
        <span className="lg-metal-text">ค่าใช้จ่ายไม่ได้หยุดตาม</span>
      </h1>

      <p className="lg-rise mt-5 max-w-2xl text-base leading-[1.85] text-[var(--lg-mute)]" style={{ animationDelay: "180ms" }}>
        <span className="font-medium text-[var(--lg-white)]">
          บำนาญ สมาร์ท 95 จ่ายเงินให้คุณทุกปี จนถึงอายุ 95
        </span>{" "}
        เลือกเริ่มรับได้ตอนอายุ {facts.pensionAges.join(" ")} ปี บำนาญเพิ่มขึ้นเป็นขั้นตามอายุ
        จาก 15% เป็น 30% ของทุน และรับประกันจ่าย 15 ปีแรก จ่ายเบี้ยแค่ 6 ปี หรือจ่ายจนถึงวันเริ่มรับบำนาญ
        รับอายุ {facts.ageMin}–{facts.ageMax} ปี
      </p>

      <p className="lg-rise mt-3 max-w-2xl text-sm leading-[1.85] text-[var(--lg-mute)]" style={{ animationDelay: "220ms" }}>
        ระหว่างที่ยังทำงาน —{" "}
        <span className="text-[var(--lg-gold)]">เบี้ยที่จ่ายนำไปลดหย่อนภาษีได้</span>{" "}
        ตามเกณฑ์ของกรมสรรพากร
      </p>

      <div className="lg-rise sm:max-w-sm" style={{ animationDelay: "270ms" }}>
        <a
          href="#calc"
          className="lg-metal-face lg-sheen mt-9 block rounded-sm px-5 py-4 text-center text-lg font-medium tracking-wide"
        >
          ดูบำนาญของฉัน ↓
        </a>
        <p className="mt-4 text-center text-xs leading-relaxed text-[var(--lg-mute)]">
          อยากได้เดือนละ {example.monthly.toLocaleString("en-US")} ตั้งแต่อายุ {q.plan.annuityStartAge} ·{" "}
          {example.sex === "M" ? "ชาย" : "หญิง"} {example.age} เบี้ยปีละ {Math.floor(q.annualPremium).toLocaleString("en-US")} บาท ·
          ไม่ต้องกรอกเบอร์
        </p>
      </div>
    </header>
  );
}
