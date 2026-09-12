import type { LifeTreasureCopyFacts } from "@/lib/lifetreasure-facts";

/**
 * The first three seconds. The other three pages open on a person — someone ill, someone
 * gone, someone still paying off a house. This one opens on an estate, because that is what
 * a ten-million floor means: the reader already has money, and the problem is not having it
 * but having it in a form the family cannot use on the day they need it.
 */
export function Hero({ facts }: { facts: LifeTreasureCopyFacts }) {
  return (
    <header className="pt-14 pb-12">
      <p
        className="lg-rise text-xs font-medium uppercase tracking-[0.22em] text-[var(--lg-gold)]"
        style={{ animationDelay: "0ms" }}
      >
        ประกันชีวิตตลอดชีพเพื่อการส่งต่อ ไลฟ์เทรเชอร์
      </p>

      {/* The headline is the problem, not the product. The sums are two lines below, where
          someone who has already stopped scrolling will read them. */}
      <h1
        className="lg-rise mt-5 max-w-3xl text-[2.1rem] font-medium leading-[1.25] text-[var(--lg-white)] sm:text-[2.7rem]"
        style={{ animationDelay: "90ms" }}
      >
        มรดกส่วนใหญ่ไม่ได้อยู่ในรูปเงินสด
        <br />
        <span className="lg-metal-text">วันที่ต้องใช้ มันขายไม่ทัน</span>
      </h1>

      <p className="lg-rise mt-5 max-w-2xl text-base leading-[1.85] text-[var(--lg-mute)]" style={{ animationDelay: "180ms" }}>
        <span className="font-medium text-[var(--lg-white)]">
          ที่ดินแบ่งไม่ลงตัว ธุรกิจขายรีบก็ได้ราคาต่ำ
        </span>{" "}
        ไลฟ์เทรเชอร์เปลี่ยนเบี้ยที่จ่ายให้เป็นเงินก้อนที่ระบุจำนวนไว้ล่วงหน้า
        ถึงมือผู้รับประโยชน์ตามที่คุณกำหนด ทุนเริ่ม {facts.saMinShort} คุ้มครองถึงอายุ {facts.coverToAge}{" "}
        จ่ายจบใน 6 12 หรือ 18 ปี รับอายุ {facts.ageMin}–{facts.ageMax}
      </p>

      <p className="lg-rise mt-3 max-w-2xl text-sm leading-[1.85] text-[var(--lg-mute)]" style={{ animationDelay: "220ms" }}>
        และถ้าวันนั้นยังมาไม่ถึง เงินก็ไม่ได้หายไปไหน —{" "}
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
              {" "}({facts.example.sex === "M" ? "ชาย" : "หญิง"} {facts.example.age} · ชำระ {facts.from.termShort}) ·{" "}
            </>
          )}
          รับ {facts.ageMin}–{facts.ageMax} ปี · ไม่ต้องกรอกเบอร์
        </p>
      </div>
    </header>
  );
}
