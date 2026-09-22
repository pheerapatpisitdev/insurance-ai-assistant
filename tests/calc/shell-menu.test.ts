import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import path from "node:path";
import { isCurrent, menuGroups, SALES_PAGES, SALES_SECTIONS } from "@/lib/shell/menu";

/**
 * The menu is the answer to "what is there", so a link in it that goes nowhere is worse than
 * no menu at all — it is the page telling somebody a thing exists when it does not.
 *
 * Checked against the filesystem rather than against a second list, because a second list is
 * the thing that drifts. If a route is renamed, this fails on the rename.
 */

const APP = path.join(process.cwd(), "src/app");
const routeExists = (href: string) => {
  const dir = href === "/" ? APP : path.join(APP, href);
  return existsSync(path.join(dir, "page.tsx")) || existsSync(path.join(dir, "page.ts"));
};

describe("every place the menu says you can go", () => {
  it("is a page that exists", () => {
    for (const group of menuGroups(true)) {
      for (const link of group.links) {
        expect(routeExists(link.href), `${link.label} → ${link.href}`).toBe(true);
      }
    }
  });

  it("names every sales page the site actually has", () => {
    // the pages are what a customer is sent; one missing from here is one the agent cannot
    // find from inside their own tool
    const onDisk = [
      "lifeprotect", "legacy", "plb", "easyprotect", "lifetreasure", "ishield", "ihealthy-ultra",
      "group-insurance", "bumnan95",
    ];
    expect(SALES_PAGES.map((p) => p.href).sort()).toEqual(onDisk.map((s) => `/${s}`).sort());
  });

  /**
   * A sales page is a page of this tool, not a place off it.
   *
   * They used to open in a new tab, on the reading that a sales page is for the customer and
   * the calculator is for the agent. It is the same person: an agent works out a premium on
   * the sales page itself, and every jump left another tab behind until the browser was a row
   * of the same site. The `external` flag stays in the type for a genuinely off-site link;
   * nothing in the menu is one today.
   */
  it("keeps every page in the menu in the same tab", () => {
    const groups = menuGroups(true);
    const sales = groups.filter((g) => SALES_SECTIONS.some((s) => s.title === g.title));
    expect(sales).toHaveLength(SALES_SECTIONS.length);
    expect(groups.flatMap((g) => g.links).some((l) => l.external)).toBe(false);
  });

  /**
   * Eight pages in one column is a list to be read through. An agent reaching for a page
   * knows whether the customer is asking about dying, about being ill, about a hospital bill
   * or about their staff, and the headings answer that before the names are read.
   */
  it("deals the sales pages into the five kinds of cover, losing none", () => {
    expect(SALES_SECTIONS.map((s) => s.title))
      .toEqual(["ประกันชีวิต", "ประกันโรคร้ายแรง", "ประกันสุขภาพ", "ประกันบำนาญ", "ประกันกลุ่ม"]);
    expect(SALES_SECTIONS.flatMap((s) => s.links)).toEqual(SALES_PAGES);
    // and no page is filed under two kinds at once
    expect(new Set(SALES_PAGES.map((p) => p.href)).size).toBe(SALES_PAGES.length);
  });

  /**
   * Half these names were Thai transliterations of English the company already owns — อีซี่
   * โพรเทค 6 beside Life Protect x 2 — and one column in two conventions reads as an
   * oversight. The headings are not names and stay Thai: they are the question the agent is
   * answering when they reach for a page.
   */
  it("names every sales page in English, under headings that stay Thai", () => {
    const THAI = /[\u0E00-\u0E7F]/;
    for (const page of SALES_PAGES) {
      expect(page.label, page.href).not.toMatch(THAI);
    }
    for (const section of SALES_SECTIONS) {
      expect(section.title, section.title).toMatch(THAI);
    }
  });

  it("lists no destination twice inside one group", () => {
    for (const group of menuGroups(true)) {
      const hrefs = group.links.map((l) => l.href);
      expect(new Set(hrefs).size, group.title ?? "(untitled)").toBe(hrefs.length);
    }
  });

  /**
   * ประกันภัยกลุ่ม was in two groups on purpose for a while — the agent's own calculator and
   * the page they turn round and show the HR manager. Then the sales pages were dealt into
   * four headings and one of them was ประกันกลุ่ม, so the pair read as a mistake and the
   * owner took the first one out. Every destination is listed once again.
   */
  it("lists every destination exactly once", () => {
    const all = menuGroups(true).flatMap((g) => g.links.map((l) => l.href));
    expect(new Set(all).size).toBe(all.length);
  });
});

describe("which link is lit", () => {
  it("lights the page being looked at, and its children", () => {
    expect(isCurrent("/admin/crm", "/admin/crm")).toBe(true);
    expect(isCurrent("/admin/crm", "/admin/crm/anything")).toBe(true);
    expect(isCurrent("/admin/ai", "/admin/crm")).toBe(false);
  });

  it("does not light the chat on every page in the site", () => {
    // "/" is a prefix of everything, and matching it as one lit the whole menu at once
    expect(isCurrent("/", "/")).toBe(true);
    expect(isCurrent("/", "/plb")).toBe(false);
    expect(isCurrent("/", "/admin/ai")).toBe(false);
  });

  it("keeps the overview apart from the pages under it", () => {
    expect(isCurrent("/admin", "/admin")).toBe(true);
    expect(isCurrent("/admin", "/admin/ai")).toBe(false);
  });
});

/**
 * What a customer may see, and what only an agent may.
 *
 * The owner first asked for one menu for everybody and was shown what that meant — somebody
 * arriving from an advertisement reading CRM and API — then changed their mind, which is the
 * reason this is a test and not a comment. The back office is not merely gated now; it is not
 * announced.
 *
 * The public half is not an oversight either. The calculator and the sales pages are things
 * an agent sends to customers, so a customer standing on one is meant to be able to reach the
 * others.
 */
describe("what the menu shows to somebody who has not signed in", () => {
  const hrefs = (signedIn: boolean) => menuGroups(signedIn).flatMap((g) => g.links.map((l) => l.href));

  it("keeps every back-office page out of it", () => {
    const out = hrefs(false);
    for (const secret of ["/admin", "/admin/crm", "/admin/ai", "/admin/knowledge", "/admin/messenger", "/admin/ads", "/admin/api"]) {
      expect(out, secret).not.toContain(secret);
    }
  });

  it("still offers the pages a customer is sent to", () => {
    const out = hrefs(false);
    expect(out).toContain("/");
    expect(out).toContain("/other-plans");
    for (const page of SALES_PAGES) expect(out).toContain(page.href);
  });

  it("gives an agent everything back", () => {
    const out = hrefs(true);
    for (const page of ["/admin", "/admin/crm", "/admin/api", "/other-plans", "/"]) {
      expect(out, page).toContain(page);
    }
  });

  it("names no group a signed-out reader has nothing in", () => {
    // an empty heading is a heading that says something is being kept from you
    for (const group of menuGroups(false)) expect(group.links.length).toBeGreaterThan(0);
  });
});
