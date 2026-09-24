/**
 * What the two budget boxes on /admin/ai are allowed to say, checked on the server.
 *
 * Kept apart from actions.ts because a "use server" file may export nothing but async
 * functions, and this wants to be a plain function a test can call with two strings.
 *
 * The rules, and why each one is here:
 *
 * An empty monthly box means no limit. Zero used to be accepted and then read two ways at
 * once: the page said "ยังไม่ได้ตั้งงบ", because 0 is falsy, while the AI client read it as a
 * ฿0 ceiling and stopped answering every customer. A box that can switch the bot off by
 * looking like it switches nothing on is not a box to leave that way, so 0 and anything
 * below it are refused, with the way to say "no limit" in the refusal itself.
 *
 * An empty content box means ฿30 — the default the content workbench falls back to — and
 * the "content must fit inside the month" check is made against that effective figure. It
 * used to be skipped whenever the box was empty, so a monthly budget of ฿20 sat happily
 * beside a content slice of ฿30 that nobody had typed. Zero is allowed here, because it has
 * one clear meaning: the workbench stops drawing.
 *
 * Numbers arrive as the strings the browser sent, not as numbers the browser made: Number()
 * on the client turns "abc" into NaN, and NaN passes `< 0` and `> x` alike, which is how a
 * nonsense value would have reached the database.
 */

/** Far above anything this business spends on AI in a month; a typo guard, not a policy. */
export const MAX_BUDGET_THB = 1_000_000;

export type BudgetCheck =
  | { ok: true; monthly: number | null; content: number | null }
  | { ok: false; error: string };

const baht = (n: number) => `฿${n.toLocaleString("th-TH", { maximumFractionDigits: 2 })}`;

/** "" → null; otherwise the number, or NaN for anything that is not one. Commas are forgiven. */
function parse(raw: string | null | undefined): number | null {
  const s = String(raw ?? "").replace(/[,\s฿]/g, "");
  if (s === "") return null;
  // Number("1e3") is 1000 and Number("0x10") is 16; neither is how anybody writes baht
  if (!/^-?\d+(\.\d+)?$/.test(s)) return NaN;
  return Number(s);
}

export function checkBudgets(monthlyRaw: string | null | undefined, contentRaw: string | null | undefined, contentDefault: number): BudgetCheck {
  const monthly = parse(monthlyRaw);
  const content = parse(contentRaw);

  if (monthly !== null) {
    if (!Number.isFinite(monthly)) return { ok: false, error: "งบต่อเดือนต้องเป็นตัวเลข — ถ้าไม่อยากจำกัดให้เว้นว่าง" };
    if (monthly <= 0) return { ok: false, error: "งบต้องมากกว่า 0 — ถ้าไม่อยากจำกัดให้เว้นว่าง" };
    if (monthly > MAX_BUDGET_THB) return { ok: false, error: `งบต่อเดือนสูงเกินไป ใส่ได้ไม่เกิน ${baht(MAX_BUDGET_THB)}` };
  }
  if (content !== null) {
    if (!Number.isFinite(content)) return { ok: false, error: `งบคอนเทนต์ต้องเป็นตัวเลข — เว้นว่างไว้ = ${baht(contentDefault)}` };
    if (content < 0) return { ok: false, error: "งบคอนเทนต์ติดลบไม่ได้ (ใส่ 0 = หยุดสร้างคอนเทนต์)" };
    if (content > MAX_BUDGET_THB) return { ok: false, error: `งบคอนเทนต์สูงเกินไป ใส่ได้ไม่เกิน ${baht(MAX_BUDGET_THB)}` };
  }

  const effectiveContent = content ?? contentDefault;
  if (monthly !== null && effectiveContent > monthly) {
    return {
      ok: false,
      error: content === null
        ? `งบคอนเทนต์ที่เว้นว่างไว้คือ ${baht(contentDefault)} ซึ่งเกินงบรวมต่อเดือน ${baht(monthly)} — ใส่งบคอนเทนต์ให้ไม่เกินงบรวม`
        : `งบคอนเทนต์ (${baht(content)}) ต้องไม่เกินงบรวมต่อเดือน (${baht(monthly)})`,
    };
  }

  const cents = (n: number | null) => (n === null ? null : Math.round(n * 100) / 100);
  return { ok: true, monthly: cents(monthly), content: cents(content) };
}
