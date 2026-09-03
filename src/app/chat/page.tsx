import Link from "next/link";
import { ChatClient } from "./ChatClient";

export const metadata = { title: "ถาม AI เรื่องประกัน" };

export default function ChatPage() {
  return (
    <main className="mx-auto max-w-3xl p-4 sm:p-6">
      <div className="mb-4 flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold">ถาม AI เรื่องประกัน</h1>
        <Link href="/" className="text-sm text-slate-500 underline">
          ไปหน้าคำนวณเบี้ย
        </Link>
      </div>
      <ChatClient />
    </main>
  );
}
