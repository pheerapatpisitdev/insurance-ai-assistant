"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { signOut } from "@/app/login/actions";
import { isCurrent, menuGroups } from "@/lib/shell/menu";

/**
 * The menu, beside the page on a desk and over it on a phone.
 *
 * Both are used about equally, so neither is the afterthought. Past 1024px it is simply
 * there, 240px of it, and the page is inset by the same amount. Below that it is behind a
 * button, because 240px of a 375px screen is most of the screen.
 *
 * Every colour is a `--shell-*` variable and not one is written here. The six sales pages run
 * from near-black to warm cream under one class name, and a literal picked to look right on
 * one of them is invisible on another — which is a mistake this project has already made
 * twice, and which `HomeButton` carries a note about for the same reason.
 */

function Mark() {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/mark.png" alt="" width={22} height={28} className="h-7 w-auto shrink-0" />
  );
}

export function Sidebar({ signedIn: known }: { signedIn: boolean }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [leaving, startLeaving] = useTransition();

  /**
   * Whether this browser holds a session, asked after the page is up.
   *
   * The back office is left out of the menu entirely without one — a gate and a sign are
   * different things, and naming the pages tells a stranger the shape of the tool. The back
   * office itself passes `true` and never asks, so there is no moment there where the menu
   * is missing its own pages.
   */
  const [signedIn, setSignedIn] = useState(known);
  useEffect(() => {
    if (known) return;
    let alive = true;
    fetch("/api/session", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { signedIn?: boolean }) => { if (alive) setSignedIn(Boolean(d.signedIn)); })
      .catch(() => { /* no session is the safe answer, and it is the one already held */ });
    return () => { alive = false; };
  }, [known]);

  const groups = menuGroups(signedIn);

  // a menu left open across a navigation covers the page that was just asked for
  useEffect(() => { setOpen(false); }, [path]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    // the page behind a drawer must not scroll under it
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open]);

  const panel = (
    <nav
      aria-label="เมนูหลัก"
      className="flex h-full w-60 shrink-0 flex-col overflow-y-auto border-r px-3 py-4"
      style={{ background: "var(--shell-bg)", borderColor: "var(--shell-line)", color: "var(--shell-ink)" }}
    >
      <Link href="/" className="mb-4 flex items-center gap-2 px-2 no-underline" style={{ color: "var(--shell-ink)" }}>
        <Mark />
        <span className="text-sm font-semibold">advisortool</span>
      </Link>

      {groups.map((group, i) => (
        <div key={group.title ?? i} className="mb-3">
          {group.title && (
            <p className="mb-1 px-2 text-[0.7rem] font-medium uppercase tracking-wider" style={{ color: "var(--shell-mute)" }}>
              {group.title}
            </p>
          )}
          <ul className="space-y-0.5">
            {group.links.map((link) => {
              const here = !link.external && isCurrent(link.href, path);
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    {...(link.external ? { target: "_blank", rel: "noreferrer" } : {})}
                    aria-current={here ? "page" : undefined}
                    className="block rounded-md px-2 py-1.5 text-sm no-underline"
                    style={{
                      color: here ? "var(--shell-active)" : "var(--shell-ink)",
                      background: here ? "var(--shell-active-bg)" : "transparent",
                      fontWeight: here ? 600 : 400,
                    }}
                  >
                    {link.label}
                  </Link>
                </li>
              );
            })}
          </ul>
          {i < groups.length - 1 && (
            <hr className="mt-3 border-0 border-t" style={{ borderColor: "var(--shell-line)" }} />
          )}
        </div>
      ))}

      {/* only with a session behind it: a way out shown to somebody who never came in is a
          button that does nothing, which is a fault rather than a preference */}
      {signedIn && (
        <div className="mt-auto px-2 pt-3">
          <button
            type="button" disabled={leaving}
            onClick={() => startLeaving(() => signOut())}
            className="text-sm underline disabled:opacity-50"
            style={{ color: "var(--shell-mute)" }}
          >
            {leaving ? "กำลังออก…" : "ออกจากระบบ"}
          </button>
        </div>
      )}
    </nav>
  );

  return (
    <>
      {/* the desk: simply there, and out of the way of anything fixed on the page */}
      <div className="fixed inset-y-0 left-0 z-30 hidden lg:block">{panel}</div>

      {/* the phone: a button, and the menu over the page when it is pressed */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="เปิดเมนู"
        aria-expanded={open}
        className="fixed left-3 top-3 z-30 rounded-full border p-2 backdrop-blur lg:hidden"
        style={{ background: "var(--shell-bg)", borderColor: "var(--shell-line)", color: "var(--shell-ink)" }}
      >
        <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
          <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
        </svg>
      </button>

      {open && (
        <div className="fixed inset-0 z-40 flex lg:hidden">
          <div className="shell-scrim absolute inset-0" onClick={() => setOpen(false)} aria-hidden />
          <div className="relative h-full">{panel}</div>
        </div>
      )}
    </>
  );
}
