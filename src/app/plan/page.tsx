import { Planner } from "./Planner";

export const metadata = {
  title: "วางแผนประกันด้วยตัวเอง — ครอบครัวคุณยังขาดความคุ้มครองตรงไหน",
  description:
    "กรอกรายได้ รายจ่าย ลูก หนี้ และประกันที่มีอยู่ ดูทันทีว่ายังขาดความคุ้มครองด้านไหน พร้อมแบบประกันและเบี้ยจริงที่พอดีกับงบของคุณ ไม่ต้องให้เบอร์โทร",
};

export default function PlanPage() {
  return (
    <main className="mx-auto max-w-lg px-4 pb-28 sm:max-w-2xl sm:pb-10">
      <header className="pb-6 pt-8">
        <p className="text-sm text-[var(--lg-mute)]">วางแผนประกันด้วยตัวเอง</p>
        <h1 className="lg-figure mt-2 text-3xl leading-tight text-[var(--lg-white)]">
          ครอบครัวของคุณ<br />ยังขาดความคุ้มครองตรงไหน
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-[var(--lg-mute)]">
          กรอกตัวเลขคร่าวๆ ก็พอ ระบบคิดให้ว่าแต่ละด้านควรมีเท่าไหร่ ขาดเท่าไหร่ และแบบไหนพอดีกับงบของคุณ
          ไม่ต้องให้เบอร์โทร
        </p>
      </header>
      <Planner />
    </main>
  );
}
