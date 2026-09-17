import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import path from "node:path";
import { isCurrent, menuGroups, SALES_PAGES } from "@/lib/shell/menu";

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
    for (const group of menuGroups()) {
      for (const link of group.links) {
        expect(routeExists(link.href), `${link.label} → ${link.href}`).toBe(true);
      }
    }
  });

  it("names every sales page the site actually has", () => {
    // the pages are what a customer is sent; one missing from here is one the agent cannot
    // find from inside their own tool
    const onDisk = ["lifeprotect", "legacy", "plb", "lifetreasure", "ishield", "ihealthy-ultra"];
    expect(SALES_PAGES.map((p) => p.href).sort()).toEqual(onDisk.map((s) => `/${s}`).sort());
  });

  it("opens a sales page in its own tab and an agent's own page in place", () => {
    const groups = menuGroups();
    const sales = groups.find((g) => g.title === "หน้าขาย")!;
    expect(sales.links.every((l) => l.external)).toBe(true);
    const work = groups.find((g) => g.title === "งานขาย")!;
    expect(work.links.some((l) => l.external)).toBe(false);
  });

  it("has no duplicate destination", () => {
    const all = menuGroups().flatMap((g) => g.links.map((l) => l.href));
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
