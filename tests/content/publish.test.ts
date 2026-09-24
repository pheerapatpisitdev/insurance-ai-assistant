import { describe, expect, it } from "vitest";
import { onPage, publishLabel, publishView, quickTimes } from "@/lib/content/publish-label";
import { explain, postLink } from "@/lib/facebook/publish";
import type { Publish } from "@/lib/content/store";

const now = new Date("2026-09-25T10:00:00+07:00");
const at = (iso: string): Publish => ({ state: "scheduled", pageId: "1", postId: "1_2", at: iso, error: null });

describe("publishView", () => {
  it("reads a schedule still ahead as scheduled, and one whose time has passed as posted", () => {
    expect(publishView(at("2026-09-25T19:30:00+07:00"), now).kind).toBe("scheduled");
    expect(publishView(at("2026-09-25T09:00:00+07:00"), now).kind).toBe("published");
  });

  it("treats a cancelled schedule as never sent, so it can be scheduled again", () => {
    expect(publishView({ ...at("2026-09-26T12:00:00+07:00"), state: "cancelled" }, now).kind).toBe("none");
    expect(publishView(null, now).kind).toBe("none");
  });

  it("labels the card in Thailand's time", () => {
    expect(publishLabel(at("2026-09-25T19:30:00+07:00"), now)).toContain("19:30");
    expect(publishLabel({ state: "failed", pageId: null, postId: null, at: null, error: "x" }, now)).toContain("ไม่สำเร็จ");
    expect(publishLabel(null, now)).toBeNull();
  });
});

describe("onPage", () => {
  const p = (state: Publish["state"]): Publish => ({ state, pageId: "1", postId: null, at: null, error: null });
  it("a piece posted, scheduled or on its way lives on the calendar, not in the studio's lists", () => {
    expect(onPage(p("scheduled"))).toBe(true);
    expect(onPage(p("published"))).toBe(true);
    expect(onPage(p("posting"))).toBe(true);
  });
  it("a cancelled or refused one comes back to the lists, as does one never sent", () => {
    expect(onPage(p("cancelled"))).toBe(false);
    expect(onPage(p("failed"))).toBe(false);
    expect(onPage(null)).toBe(false);
  });
});

describe("quickTimes", () => {
  it("offers this evening only while it is at least fifteen minutes ahead", () => {
    const morning = new Date(2026, 8, 25, 10, 0);
    expect(quickTimes(morning).map((t) => t.label)).toEqual(["วันนี้ 19:30", "พรุ่งนี้ 12:00", "พรุ่งนี้ 19:30"]);
    const late = new Date(2026, 8, 25, 19, 20);
    expect(quickTimes(late).map((t) => t.label)).toEqual(["พรุ่งนี้ 12:00", "พรุ่งนี้ 19:30"]);
  });
});

describe("Facebook's refusals", () => {
  it("names the missing permission, the expired login and the temporary block in words the owner can act on", () => {
    expect(explain({ error: { code: 200, message: "(#200) permission" } }, 403).message).toContain("pages_manage_posts");
    expect(explain({ error: { code: 190 } }, 400).message).toContain("หมดอายุ");
    expect(explain({ error: { code: 368 } }, 400).message).toContain("บล็อก");
    expect(explain({ error: { code: 100, message: "bad time" } }, 400).message).toContain("bad time");
  });

  it("links a post id to the Page's post and a photo id to the photo", () => {
    expect(postLink("105_777")).toBe("https://www.facebook.com/105/posts/777");
    expect(postLink("888")).toBe("https://www.facebook.com/photo/?fbid=888");
  });
});
