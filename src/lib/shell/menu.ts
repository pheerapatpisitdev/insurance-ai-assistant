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

/** The drawings the menu has. One per kind of work, not one per link — see `icon` below. */
export type MenuIcon =
  | "grid"
  | "calc"
  | "spark"
  | "users"
  | "sliders"
  | "book"
  | "chat"
  | "megaphone"
  | "code"
  | "shield"
  | "home"
  | "umbrella"
  | "gem"
  | "shieldCheck"
  | "heart"
  | "building"
  | "clock";

export interface MenuLink {
  href: string;
  label: string;
  /** which drawing sits on its chip */
  icon: MenuIcon;
  /**
   * The item's own colour.
   *
   * This is the one place in the shell where a colour is written down, and the exception is
   * narrow on purpose. Every other colour here is a `--shell-*` variable because the same
   * menu is worn by six sales pages running from near-black to warm cream, and a literal
   * picked to look right on one of them vanishes on another — a mistake this project has
   * made twice.
   *
   * A hue is safe from that because it is never laid on the page's ground: it fills a chip
   * of its own, the chip carries white ink, and the chip's edge is drawn by the relief in
   * `globals.css` rather than by the difference between the hue and whatever is behind it.
   * What it buys is recognition — after a week the agent reaches for the orange one without
   * reading the word, on any page.
   */
  hue: string;
  /** True only for links that leave this application. */
  external?: boolean;
}

export interface MenuGroup {
  title?: string;
  links: MenuLink[];
}

/**
 * The eight sales pages, in the four kinds of cover the agency sells.
 *
 * Grouped because eight names in one column is a list to be read through, and an agent
 * reaching for a page is not reading — they know whether the customer in front of them is
 * asking about dying, about being ill, about a hospital bill, or about their staff. The
 * headings answer that before the names are read at all.
 *
 * A plan sits under what it is bought for, not under what it is built from. มรดกเพื่อครอบครัว
 * is a life contract with a critical-illness rider on it and iShield is a whole life policy,
 * and nobody buys either for the life cover: they buy the money that arrives on the day of a
 * diagnosis. Filing them under ประกันชีวิต would be filing them where nobody would look.
 *
 * Written out rather than generated from the plan registry, which is what the design said
 * before the two were compared: there are eight pages and six plans, `/legacy` is a way of
 * selling Life Protect rather than a plan of its own, iSmart has no page at all, and
 * `/group-insurance` is not a life plan and is not in the registry. A list generated from
 * the registry would therefore invent a link to nowhere and miss three that exist.
 *
 * Each one's hue leans toward the page it opens — copper for iShield, gold for the legacy
 * bundle, the corporate navy for group insurance — so the menu and the page an agent lands
 * on are plainly the same thing.
 */
export const SALES_SECTIONS: { title: string; links: MenuLink[] }[] = [
  {
    title: "ประกันชีวิต",
    links: [
      { href: "/lifeprotect", label: "Life Protect x 2", icon: "shield", hue: "#e11d48" },
      { href: "/plb", label: "Protection Life", icon: "umbrella", hue: "#0f766e" },
      { href: "/easyprotect", label: "อีซี่ โพรเทค 6", icon: "clock", hue: "#15803d" },
      { href: "/lifetreasure", label: "ไลฟ์เทรเชอร์", icon: "gem", hue: "#7e22ce" },
    ],
  },
  {
    title: "ประกันโรคร้ายแรง",
    links: [
      { href: "/legacy", label: "มรดกเพื่อครอบครัว", icon: "home", hue: "#b45309" },
      { href: "/ishield", label: "iShield", icon: "shieldCheck", hue: "#c2410c" },
    ],
  },
  {
    title: "ประกันสุขภาพ",
    links: [
      { href: "/ihealthy-ultra", label: "iHealthy Ultra", icon: "heart", hue: "#0369a1" },
    ],
  },
  {
    title: "ประกันกลุ่ม",
    links: [
      { href: "/group-insurance", label: "ประกันภัยกลุ่ม", icon: "building", hue: "#292d78" },
    ],
  },
];

/**
 * The same eight, flat.
 *
 * `/other-plans` lists them as cards in one grid and has no use for the headings, and the
 * test that checks none of the pages on disk has been left out of the menu counts them here.
 * Derived rather than written twice, so a page added to a section cannot go missing from the
 * grid — which is the way round this went wrong when the list lived inside the calculator.
 */
export const SALES_PAGES: MenuLink[] = SALES_SECTIONS.flatMap((s) => s.links);

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

  if (signedIn) groups.push({ links: [{ href: "/admin", label: "ภาพรวม", icon: "grid", hue: "#4f46e5" }] });

  /**
   * ประกันภัยกลุ่ม used to be here as well as under its own heading below.
   *
   * It earned the repeat: it is the agent's own calculator — several groups of employees, a
   * total, a quotation — and it is what gets turned round and shown to the HR manager. The
   * owner was asked which of the two it was and answered both.
   *
   * Then the sales pages were dealt into the four kinds of cover, and one of those headings
   * is ประกันกลุ่ม. Two links a few lines apart, one called ประกันกลุ่ม and one called
   * ประกันภัยกลุ่ม, read as a mistake however well meant — so the owner took this one out.
   * The page is still both things; it is now reached from one place.
   */
  groups.push({
    title: "งานขาย",
    links: [
      // "จัดแบบเอง" rather than "คำนวณเบี้ย": every sales page in this menu works out a
      // premium too, so naming this one after the arithmetic said nothing about what is
      // different here — which is that the agent builds the arrangement themselves, plan by
      // rider, instead of being walked through one plan's own questions.
      { href: "/other-plans", label: "จัดแบบเอง", icon: "calc", hue: "#0d9488" },
      { href: "/", label: "ถาม AI", icon: "spark", hue: "#7c3aed" },
      ...(signedIn ? [{ href: "/admin/crm", label: "ลูกค้า", icon: "users" as const, hue: "#d97706" }] : []),
    ],
  });

  if (signedIn) {
    groups.push({
      title: "ผู้ช่วย AI",
      links: [
        { href: "/admin/ai", label: "ตั้งค่า", icon: "sliders", hue: "#0284c7" },
        { href: "/admin/knowledge", label: "สอน AI", icon: "book", hue: "#be185d" },
      ],
    });
    groups.push({
      title: "ช่องทาง",
      links: [
        { href: "/admin/messenger", label: "Messenger", icon: "chat", hue: "#2563eb" },
        { href: "/admin/api", label: "API", icon: "code", hue: "#059669" },
      ],
    });
  }

  // Sales pages are part of the calculator, so the sidebar keeps the user in the same tab.
  // `external` remains available for a genuinely off-site link added in the future.
  for (const section of SALES_SECTIONS) {
    groups.push({ title: section.title, links: section.links });
  }
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
