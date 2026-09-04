import Link from "next/link";
import { ChatClient } from "./ChatClient";

export const metadata = { title: "ถาม AI เรื่องประกัน" };

export default function ChatPage() {
  return (
    <main className="mx-auto max-w-3xl p-4 sm:p-6">
      <div className="mb-4 flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold">ถาม AI เรื่องประกัน</h1>
        <span className="flex gap-4 text-sm text-slate-500">
          <Link href="/" className="underline">ไปหน้าคำนวณเบี้ย</Link>
          <Link href="/privacy" className="underline">ความเป็นส่วนตัว</Link>
        </span>
      </div>
      <ChatClient />
    </main>
  );
}
