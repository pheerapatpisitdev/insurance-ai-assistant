import "../theme.css";
import Link from "next/link";
import { AppShell } from "@/components/shell/AppShell";
import { listHookTemplates } from "@/lib/content/store";
import { HookLibrary } from "./HookLibrary";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "คลังสูตรประโยคเปิด | advisortool",
  description: "สูตรประโยคเปิดโพสต์ มีช่องให้เติม ใช้ซ้ำกับแบบประกันไหนก็ได้",
};

export default async function HooksPage() {
  const hooks = await listHookTemplates().catch(() => []);
  return (
    <div className="content-page">
      <AppShell>
        <div className="mx-auto max-w-3xl px-4 pb-10 pt-16 lg:pt-8">
          <Link href="/content" className="text-sm text-[var(--ct-mute)] hover:text-[var(--ct-accent)]">← กลับไปสร้างคอนเทนต์</Link>
          <h1 className="mt-2 text-xl font-semibold">คลังสูตรประโยคเปิด</h1>
          <p className="mt-1 text-sm text-[var(--ct-mute)]">
            สูตรที่มีช่อง [ ] ให้ AI เติมตามแบบประกัน เริ่มต้น 30 สูตร และเพิ่มเองทุกครั้งที่กด “✓ ใช้จริง” กับชิ้นงาน
          </p>
          <HookLibrary items={hooks} />
        </div>
      </AppShell>
    </div>
  );
}
