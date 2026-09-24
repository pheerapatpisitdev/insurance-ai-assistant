import Link from "next/link";
import { Highlighted } from "@/components/Highlighted";
import { formatBaht } from "@/calc/money";
import { INSURER } from "@/lib/insurer";
import type { Prose } from "@/lib/plan/prose";
import type { Area, AreaKey, PlanResult } from "@/lib/plan/recommend";

const TITLE: Record<AreaKey, string> = {
  life: "ถ้าคุณจากไปกะทันหัน",
  health: "ค่ารักษาพยาบาล",
  ci: "โรคร้ายแรงและมะเร็ง",
  retire: "เกษียณและลดหย่อนภาษี",
};
const UNIT: Record<Area["unit"], string> = { sum: "บาท", room: "บาท/วัน", pension: "บาท/เดือน" };
const baht = (n: number) => Math.round(n).toLocaleString("en-US");

function Bar({ area }: { area: Area }) {
  const gives = area.status === "fits" || area.status === "reduced" ? area.offer?.cover ?? 0 : 0;
  const top = Math.max(area.should, area.have + gives, 1);
  const pct = (x: number) => `${Math.min(100, (x / top) * 100)}%`;
  return (
    <div className="space-y-2">
      <div className="relative h-3 overflow-hidden rounded-sm bg-[var(--lg-raise)]">
        <div className="absolute inset-y-0 left-0 bg-[var(--lg-mute)]" style={{ width: pct(area.have) }} />
        <div className="absolute inset-y-0 bg-[var(--lg-gold)]" style={{ left: pct(area.have), width: pct(gives) }} />
        <div className="absolute inset-y-0 w-0.5 bg-[var(--lg-white)]" style={{ left: pct(area.should) }} />
      </div>
      <dl className="grid grid-cols-3 gap-2 text-xs text-[var(--lg-mute)]">
        <div><dt>มีอยู่</dt><dd className="lg-figure text-sm tabular-nums text-[var(--lg-white)]">{baht(area.have)}</dd></div>
        <div><dt>แผนนี้เพิ่ม</dt><dd className="lg-figure text-sm tabular-nums text-[var(--lg-gold)]">{baht(gives)}</dd></div>
        <div><dt>ควรมี</dt><dd className="lg-figure text-sm tabular-nums text-[var(--lg-white)]">{baht(area.should)}</dd></div>
      </dl>
      <p className="text-xs text-[var(--lg-mute)]">หน่วย: {UNIT[area.unit]}</p>
    </div>
  );
}

function statusLine(a: Area): string {
  switch (a.status) {
    case "covered": return "ที่มีอยู่พอแล้ว ด้านนี้ไม่ต้องเพิ่ม";
    case "fits": return "แผนนี้ปิดช่องว่างได้ครบ";
    case "reduced": return "งบนี้ทำได้เท่านี้ก่อน ถ้าเพิ่มงบจะเข้าใกล้ที่ควรมี";
    case "short": return a.offer ? "งบที่เหลือยังไม่พอ แบบเล็กที่สุดของด้านนี้ราคาตามนี้" : "งบหมดที่ด้านก่อนหน้าแล้ว";
    case "unavailable": return "อายุนี้แบบที่เรามีรับไม่ได้ ปรึกษาตัวแทนเพื่อหาทางเลือกอื่น";
  }
}

function coverText(a: Area): string {
  const o = a.offer!;
  if (a.key === "life") return o.cover > o.sum ? `ทุน ${baht(o.sum)} บาท คุ้มครอง ${baht(o.cover)} บาท ก่อนอายุ 60` : `ทุน ${baht(o.sum)} บาท`;
  if (a.key === "health") return `ค่าห้อง ${baht(o.cover)} บาท/วัน`;
  if (a.key === "retire") return `บำนาญเดือนละ ${baht(o.cover)} บาท ตั้งแต่อายุ ${o.fromAge}`;
  return `ทุน ${baht(o.sum)} บาท`;
}

function AreaCard({ area, prose }: { area: Area; prose: string | null }) {
  const o = area.offer;
  return (
    <section className="space-y-4 rounded-sm border border-[var(--lg-hair)] bg-[var(--lg-panel)] p-5">
      <h3 className="text-lg font-medium text-[var(--lg-white)]">{TITLE[area.key]}</h3>
      <Bar area={area} />
      <p className="text-sm text-[var(--lg-white)]">{statusLine(area)}</p>
      {o && (
        <div className="space-y-1.5 rounded-sm border border-[var(--lg-panel-line)] bg-[var(--lg-raise)] p-4">
          <div className="text-sm font-medium text-[var(--lg-white)]">{o.product}</div>
          <div className="text-sm text-[var(--lg-mute)]">{coverText(area)}</div>
          <div className="text-sm text-[var(--lg-white)]">
            {o.firstYear ? "เบี้ยปีแรก " : "เบี้ย "}
            <Highlighted>{formatBaht(o.annual)}</Highlighted> บาท/ปี
            <span className="text-[var(--lg-mute)]"> (เฉลี่ยเดือนละ {formatBaht(Math.round(o.annual / 12))} บาท)</span>
          </div>
          <Link href={o.href} className="inline-block pt-1 text-sm text-[var(--lg-gold)] underline underline-offset-4">
            ดูรายละเอียดแบบนี้ →
          </Link>
        </div>
      )}
      <p className="text-sm leading-relaxed text-[var(--lg-mute)]">{prose ?? "กำลังเขียนคำแนะนำ…"}</p>
    </section>
  );
}

export function PlanView({ result, prose }: { result: PlanResult; prose: Prose | null }) {
  const used = Math.round(result.usedAnnual / 12);
  return (
    <div className="space-y-5">
      <section className="space-y-3 rounded-sm border border-[var(--lg-gold)] bg-[var(--lg-panel)] p-5">
        <h2 className="text-xl font-medium text-[var(--lg-white)]">แผนของคุณ</h2>
        <p className="text-sm leading-relaxed text-[var(--lg-mute)]">{prose?.intro ?? "กำลังเขียนคำแนะนำ…"}</p>
        <dl className="grid grid-cols-3 gap-2 text-xs text-[var(--lg-mute)]">
          <div><dt>งบต่อเดือน</dt><dd className="lg-figure text-base tabular-nums text-[var(--lg-white)]">{baht(result.budget)}</dd></div>
          <div><dt>แผนนี้ใช้ (เฉลี่ย/เดือน)</dt><dd className="lg-figure text-base tabular-nums text-[var(--lg-gold)]">{formatBaht(used)}</dd></div>
          <div><dt>ประหยัดภาษีราว (บาท/ปี)</dt><dd className="lg-figure text-base tabular-nums text-[var(--lg-white)]">{baht(result.taxSaved)}</dd></div>
        </dl>
      </section>
      {result.areas.map((a) => <AreaCard key={a.key} area={a} prose={prose ? prose[a.key] : null} />)}
      <p className="text-xs leading-relaxed text-[var(--lg-mute)]">
        ตัวเลขเป็นการประมาณเบื้องต้นจากข้อมูลที่กรอก ไม่ใช่ข้อเสนอขาย เบี้ยจริงขึ้นกับการพิจารณารับประกันของบริษัท
        ภาษีที่ประหยัดได้เป็นการประมาณจากเงินเดือนอย่างเดียว · รับประกันโดย {INSURER}
      </p>
    </div>
  );
}
