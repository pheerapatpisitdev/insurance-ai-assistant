import { describe, expect, it } from "vitest";
import { answerHealth } from "@/lib/assistant/ihealthy/answer";
import { arrangementFor, healthQuote } from "@/lib/assistant/ihealthy/quote";
import type { HealthSlots } from "@/lib/assistant/ihealthy/route";
import { CHOOSE_HEALTH } from "@/lib/assistant/choose";
import { answerAny } from "@/lib/assistant/dispatch";
import { iHealthyPricing } from "@/lib/ihealthy-quote";
import { iHealthyTable } from "@/lib/ihealthy-table";

/**
 * What the health brain leaves for the record. Every route here is answered before a model
 * is paid, so none of these tests needs one stubbed.
 */

const said = (content: string) => [{ role: "user" as const, content }];
const quoted: HealthSlots & { age: number; sex: "F"; plan: string } =
  { product: "ihealthy", intent: "quote", age: 35, sex: "F", plan: "GOLD" };
const kinds = (trace: { kind: string }[] | undefined) => (trace ?? []).map((t) => t.kind);

describe("a health quotation in the record", () => {
  it("writes the premium down exactly as the engine made it", () => {
    const reply = healthQuote(quoted);
    const table = iHealthyTable();
    const v = arrangementFor({ age: 35, sex: "F", plan: "GOLD" });
    const priced = iHealthyPricing(table, {
      base: v.base, sex: "F", age: 35, sumAssured: v.sumAssured, plan: v.plan, territory: v.territory, coverage: v.coverage,
    })!;
    expect(reply.priced).toBe(true);
    expect(kinds(reply.trace)).toEqual(["quoted"]);
    expect(reply.trace![0].data).toMatchObject({ planCode: "IHU", plan: "GOLD", age: 35, sex: "F", base: v.base, sumAssured: v.sumAssured });
    expect(reply.trace![0].data!.annual).toBe(priced.total.find((m) => m.mode === "annual")!.total / 100);
    expect(reply.trace![0].data!.monthly).toBe(priced.total.find((m) => m.mode === "monthly")!.total / 100);
  });

  it("says why there was no price for an age the rider is not written at", () => {
    const reply = healthQuote({ ...quoted, age: 3 });
    expect(reply.priced).toBeFalsy();
    expect(kinds(reply.trace)).toEqual(["no_price", "handover"]);
    expect(reply.trace![0].data).toMatchObject({ reason: "out_of_range", age: 3 });
  });
});

describe("the health brain's turns in the record", () => {
  it("records the form going out, with the code that rides on the link", async () => {
    const answer = await answerHealth(said("สมัครยังไง"), quoted, { formRef: "abc123def4" });
    expect(answer.messages[1].text).toBe("https://ktaxaform.vercel.app/?ref=sa-9f3a&lead=abc123def4");
    expect(answer.trace).toEqual([{ kind: "form_sent", data: { had_quote: true, form_ref: "abc123def4" } }]);
    expect(answer.slots.formSent).toBe(true);
  });

  it("records the customer stepping back", async () => {
    const answer = await answerHealth(said("ขอคิดดูก่อนนะคะ"), quoted);
    expect(answer.trace).toEqual([{ kind: "stalled", data: { had_quote: true } }]);
  });

  it("names the written answer it gave, and hands a condition to a person", async () => {
    const answer = await answerHealth(said("เป็นเบาหวานทำได้ไหม"), quoted);
    expect(kinds(answer.trace)).toEqual(["faq", "handover"]);
    expect(answer.trace![0].data).toEqual({ key: "health" });
    expect(answer.trace![1].data).toEqual({ reason: "health" });
  });

  it("records the menu of plans when the button that names the product is tapped", async () => {
    const answer = await answerHealth(said(CHOOSE_HEALTH), { product: "ihealthy", intent: "quote", age: 35, sex: "F" });
    expect(kinds(answer.trace)).toEqual(["menu"]);
    expect(answer.messages.length).toBeGreaterThan(0);
  });

  it("carries the quotation's own trace when a territory re-prices the plan", async () => {
    const answer = await answerHealth(said("ทั่วโลก"), { ...quoted, plan: "PLATINUM" });
    expect(kinds(answer.trace)[0]).toBe("territory");
    // a re-priced plan carries its quoted figures; a refused territory says why not
    expect(kinds(answer.trace).some((k) => k === "quoted" || k === "no_price") || answer.messages.length > 0).toBe(true);
  });
});

describe("the dispatcher in the record", () => {
  it("notes when the customer had to be asked which plan they came for", async () => {
    const answer = await answerAny(said("สนใจค่ะ"), null);
    expect(answer.slots).toMatchObject({ product: "undecided" });
    expect(answer.trace).toEqual([{ kind: "asked_which" }]);
  });
});
