"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarIcon, PenIcon, PeopleIcon, QuoteIcon } from "./ui/icons";

/**
 * The workbench's four pages as one row of tabs, the same on each of them. Each page used to
 * carry its own way out — three pills on /content, a "← กลับไปสร้างคอนเทนต์" on the others —
 * so the way from the calendar to the formula library was back to the start and out again.
 *
 * Plain links: a page with unsaved words in its editor catches the click itself (ContentStudio).
 */
const TABS = [
  { href: "/studio", label: "สร้างคอนเทนต์", Icon: PenIcon },
  { href: "/studio/calendar", label: "ปฏิทินโพสต์", Icon: CalendarIcon },
  { href: "/studio/hooks", label: "คลังสูตรประโยคเปิด", Icon: QuoteIcon },
  { href: "/studio/people", label: "คลังบุคคล", Icon: PeopleIcon },
] as const;

export function SubNav() {
  const path = usePathname();
  const here = (href: string) => (href === "/studio" ? path === "/studio" : path === href || path.startsWith(`${href}/`));
  return (
    <nav aria-label="เมนูคอนเทนต์" className="grid grid-cols-2 gap-1 rounded-xl border border-[var(--ct-hair)] bg-[var(--ct-panel)] p-1 sm:inline-flex sm:flex-wrap">
      {TABS.map(({ href, label, Icon }) => {
        const on = here(href);
        return (
          <Link
            key={href} href={href} aria-current={on ? "page" : undefined}
            className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-3 text-center text-sm leading-snug ${on
              ? "bg-[var(--ct-soft)] font-medium text-[var(--ct-accent)]"
              : "text-[var(--ct-mute)] hover:bg-[var(--ct-ground)] hover:text-[var(--ct-ink)]"}`}
          >
            <Icon className="hidden size-4 sm:block" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
