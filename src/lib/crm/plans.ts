import { SALES_PAGES } from "@/lib/shell/menu";
import { UNDECIDED } from "./types";

/**
 * The name a plan goes by on the report, read from the one list of plans the system keeps.
 *
 * The report had three private lists of its own — two plans each, and not the same two — so a
 * customer the bot had talked to about iShield or มรดกเพื่อครอบครัว was filed under
 * "ยังไม่เลือก", which is the one thing that customer certainly had done. The menu's list of
 * sales pages is the registry every other screen already names plans from, so the report
 * names them from it too, and a plan added to the menu is named here without anyone
 * remembering this file.
 *
 * A conversation records the plan by the key its brain answers to, which is usually the
 * page's own address. The exceptions are spelled out below rather than guessed at.
 */
const PAGE_FOR_KEY: Record<string, string> = {
  ihealthy: "/ihealthy-ultra",
  easyprotect6: "/easyprotect",
  pension: "/bumnan95",
};

/**
 * What to call a plan key on the owner's screen.
 *
 * A key nobody has named is shown as itself. It used to fall back to "ยังไม่เลือก", which
 * states something false about the customer; a strange word at least says there is something
 * here the list does not know yet.
 */
/** a would-be agent from a หาทีม post, filed by the chat as this product (src/lib/assistant/recruit.ts) */
export const RECRUIT_PRODUCT = "recruit";

export function planName(key: string | null | undefined): string {
  if (!key || key === UNDECIDED) return "ยังไม่เลือกแผน";
  if (key === RECRUIT_PRODUCT) return "หาทีม";
  const href = PAGE_FOR_KEY[key] ?? `/${key}`;
  return SALES_PAGES.find((p) => p.href === href)?.label ?? key;
}

/**
 * What the customer was after, in the owner's words.
 *
 * The router's three answers (see src/lib/assistant/lifeprotect/route.ts). Nothing else in the
 * system translates them, because nothing else shows them to a person.
 */
const INTENT_NAMES: Record<string, string> = {
  quote: "ถามเบี้ย",
  plan_info: "ถามรายละเอียดแผน",
  other: "คำถามทั่วไป",
};

export function intentName(key: string | null | undefined): string {
  if (!key) return "ไม่ระบุ";
  return INTENT_NAMES[key] ?? key;
}
