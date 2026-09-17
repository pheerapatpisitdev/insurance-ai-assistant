import { Sidebar } from "./Sidebar";

/**
 * The menu, and the room left for it.
 *
 * `signedIn` is passed in rather than read here, and that is not a style choice. Reading the
 * cookie means importing `next/headers`, which makes every page that renders this dynamic —
 * and two of them, the calculator and the sales pages, are built ahead of time and served
 * from the edge to whoever an advertisement sends. Asking the session a question on those
 * pages broke them outright, and the version that merely made them dynamic would have been
 * worse: it would have worked, and cost every customer a server round trip forever.
 *
 * So only the back office passes `true`, because only the back office already knows — its
 * layout has redirected anyone without a session before this renders. The consequence is that
 * an agent looking at the calculator has no sign-out button in front of them; the way out is
 * in the back office, which is where they went to sign in.
 *
 * The wrapper is not decoration. `globals.css` gives every direct child of `.theme-legacy`
 * `position: relative; z-index: 1`, and that selector beats a Tailwind utility on
 * specificity — so a `fixed` child placed there is laid out relative anyway and becomes a
 * full-width band across the top of all six sales pages. The plain `relative` div takes that
 * rule instead, and costs no height because everything inside it is fixed. `HomeButton`
 * solved the same problem the same way, and this replaces it.
 */
export function AppShell({ children, signedIn = false }: { children: React.ReactNode; signedIn?: boolean }) {
  return (
    <>
      {/* the page first, the menu after it, for the painting order the note above describes */}
      <div className="shell-inset">{children}</div>
      <div className="relative">
        <Sidebar signedIn={signedIn} />
      </div>
    </>
  );
}
