import "../theme.css";
import Link from "next/link";
import { AppShell } from "@/components/shell/AppShell";
import { listPeople } from "@/lib/content/people-store";
import { PeopleBoard } from "./PeopleBoard";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "คลังบุคคล | advisortool",
  description: "คนที่ยินยอมให้ใช้รูปในโปสเตอร์ และรูปต้นแบบให้ AI วาด",
};

export default async function PeoplePage() {
  const people = await listPeople().catch(() => []);
  return (
    <div className="content-page">
      <AppShell>
        <div className="mx-auto max-w-[1000px] space-y-4 px-4 pb-10 pt-16 lg:pt-8">
          <Link href="/content" className="text-sm text-[var(--ct-mute)] hover:text-[var(--ct-accent)]">← กลับไปสร้างคอนเทนต์</Link>
          <div>
            <h1 className="text-xl font-semibold">คลังบุคคล</h1>
            <p className="mt-1 text-sm text-[var(--ct-mute)]">
              คนที่จะให้ AI วาดลงในภาพโปสเตอร์ ใส่รูปหน้าชัดๆ 3–4 รูปจากหลายมุม แสงดี ไม่ใส่แว่นดำหรือหมวก — ยิ่งรูปดี หน้ายิ่งเหมือน
            </p>
          </div>
          <PeopleBoard initial={people} />
        </div>
      </AppShell>
    </div>
  );
}
