import { contentProduct, type ContentProduct, type Figures } from "./products";
import { lifelong } from "./wording";

/**
 * Everything the model is allowed to know about one product, as one block of Thai.
 *
 * It is also the yardstick for the first check: a number in the finished post that is not
 * somewhere in this text was not handed to the model, and gets flagged.
 */
export interface Brief {
  product: ContentProduct;
  text: string;
  expired: boolean;
  rateVersion: string | null;
}

const NO_PRICES = "- **ตอนนี้ห้ามระบุเบี้ยหรือราคาใดๆ** ตารางเบี้ยกำลังปรับปรุง ให้เขียนโดยไม่ใส่ราคาและชวนทักมาถามแทน";

/**
 * The figures, or none of them when an engine cannot produce them.
 *
 * pensionFacts() throws when its example stops pricing rather than returning an expired flag;
 * treated the same way here, so a broken table costs the post its prices and not the page.
 */
function figuresOf(product: ContentProduct, today: Date): Figures {
  try {
    return product.figures(today);
  } catch (e) {
    console.error(`content figures for ${product.href} failed:`, e);
    return { expired: true, rateVersion: null, facts: [], prices: [] };
  }
}

export function briefFor(href: string, today: Date = new Date()): Brief | null {
  const product = contentProduct(href);
  if (!product) return null;
  const fig = figuresOf(product, today);

  // ตลอดชีพ, never "ถึงอายุ 99": the owner's word for these plans in content (wording.ts)
  const text = lifelong([
    `## ${product.name}`,
    `ประเภท: ${product.kind}`,
    `เหมาะกับ: ${product.audience}`,
    "",
    "### จุดขาย (จากหน้าขายของแบบนี้)",
    ...product.points.map((p) => `- ${p}`),
    "",
    "### ข้อเท็จจริงและตัวเลข (คัดลอกได้ตรงตัวเท่านั้น)",
    ...fig.facts,
    ...(fig.expired ? [NO_PRICES] : fig.prices),
    "",
    "### ข้อควรระวัง (ห้ามเขียนขัดกับข้อนี้)",
    ...product.cautions.map((c) => `- ${c}`),
  ].join("\n"));

  return { product, text, expired: fig.expired, rateVersion: fig.rateVersion };
}
