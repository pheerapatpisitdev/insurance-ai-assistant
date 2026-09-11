import Link from "next/link";
import { redirect } from "next/navigation";
import { isSignedIn, pinIsConfigured } from "@/lib/admin/session";
import { SignOutButton } from "./SignOutButton";

/** Every page under /admin requires a valid PIN session; the login page sits at /login. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!pinIsConfigured() || !(await isSignedIn())) redirect("/login");

  return (
    <div className="mx-auto max-w-5xl p-4 sm:p-6">
      <header className="mb-5 flex flex-wrap items-center gap-3 border-b pb-3">
        <h1 className="text-lg font-semibold">หลังบ้าน</h1>
        <div className="ml-auto flex items-center gap-3 text-sm text-slate-500">
          <Link href="/" className="underline">หน้าคำนวณ</Link>
          <SignOutButton />
        </div>
      </header>
      {children}
    </div>
  );
}
