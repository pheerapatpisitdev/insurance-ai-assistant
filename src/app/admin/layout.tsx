import { isSignedIn, pinIsConfigured } from "@/lib/admin/session";
import { LoginForm } from "@/app/login/LoginForm";
import { AppShell } from "@/components/shell/AppShell";

/**
 * Every page under /admin requires a valid PIN session, and asks for it here.
 *
 * It used to redirect to /login, which meant the one address the owner has to remember —
 * /admin, now that the link to it has gone off the calculator — was never the address in
 * front of them: they typed it and landed somewhere else, on a page they then had to know
 * the name of. The door asks for the key at the door.
 *
 * The shell is only put on once there is a session behind it. Rendering the signed-in menu
 * around a login form would list the back office to somebody who has not got in yet.
 *
 * The row of links that used to be here has gone into the menu, which is the same menu on
 * every page in the site — the answer to the owner's "I don't know what there is to use".
 * Six links in a row was already at the width a phone will show, and the seventh would have
 * had nowhere to go.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!pinIsConfigured() || !(await isSignedIn())) {
    return <LoginForm configured={pinIsConfigured()} />;
  }

  return (
    <AppShell signedIn>
      <div className="mx-auto max-w-5xl p-4 pt-16 sm:p-6 sm:pt-16 lg:pt-6">{children}</div>
    </AppShell>
  );
}
