import { describe, expect, it } from "vitest";
import { claimSystem } from "@/lib/content/claim";
import { planMessages } from "@/lib/content/plan";
import { LOOP_PLAN, LOOP_RULES, buildMessages } from "@/lib/content/prompt";
import { recruitSystem } from "@/lib/content/recruit";

/** คลิปวนลูป (owner, 2026-09-27): the ending runs back into the opening line */
describe("คลิปวนลูป", () => {
  const brief = "## Life Protect x 2\n- ทุน 100,000 บาท";
  const plans = [{ angle: "พ่อแม่ที่ลูกยังเรียน", hook: "คนส่วนใหญ่ซื้อประกันช้าไปหนึ่งปีเสมอ" }];
  const ask = { brief, format: "script" as const, angle: "" as const, custom: "", length: "60" as const, plans };

  it("tells the plan's script writer to leave the ending open and move the invitation to the middle", () => {
    const [, user] = buildMessages({ ...ask, loop: true });
    expect(user.content).toContain(LOOP_RULES);
    expect(LOOP_RULES).toContain("กลางคลิป");
    expect(LOOP_RULES).toContain("ห้ามมีคำลา");
  });

  it("leaves an ordinary script, and a post, as they were", () => {
    expect(buildMessages(ask)[1].content).not.toContain(LOOP_RULES);
    expect(buildMessages({ ...ask, format: "post", length: null, loop: true })[1].content).not.toContain(LOOP_RULES);
  });

  it("asks the planner for hooks that can finish a sentence", () => {
    const base = { brief, count: 1, angle: "", avoid: [], template: null };
    expect(planMessages({ ...base, loop: true })[1].content).toContain(LOOP_PLAN);
    expect(planMessages(base)[1].content).not.toContain(LOOP_PLAN);
  });

  it("reaches รีวิวเคลม's and หาทีม's script writers, and only their scripts", () => {
    expect(claimSystem("script", "60", true)).toContain(LOOP_RULES);
    expect(recruitSystem("script", "60", true)).toContain(LOOP_RULES);
    expect(claimSystem("script", "60")).not.toContain(LOOP_RULES);
    expect(claimSystem("post", null, true)).not.toContain(LOOP_RULES);
    expect(recruitSystem("ad", null, true)).not.toContain(LOOP_RULES);
  });
});
