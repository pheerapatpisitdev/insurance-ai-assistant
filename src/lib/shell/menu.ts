/**
 * Everywhere this system can be reached from, in one list.
 *
 * Until now it was three lists that did not know about each other: the back office's own row
 * of links, the calculator's row of sales pages, and a single "way home" button on each sales
 * page. Somebody who had not built it could not tell from any one of them what else there
 * was — which is the second of the four things the owner asked to fix.
 *
 * The owner chose for this menu to appear on every page, including the sales pages a customer
 * reaches from an advertisement, after being told that means a customer sees CRM and API in
 * it. That decision lives here rather than in a condition: what changes with a session is
 * only the way out, because a sign-out button shown to somebody who never signed in is not a
 * preference, it is a button that does nothing.
 */

export interface MenuLink {
  href: string;
  label: string;
  /** opened in a new tab: a sales page is something an agent shows, not somewhere they go */
  external?: boolean;
}

export interface MenuGroup {
  title?: string;
  links: MenuLink[];
}

/**
 * The six sales pages.
 *
 * Written out rather than generated from the plan registry, which is what the design said
 * before the two were compared: there are six pages and five plans, `/legacy` is a way of
 * selling Life Protect rather than a plan of its own, and iSmart has no page at all. A list
 * generated from the registry would therefore invent a link to nowhere and miss two that
 * exist.
 *
 * It was already written out — inside the calculator page, where nothing else could reach it.
 * It is here now so that the menu and the calculator cannot come to disagree about how many
 * pages there are.
 */
export const SALES_PAGES: MenuLink[] = [
  { href: "/lifeprotect", label: "Life Protect x 2" },
  { href: "/legacy", label: "มรดกเพื่อครอบครัว" },
  { href: "/plb", label: "Protection Life" },
  { href: "/lifetreasure", label: "ไลฟ์เทรเชอร์" },
  { href: "/ishield", label: "iShield" },
  { href: "/ihealthy-ultra", label: "iHealthy Ultra" },
];

/**
 * The menu, in the order the work is done in.
 *
 * Selling first, because that is what the day is for; the assistant's own settings next,
 * because they are tended weekly rather than hourly; the channels after that, because they
 * are set up once and then left alone.
 *
 * Without a session the back office is not in it at all. Everything under /admin is gated
 * and always was, but a gate is a different thing from a sign: naming the pages tells a
 * stranger the shape of the tool and where to knock. What is left is what an agent sends
 * customers anyway — the calculator, the assistant, the six sales pages — so a customer
 * standing on one can still reach the others.
 */
export function menuGroups(signedIn: boolean): MenuGroup[] {
  const groups: MenuGroup[] = [];

  if (signedIn) groups.push({ links: [{ href: "/admin", label: "ภาพรวม" }] });

  groups.push({
    title: "งานขาย",
    links: [
      { href: "/other-plans", label: "คำนวณเบี้ย" },
      { href: "/", label: "ถาม AI" },
      ...(signedIn ? [{ href: "/admin/crm", label: "ลูกค้า" }] : []),
    ],
  });

  if (signedIn) {
    groups.push({
      title: "ผู้ช่วย AI",
      links: [
        { href: "/admin/ai", label: "ตั้งค่า" },
        { href: "/admin/knowledge", label: "สอน AI" },
      ],
    });
    groups.push({
      title: "ช่องทาง",
      links: [
        { href: "/admin/messenger", label: "Messenger" },
        { href: "/admin/ads", label: "โฆษณา" },
        { href: "/admin/api", label: "API" },
      ],
    });
  }

  groups.push({ title: "หน้าขาย", links: SALES_PAGES.map((p) => ({ ...p, external: true })) });
  return groups;
}

/**
 * Whether a link is the page being looked at.
 *
 * "/" has to be exact or it marks itself current on every page in the site; everything else
 * matches its own subtree, so /admin/crm stays lit while a tab inside it is open.
 */
export function isCurrent(href: string, path: string): boolean {
  if (href === "/") return path === "/";
  if (href === "/admin") return path === "/admin";
  return path === href || path.startsWith(`${href}/`);
}
