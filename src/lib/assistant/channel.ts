import { siteUrl } from "@/lib/site-url";

/**
 * Where the customer is standing when they ask.
 *
 * The answer is the same answer — the same rules, the same premium, the same card — but it is
 * not written the same way twice. The website renders markdown and can follow a path of its
 * own; a page's inbox renders nothing and has no idea what "/other-plans" would mean. Sharing
 * the wording between the two without saying which is which is how a customer who arrived
 * through an advertisement came to be shown "**iSmart 80/6**" and a link they could not press.
 */
export type Channel = "web" | "facebook";

/** `[คำ](/path)` and `**คำ**`, the two pieces of markdown this system actually writes. */
const LINK = /\[([^\]]+)\]\((\/[^)]*)\)/g;
const BOLD = /\*\*([^*]+)\*\*/g;

/**
 * One answer, written for an inbox that shows text and nothing else.
 *
 * A relative path becomes the whole address, because a customer reading it in Messenger has
 * no page to resolve it against — and it is given after the words rather than instead of
 * them, so the sentence still reads if the link is never pressed.
 */
export function forMessenger(text: string): string {
  return text
    .replace(LINK, (_, label: string, path: string) => `${label} ${siteUrl(path)}`)
    .replace(BOLD, "$1")
    .replace(/^\s*-\s+/gm, "• ");
}

/** The same answer, written for whichever side asked for it. */
export function writtenFor(channel: Channel, text: string): string {
  return channel === "facebook" ? forMessenger(text) : text;
}

/**
 * What a model is told about where its words will land.
 *
 * Only for the inbox: on the website the markdown is rendered, and telling a model not to use
 * it there would make the answers plainer for no reason.
 */
export function formattingRule(channel: Channel): string {
  return channel === "facebook"
    ? "\n\nช่องทางนี้เป็นกล่องข้อความของเพจ ซึ่งแสดงข้อความล้วน:"
      + " ห้ามใช้มาร์กดาวน์ (ห้ามใช้ ** หรือ [ข้อความ](ลิงก์))"
      + " ถ้าจะอ้างถึงหน้าเว็บ ให้เขียนที่อยู่เต็มเท่านั้น"
      + ` เช่น ${siteUrl("/other-plans")}`
    : "";
}
