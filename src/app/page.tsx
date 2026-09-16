import { listNotes } from "./actions";
import { Chat } from "./Chat";
import { Notes } from "./Notes";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "ถามเรื่องแบบประกัน | advisortool",
  description: "ถามเงื่อนไขแบบประกันและคิดเบี้ยจากตารางจริง ตอบจากข้อมูลในระบบเท่านั้น",
};

export default async function Home() {
  const notes = await listNotes();
  return (
    <div className="mx-auto max-w-3xl px-4 pb-10">
      <Chat />
      <Notes initial={notes} />
    </div>
  );
}
