import "./theme.css";
import { AppShell } from "@/components/shell/AppShell";
import { SubNav } from "./SubNav";

/**
 * Every page of the workbench in one frame: the application's menu, the content palette, and
 * the row of tabs between the four pages. The pages under it draw only their own content, so
 * the tabs stay put while the next page loads (loading.tsx) instead of the screen going blank.
 *
 * /maryjane draws the workbench without any of this — the owner asked for a page with nothing
 * else on it — so it imports StudioPage directly and never passes through here.
 */
export default function ContentLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="content-page">
      <AppShell>
        {/* pt-16 below lg: the phone's menu button is fixed at the top left */}
        <div className="mx-auto max-w-[1400px] px-4 pb-10 pt-16 lg:pt-6">
          <SubNav />
          <div className="mt-5">{children}</div>
        </div>
      </AppShell>
    </div>
  );
}
