import Link from "next/link";
import { redirect } from "next/navigation";
import { isSignedIn, pinIsConfigured } from "@/lib/admin/session";
import { SignOutButton } from "./SignOutButton";

const TABS = [
  { href: "/admin/ai", label: "AI" },
  { href: "/admin/chat", label: "แชท AI" },
  { href: "/admin/faq", label: "คำตอบที่เขียนเอง" },
  { href: "/admin/line", label: "LINE" },
  { href: "/admin/messenger", label: "Messenger" },
  { href: "/admin/alerts", label: "แจ้งเตือน" },
  { href: "/admin/knowledge", label: "คลังความรู้" },
  { href: "/admin/rules", label: "กฎประกัน" },
];

/** Every page under /admin requires a valid PIN session; the login page sits at /login. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!pinIsConfigured() || !(await isSignedIn())) redirect("/login");

  return (
    <div className="mx-auto max-w-5xl p-4 sm:p-6">
      <header className="mb-5 flex flex-wrap items-center gap-3 border-b pb-3">
        <h1 className="text-lg font-semibold">หลังบ้าน</h1>
        <nav className="flex flex-wrap gap-1 text-sm">
          {TABS.map((t) => (
            <Link key={t.href} href={t.href} className="rounded px-3 py-1.5 text-slate-600 hover:bg-slate-100">
              {t.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3 text-sm text-slate-500">
          <Link href="/" className="underline">หน้าคำนวณ</Link>
          <SignOutButton />
        </div>
      </header>
      {children}
    </div>
  );
}
