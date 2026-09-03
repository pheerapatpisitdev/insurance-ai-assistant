import Link from "next/link";
import { requireAdmin, supabaseServer } from "@/lib/supabase/server";
import { SignInCard } from "./SignInCard";
import { SignOutButton } from "./SignOutButton";

const TABS = [
  { href: "/admin/ai", label: "AI" },
  { href: "/admin/knowledge", label: "คลังความรู้" },
  { href: "/admin/usage", label: "สถิติ" },
  { href: "/admin/rules", label: "กฎประกัน" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  if (!admin) {
    const supabase = await supabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    return <SignInCard signedInAs={user?.email ?? undefined} />;
  }
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
          <span className="hidden sm:inline">{admin.email}</span>
          <SignOutButton />
        </div>
      </header>
      {children}
    </div>
  );
}
