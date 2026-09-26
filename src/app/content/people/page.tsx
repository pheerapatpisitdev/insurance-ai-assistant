import { listPeople } from "@/lib/content/people-store";
import { PeopleBoard } from "./PeopleBoard";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "คลังบุคคล | advisortool",
  description: "คนที่ยินยอมให้ใช้รูปในโปสเตอร์ และรูปต้นแบบให้ AI วาด",
};

// the menu, the palette and the tabs come from ../layout.tsx
export default async function PeoplePage() {
  const people = await listPeople().catch(() => []);
  return (
    <div className="max-w-[1000px] space-y-4">
      <div>
        <h1 className="text-xl font-semibold">คลังบุคคล</h1>
        <p className="mt-1 text-sm text-[var(--ct-mute)]">
          คนที่จะให้ AI วาดลงในภาพโปสเตอร์ ใส่รูปหน้าชัดๆ ได้ถึง 10 รูปจากหลายมุม (รูปแรกคือรูปหลัก) แสงดี ไม่ใส่แว่นดำหรือหมวก — ยิ่งรูปดี หน้ายิ่งเหมือน
        </p>
      </div>
      <PeopleBoard initial={people} />
    </div>
  );
}
