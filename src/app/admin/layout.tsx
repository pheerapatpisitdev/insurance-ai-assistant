import { redirect } from "next/navigation";
import { isSignedIn, pinIsConfigured } from "@/lib/admin/session";
import { AppShell } from "@/components/shell/AppShell";

/**
 * Every page under /admin requires a valid PIN session; the login page sits at /login.
 *
 * The row of links that used to be here has gone into the menu, which is the same menu on
 * every page in the site — the answer to the owner's "I don't know what there is to use".
 * Six links in a row was already at the width a phone will show, and the seventh would have
 * had nowhere to go.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!pinIsConfigured() || !(await isSignedIn())) redirect("/login");

  return (
    <AppShell signedIn>
      <div className="mx-auto max-w-5xl p-4 pt-16 sm:p-6 sm:pt-16 lg:pt-6">{children}</div>
    </AppShell>
  );
}
