import "./home-theme.css";
import { openingGuide } from "@/lib/copilot/guide";
import { Chat } from "./Chat";
import { AppShell } from "@/components/shell/AppShell";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "ถามเรื่องแบบประกัน | advisortool",
  description: "ถามเงื่อนไขแบบประกันและคิดเบี้ยจากตารางจริง ตอบจากข้อมูลในระบบเท่านั้น",
};

export default async function Home() {
  return (
    <div className="home-chat">
      <AppShell>
      <div className="mx-auto max-w-3xl px-4 pb-10 pt-14 lg:pt-0">
        {/* built on the server from the plan registry, so a new plan brings its own button */}
        <Chat guide={openingGuide()} />
      </div>
      </AppShell>
    </div>
  );
}
