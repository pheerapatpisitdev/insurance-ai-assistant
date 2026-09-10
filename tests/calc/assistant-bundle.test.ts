import { describe, it, expect } from "vitest";
import { bundleNamedIn, tierForSum, mergeSlots, type Routed } from "@/lib/assistant/route";
import { bundleFacts } from "@/lib/assistant/catalogue";
import { bundleReply, tierChoices } from "@/lib/assistant/format";
import { getBundle } from "@/calc/bundles/registry";
import { bundleModePremiums, describeTier, quoteBundle } from "@/calc/bundles/quote";
import { answerBundle, isBundleTurn } from "@/lib/assistant/answer";

describe("recognising the bundle by name", () => {
  it.each([
    "สนใจประกันมรดก",
    "มรดกเพื่อครอบครัว",
    "อยากทำมรดก 3 ล้าน",
    "ประกันมรดกเพื่อครอบครัวคืออะไร",
  ])("%s", (text) => {
    expect(bundleNamedIn(text)).toBe("LEGACY_FAMILY");
  });

  it("finds nothing in a message about an ordinary plan", () => {
    expect(bundleNamedIn("ไลฟ์โพรเทค ชาย 35 ทุน 1 ล้าน")).toBeUndefined();
  });
});

describe("reading which step of the bundle was asked for", () => {
  it("turns whole millions into the tier sold at that size", () => {
    expect(tierForSum("LEGACY_FAMILY", 3_000_000)).toBe(3);
    expect(tierForSum("LEGACY_FAMILY", 10_000_000)).toBe(10);
  });

  it("refuses a size the bundle does not sell", () => {
    expect(tierForSum("LEGACY_FAMILY", 11_000_000)).toBeUndefined();
    expect(tierForSum("LEGACY_FAMILY", 1_500_000)).toBeUndefined();
    expect(tierForSum("LEGACY_FAMILY", undefined)).toBeUndefined();
  });

  it("keeps the bundle and its step together across turns", () => {
    const first: Routed = { intent: "quote", bundleCode: "LEGACY_FAMILY", tier: 3, age: 35, sex: "M" };
    expect(mergeSlots(first, { intent: "quote", sex: "F" })).toMatchObject({ bundleCode: "LEGACY_FAMILY", tier: 3 });
  });

  it("re-picks the step from a fresh amount while the bundle is carried over", () => {
    const first: Routed = { intent: "quote", bundleCode: "LEGACY_FAMILY", tier: 2, age: 40, sex: "M" };
    const merged = mergeSlots(first, { intent: "quote", age: 35, sumAssured: 1_000_000 });
    expect(merged).toMatchObject({ bundleCode: "LEGACY_FAMILY", tier: 1, age: 35, sex: "M" });
  });

  it("forgets the old step when the fresh amount is not a step the bundle sells", () => {
    const first: Routed = { intent: "quote", bundleCode: "LEGACY_FAMILY", tier: 2 };
    expect(mergeSlots(first, { intent: "quote", sumAssured: 1_500_000 }).tier).toBeUndefined();
  });

  it("drops the step when the customer moves to a different bundle", () => {
    const first: Routed = { intent: "quote", bundleCode: "LEGACY_FAMILY", tier: 3 };
    expect(mergeSlots(first, { intent: "quote", bundleCode: "SOMETHING_ELSE" }).tier).toBeUndefined();
  });
});

describe("what the assistant knows about the bundle", () => {
  const facts = bundleFacts();

  it("names it as the agency sells it", () => {
    expect(facts).toContain("มรดกเพื่อครอบครัว");
  });

  it("says what it is built from, so the answer is not a guess", () => {
    expect(facts).toContain("Life Protect x 2");
    expect(facts).toContain("DCI");
  });

  it("carries the ages the whole arrangement can be issued at, not just the plan's", () => {
    // DCI stops at 65 while the plan runs to 80, and the bundle is sold whole
    expect(facts).toContain("รับอายุ 20-65 ปี");
  });

  it("lists every step on offer", () => {
    expect(facts).toContain("มรดก 1 ล้าน");
    expect(facts).toContain("มรดก 10 ล้าน");
  });
});

describe("quoting the bundle in a chat", () => {
  const bundle = getBundle("LEGACY_FAMILY")!;
  const who = { age: 35, sex: "M" as const };
  const result = quoteBundle(bundle, 3, { ...who, mode: "annual" })!;
  const reply = bundleReply(bundle.name, describeTier(bundle, 3)!, who, result, bundleModePremiums(bundle, 3, who));

  it("leads with the bundle and the step, not the base plan", () => {
    expect(reply.split("\n")[0]).toBe("ชุดมรดกเพื่อครอบครัว — มรดก 3 ล้าน");
  });

  it("prices all three payment modes, which is the question this product gets", () => {
    for (const label of ["รายปี", "ราย 6 เดือน", "รายเดือน"]) expect(reply).toContain(label);
  });

  it("itemises the cover by sum assured and never by premium, because the parts are not sold apart", () => {
    expect(reply).toContain("ทุน 150,000 บาท");
    expect(reply).toContain("ทุน 2,850,000 บาท");
    const cover = reply.split("\n\n").find((b) => b.startsWith("ความคุ้มครอง"))!;
    for (const line of cover.split("\n").filter((l) => l.startsWith("- "))) {
      expect(line, line).toContain("ทุน ");
    }
  });

  it("counts the rider into the death benefit, because DCI pays on death too", () => {
    expect(reply).toContain("เสียชีวิตก่อนอายุ 60 ปี 3,150,000 บาท");
    expect(reply).toContain("อายุ 60–74 ปี 3,000,000 บาท");
  });

  /**
   * DCI stops at 75 and the plan runs to 99. An answer that quotes three million for every
   * age after 60 is out by twenty times for the years the customer is most likely to die in.
   */
  it("says what is left after the rider's cover ends", () => {
    expect(reply).toContain("อายุ 75 ปีขึ้นไป 150,000 บาท");
  });

  it("still says the number is not a formal quotation", () => {
    expect(reply).toContain("ไม่ใช่ใบเสนอราคา");
  });
});

describe("offering the steps to choose from", () => {
  it("puts every step on its own line", () => {
    expect(tierChoices(["เล็ก", "กลาง", "ใหญ่"])).toBe("- เล็ก\n- กลาง\n- ใหญ่");
  });

  it("keeps one line per step however many there are", () => {
    const names = Array.from({ length: 10 }, (_, i) => `มรดก ${i + 1} ล้าน`);
    const lines = tierChoices(names).split("\n");
    expect(lines).toHaveLength(10);
    expect(lines[0]).toBe("- มรดก 1 ล้าน");
    expect(lines[9]).toBe("- มรดก 10 ล้าน");
  });

  it("prints the agency's own wording untouched", () => {
    expect(tierChoices(["แผนพิเศษ A+"])).toBe("- แผนพิเศษ A+");
  });

  it("says nothing when there is nothing to choose from", () => {
    expect(tierChoices([])).toBe("");
  });
});

describe("what a first message about the bundle gets back", () => {
  const ask = (slots: Partial<Routed>) => answerBundle({ intent: "quote", bundleCode: "LEGACY_FAMILY", ...slots }).reply;

  it("explains the arrangement before asking anything, for someone arriving cold", () => {
    const reply = ask({});
    expect(reply.startsWith("ชุดมรดกเพื่อครอบครัว\n")).toBe(true);
    expect(reply).toContain("Life Protect x 2");
    expect(reply).toContain("โรคร้ายแรง (DCI)");
    expect(reply).toContain("รับอายุ 20-65 ปี");
    expect(reply).toContain("มรดก 1 ล้าน");
    expect(reply).toContain("มรดก 10 ล้าน");
    expect(reply).toContain("ขออายุและเพศ");
  });

  it("does not repeat the ten steps once the customer has named one", () => {
    const reply = ask({ tier: 5 });
    expect(reply.split("\n")[0]).toBe("ชุดมรดกเพื่อครอบครัว — มรดก 5 ล้าน");
    expect(reply).not.toContain("มรดก 1 ล้าน");
    expect(reply).toContain("ขออายุและเพศ");
  });

  it("asks only for what is still missing", () => {
    expect(ask({ tier: 5, sex: "M" })).toContain("ขออายุของผู้เอาประกัน");
    expect(ask({ tier: 5, age: 40 })).toContain("ขอเพศของผู้เอาประกัน");
  });

  it("asks for the step when it knows the person", () => {
    const reply = ask({ age: 40, sex: "M" });
    expect(reply).toContain("ต้องการระดับไหนครับ");
    expect(reply).toContain("มรดก 3 ล้าน");
  });
});

describe("which turns belong to the bundle", () => {
  const carried: Routed = { intent: "other", bundleCode: "LEGACY_FAMILY", tier: 2, age: 40, sex: "M" };

  it("naming it is enough", () => {
    expect(isBundleTurn({ intent: "plan_info", bundleCode: "LEGACY_FAMILY" }, carried)).toBe(true);
  });

  it("asking for a price while it is the topic is enough", () => {
    expect(isBundleTurn({ intent: "quote", age: 35, sumAssured: 1_000_000 }, { ...carried, intent: "quote" })).toBe(true);
  });

  it("a greeting in the middle of that conversation is not", () => {
    expect(isBundleTurn({ intent: "other" }, carried)).toBe(false);
  });

  it("a question for the documents is not, even when named", () => {
    expect(isBundleTurn({ intent: "doc_qa", bundleCode: "LEGACY_FAMILY" }, { ...carried, intent: "doc_qa" })).toBe(false);
  });
});

describe("asking about the bundle rather than for a price", () => {
  it("describes it even when the person is already known", () => {
    const reply = answerBundle({ intent: "plan_info", bundleCode: "LEGACY_FAMILY", tier: 2, age: 40, sex: "M" }).reply;
    expect(reply.startsWith("ชุดมรดกเพื่อครอบครัว\n")).toBe(true);
    expect(reply).toContain("รับอายุ 20-65 ปี");
    expect(reply).toContain("มรดก 10 ล้าน");
    expect(reply).not.toContain("รายปี");
  });
});

describe("the bundle answer's card", () => {
  it("carries a card once it has priced the arrangement", () => {
    const answer = answerBundle({
      intent: "quote", bundleCode: "LEGACY_FAMILY", tier: 1, age: 40, sex: "M",
    });
    expect(answer.priced).toBe(true);
    expect(answer.card).toBe("/api/card?bundle=LEGACY_FAMILY&tier=1&age=40&sex=M");
  });

  it("passes on the instalment the customer asked in", () => {
    const answer = answerBundle({
      intent: "quote", bundleCode: "LEGACY_FAMILY", tier: 1, age: 40, sex: "M", mode: "monthly",
    });
    expect(answer.card).toBe("/api/card?bundle=LEGACY_FAMILY&tier=1&age=40&sex=M&mode=monthly");
  });

  /** While the chat is still collecting the insured there is nothing to draw. */
  it("sends no card while it is still asking who the customer is", () => {
    expect(answerBundle({ intent: "quote", bundleCode: "LEGACY_FAMILY", tier: 1 }).card).toBeUndefined();
    expect(answerBundle({ intent: "quote", bundleCode: "LEGACY_FAMILY", age: 40, sex: "M" }).card)
      .toBeUndefined();
  });

  it("sends no card for an age the bundle cannot be issued at", () => {
    expect(answerBundle({
      intent: "quote", bundleCode: "LEGACY_FAMILY", tier: 1, age: 70, sex: "M",
    }).card).toBeUndefined();
  });

  /**
   * MIN_MONTHLY is not the refusal the card and the reply withhold on: the arrangement is
   * still sellable, only this instalment falls under the minimum. Same case as
   * tests/golden/legacy-family.test.ts's "flags the 1,000 baht monthly minimum" fixture.
   */
  it("still prices and cards a bundle whose only warning is the monthly minimum", () => {
    const answer = answerBundle({
      intent: "quote", bundleCode: "LEGACY_FAMILY", tier: 5, age: 20, sex: "F", mode: "monthly",
    });
    expect(answer.priced).toBe(true);
    expect(answer.card).toBe("/api/card?bundle=LEGACY_FAMILY&tier=5&age=20&sex=F&mode=monthly");
  });

  /**
   * A bundle that cannot be issued whole (BUNDLE_INCOMPLETE) is supposed to withhold both the
   * card and the priced reply above, per the guard added to answerBundle. There is no honest
   * way to reach that state through answerBundle with today's LEGACY_FAMILY data: bundleAgeRange()
   * narrows to exactly DCI's own age window (20-65), so any age that clears the age check above
   * also clears DCI's own eligibility, and every tier's DCI sum assured (850,000-9,850,000) sits
   * inside DCI's own saMin/saMaxCap. The guard is exercised indirectly above (it must not fire on
   * MIN_MONTHLY) and otherwise verified by inspection: it is the exact rule bundleCard() already
   * uses and is tested against in src/lib/quote-card.ts.
   */
});
