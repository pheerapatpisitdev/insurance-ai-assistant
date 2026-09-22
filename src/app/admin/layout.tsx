import { AppShell } from "@/components/shell/AppShell";

/**
 * The back office, open at its address.
 *
 * There was a PIN here until 2026-09-22. The owner asked for it to go: /admin is the one
 * address they type, and a code to type after it was the thing standing between them and
 * the page most mornings. Removing it was their decision, made knowing what it opens —
 * anyone with the address can read the customer list, change the keys and disconnect the
 * Page — and it is recorded here so that nobody later mistakes the open door for an
 * oversight. If a door is wanted again, `git log -S ADMIN_PIN` finds the one that was here.
 *
 * `signedIn` on the shell now means only "this is the back office": the menu lists its
 * pages here and nowhere else, which is a sign rather than a gate.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell signedIn>
      <div className="mx-auto max-w-5xl p-4 pt-16 sm:p-6 sm:pt-16 lg:pt-6">{children}</div>
    </AppShell>
  );
}
