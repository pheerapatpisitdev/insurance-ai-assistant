import { quote } from "@/calc/quote";
import { quoteModePremiums } from "@/calc/mode-premiums";
import { getPlan } from "@/calc/plans/registry";
import { cardPath, valueTablePath } from "@/lib/card-link";
import { coverIn, peopleIn } from "@/lib/assistant/common";

/**
 * Premiums for the plans the Messenger brains never learned.
 *
 * The brains speak for two products and cost nine hundred lines each, because each one holds
 * a whole conversation: its own FAQ, its own prompts, its own way of reading a message. The
 * other four plans do not need any of that here. What they need is the one path from a
 * question to a figure, and every piece of that path is already plan-agnostic — `quote()`
 * prices any plan in the registry, `/api/card` draws any of them, and the rules are already
 * in the knowledge.
 *
 * So this is the wiring and nothing more. Where a plan differs, it is asked about rather than
 * assumed: only Life Protect has a default package in the registry, and the difference
 * between paying for five years and paying for twenty is most of the premium.
 */

const money = (satang: number) => Math.round(satang / 100).toLocaleString("en-US");

/** The plans this can price, by the names a person writes. Life Protect is not here — it has a brain. */
const PLANS: [code: string, label: string, re: RegExp][] = [
  ["PLB", "Protection Life (PLB)", /protection\s*life|\bplb\b|โพรเทคชั่น\s*ไลฟ์/i],
  ["ISMART", "iSmart 80/6", /i\s*-?\s*smart|ไอสมาร์ท|ไอ\s*สมาร์ท/i],
  ["LIFETREASURE", "Life Treasure", /life\s*treasure|ไลฟ์\s*เทรเชอร์|ไลฟ์เทรเชอร์/i],
  ["ISHIELD", "iShield", /i\s*-?\s*shield|ไอชิลด์|ไอ\s*ชิลด์/i],
];

export function planNamedIn(text: string): { code: string; label: string } | undefined {
  const hit = PLANS.find(([, , re]) => re.test(text));
  return hit ? { code: hit[0], label: hit[1] } : undefined;
}

export interface PriceReply {
  text: string;
  cards?: string[];
  /** true when a figure was produced, so the page can say it came from the engine */
  priced: boolean;
}

/**
 * The years a package is paid for, read off the label rather than the code.
 *
 * The code was the obvious place and it is wrong in two families out of four: iSmart's
 * W80F06 opens with the age it covers to, and Life Treasure's H99F12A with ninety-nine — so
 * the first two digits are 80 and 99, not six and twelve. The labels are the company's own
 * words and every one of them says ชำระเบี้ย N ปี.
 */
function yearsOf(label: string | undefined): number | undefined {
  const m = label?.match(/ชำระเบี้ย\s*(\d{1,2})\s*ปี/);
  return m ? Number(m[1]) : undefined;
}

/** Which package the message asked for, when it named a paying term. */
function variantAskedFor(
  text: string, variants: string[], labels: Record<string, string>,
): string | undefined {
  const asked = text.match(/(?:จ่าย|ชำระ|ผ่อน)\s*(?:เบี้ย)?\s*(\d{1,2})\s*ปี/);
  if (!asked) return undefined;
  const years = Number(asked[1]);
  return variants.find((v) => yearsOf(labels[v]) === years);
}

/**
 * Price one plan from one message, or say exactly what is missing.
 *
 * Nothing is guessed. A premium quoted from an assumed paying term is a premium for a
 * contract nobody asked about, and it would arrive looking like every correct one.
 */
export function priceNamedPlan(text: string, code: string, label: string): PriceReply {
  const plan = getPlan(code);
  if (!plan) return { text: `ไม่พบข้อมูลแบบ ${label} ในระบบครับ`, priced: false };

  /**
   * iShield is not priced here on purpose.
   *
   * Its rules carry `premiumBasis`: the figure a person gives it is the premium they want to
   * pay, and the sum assured is what comes back. Every other plan on this page works the
   * other way round, and a page that reads "1 ล้าน" as a sum for three plans and a premium
   * for the fourth is a page that will be misread — by a customer and eventually by whoever
   * maintains it.
   */
  if (plan.rules.base.premiumBasis) {
    return {
      priced: false,
      text: `แบบ **${label}** คิดเบี้ยแบบกรอกทุนไม่ได้ครับ — แบบนี้ทำกลับกัน คือ**กรอกเบี้ยที่อยากจ่าย แล้วระบบบอกว่าได้ทุนเท่าไหร่**\n\n`
        + `ใช้ที่ [หน้าแบบประกันอื่นๆ](/other-plans) จะเห็นช่องกรอกที่ถูกต้องครับ\n\n`
        + `ส่วนเงื่อนไขของ ${label} เช่น ช่วงอายุหรือสัญญาเพิ่มเติม ถามผมได้เลย`,
    };
  }

  const people = peopleIn(text);
  const sum = coverIn(text);
  const variants = plan.rates.base.variants ?? [];
  const variant = variants.length === 1
    ? variants[0]
    : variantAskedFor(text, variants, plan.variantLabels);

  const missing: string[] = [];
  if (people.length === 0) missing.push("อายุกับเพศ (เช่น “ชาย 35”)");
  if (sum === undefined) missing.push("ทุนประกัน (เช่น “ทุน 1 ล้าน”)");
  if (!variant && variants.length > 1) {
    const choices = variants.map((v) => plan.variantLabels[v] ?? v).join(" · ");
    missing.push(`ระยะเวลาชำระเบี้ย — ${label} มีให้เลือก: ${choices}`);
  }
  if (missing.length) {
    return {
      priced: false,
      text: `คิดเบี้ย **${label}** ให้ได้ครับ ขอเพิ่มอีกนิด:\n\n${missing.map((m) => `- ${m}`).join("\n")}`,
    };
  }

  const who = people[0];
  const input = {
    planCode: code, variant: variant!, age: who.age, sex: who.sex,
    mode: "annual" as const, sumAssured: sum!, riders: [],
  };

  let result;
  try {
    result = quote(input);
  } catch (e) {
    console.error("คิดเบี้ยไม่สำเร็จ:", e);
    return { text: `คิดเบี้ย ${label} ไม่สำเร็จครับ ลองที่ [หน้าแบบประกันอื่นๆ](/other-plans) ดูนะครับ`, priced: false };
  }

  /**
   * A refusal from the engine is the answer, not an error to paper over. It is the same
   * sentence the calculator shows, and it is usually the one thing the asker needed to hear.
   */
  const blocking = result.warnings.filter((w) => w.level === "error");
  if (blocking.length || result.totalAnnual <= 0) {
    return {
      priced: false,
      text: `แบบ **${label}** ยังคิดให้ไม่ได้ด้วยเงื่อนไขนี้ครับ\n\n`
        + (blocking.length ? blocking.map((w) => `- ${w.message}`).join("\n") : "- อยู่นอกช่วงที่แบบนี้รับประกัน")
        + `\n\nลองปรับอายุหรือทุนดู หรือดูที่ [หน้าแบบประกันอื่นๆ](/other-plans)`,
    };
  }

  const modes = quoteModePremiums(input) ?? [];
  const per = (m: string) => modes.find((x) => x.mode === m);
  const termLabel = plan.variantLabels[variant!] ?? variant!;
  const sexWord = who.sex === "F" ? "หญิง" : "ชาย";

  const lines = [
    `**${label}** · ${termLabel}`,
    `${sexWord} อายุ ${who.age} ปี · ทุน ${result.sumAssured.toLocaleString("en-US")} บาท`,
    "",
    `💰 เบี้ยปีละ **${money(result.totalAnnual)} บาท**`,
  ];
  const half = per("semi");
  const monthly = per("monthly");
  if (half) lines.push(`ราย 6 เดือน ${money(half.total)} บาท`);
  if (monthly) {
    lines.push(`รายเดือน ${money(monthly.total)} บาท${monthly.belowMinimum ? " (ต่ำกว่าขั้นต่ำของแบบนี้)" : ""}`);
  }
  if (result.deathBenefit) lines.push("", "👪 ความคุ้มครองชีวิตเป็นไปตามตารางผลประโยชน์ของแบบนี้");
  if (result.meta.expired) {
    lines.push("", `⚠️ ตารางเบี้ยชุดนี้ (${result.meta.version}) หมดอายุ ${result.meta.expiresOn} แล้ว — ขอราคาปัจจุบันจากบริษัทก่อนใช้`);
  } else {
    lines.push("", `เบี้ยมาตรฐาน ตารางเวอร์ชัน ${result.meta.version} · อาจต่างไปตามผลพิจารณารับประกัน`);
  }

  const who2 = { age: who.age, sex: who.sex, sumAssured: result.sumAssured };
  return {
    priced: true,
    text: lines.join("\n"),
    cards: [
      cardPath({ kind: "plan", planCode: code, variant: variant!, ...who2 }),
      valueTablePath({ kind: "plan", planCode: code, variant: variant!, ...who2 }),
    ],
  };
}
