/**
 * Words the owner wants said one way in every piece of content (owner, 2026-09-25).
 *
 * Cover to age 99 is said ตลอดชีพ: "ถึงอายุ 99" and "99 ปี" read as a date the cover ends,
 * and the owner sells these plans as for life. The sales pages keep their own wording; this
 * is for what the workbench writes — the briefs the models read, the ตัวเลขชัดๆ sheets the
 * engines write, and, as a net, whatever a model hands back.
 */

const LIFELONG: [RegExp, string][] = [
  // "คุ้มครองถึงอายุ 99", "จ่ายถึงอายุ 99 ปี", "ชำระเบี้ยถึงอายุ 99" — the verb stays
  [/(คุ้มครอง|จ่ายเบี้ย|ชำระเบี้ย|จ่าย|ชำระ)(?:ยาว)?\s*ถึง\s*อายุ\s*99(?:\s*ปี)?/g, "$1ตลอดชีพ"],
  [/ถึง\s*อายุ\s*99(?:\s*ปี)?/g, "ตลอดชีพ"],
  [/ถึง\s*99\s*ปี/g, "ตลอดชีพ"],
  [/(?<![\d,.])99\s*ปี/g, "ตลอดชีพ"],
];

export function lifelong(text: string): string {
  return LIFELONG.reduce((t, [re, to]) => t.replace(re, to), text);
}

/** A written piece with ตลอดชีพ in place of 99, in every line a reader sees, the poster's too. */
export function lifelongOutput<T extends { hooks: string[]; body: string; closing: string; poster?: { blocks: { kind: string; text: string }[] } }>(o: T): T {
  return {
    ...o,
    hooks: o.hooks.map(lifelong),
    body: lifelong(o.body),
    closing: lifelong(o.closing),
    ...(o.poster ? { poster: { ...o.poster, blocks: o.poster.blocks.map((b) => ({ ...b, text: lifelong(b.text) })) } } : {}),
  };
}
