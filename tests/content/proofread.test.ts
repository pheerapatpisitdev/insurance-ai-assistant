import { describe, expect, it } from "vitest";
import { parseProof } from "@/lib/content/proofread";

describe("parseProof", () => {
  const post = "ประกันนี้คุ้มคลองถึงอายุ 99 ปี\nสังเกตุว่าเบี้ยเท่าเดิม";

  it("keeps each suggestion whose text is really in the post", () => {
    const reply = JSON.stringify({ fixes: [
      { find: "คุ้มคลอง", replace: "คุ้มครอง", why: "สะกดผิด" },
      { find: "สังเกตุ", replace: "สังเกต", why: "สะกดผิด" },
    ] });
    expect(parseProof(reply, post)).toEqual([
      { find: "คุ้มคลอง", replace: "คุ้มครอง", why: "สะกดผิด" },
      { find: "สังเกตุ", replace: "สังเกต", why: "สะกดผิด" },
    ]);
  });

  it("drops a suggestion that points at nothing, or changes nothing", () => {
    // a proofreader that quotes text the post does not contain cannot be clicked into place
    const reply = JSON.stringify({ fixes: [
      { find: "ไม่มีในโพสต์", replace: "x", why: "" },
      { find: "ประกันนี้", replace: "ประกันนี้", why: "" },
      { find: "", replace: "x", why: "" },
    ] });
    expect(parseProof(reply, post)).toEqual([]);
  });

  it("reads an unreadable reply as no suggestions rather than an error", () => {
    expect(parseProof("ขอโทษครับ", post)).toEqual([]);
  });
});
