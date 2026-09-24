import { siteOrigin, siteUrl } from "@/lib/site-url";
import { APPLICATION_FORM, FORM_NEXT } from "./common";

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

/**
 * The ways the inbox says a person will come, and what the website says instead.
 *
 * The inbox is read by the agency: "เดี๋ยวมีคนมาตอบในแชทนี้" is a promise somebody keeps. The
 * website's chat is read by nobody — it is not saved anywhere a person looks — so the same
 * sentence there is a promise nobody keeps, made to a customer who then waits. The one way a
 * visitor to the website reaches a person is the form, so that is what they are handed.
 *
 * Phrases rather than whole messages, because a model writes some of them (the health brain
 * is told to say an agent will answer "ในแชทนี้") and will not use the same words twice.
 */
const FORM_LINK = `[ฟอร์มนี้](${APPLICATION_FORM})`;
const PERSON_IN_THIS_CHAT: [RegExp, string][] = [
  [new RegExp(escaped(FORM_NEXT), "g"),
    "กรอกเสร็จแล้ว ตัวแทนจะติดต่อกลับตามข้อมูลในฟอร์ม เพื่อดูแลขั้นตอนต่อให้ครับ"],
  [/แจ้งจำนวนพนักงานกับลักษณะธุรกิจไว้ในแชทนี้ได้เลย เดี๋ยวติดต่อกลับไปครับ/g,
    `ถ้าอยากให้ตัวแทนติดต่อกลับ กรอก${FORM_LINK}ไว้ได้เลยครับ`],
  [/ติดต่อกลับในแชทนี้/g, "ติดต่อกลับตามข้อมูลที่กรอกไว้"],
  [/(?:เดี๋ยว)?(?:ตัวแทน|มีคน)(?:จะ)?มา(?:ตอบ|คุยต่อ)(?:ให้)?ในแชทนี้/g,
    `กรอก${FORM_LINK}ไว้ ตัวแทนจะติดต่อกลับ`],
];

function escaped(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * One answer, written for the website's chat.
 *
 * Besides the promises above, the two addresses the inbox sends on a line of their own become
 * something to press: the form, named for what it is, and a page of this site, as a path so
 * it opens in the same tab. The page draws the rest of a bare address as a link itself.
 */
export function forTheWebsite(text: string): string {
  const own = new RegExp(`^${escaped(siteOrigin())}(/\\S*)$`, "gm");
  let out = text
    .replace(new RegExp(`^${escaped(APPLICATION_FORM)}$`, "gm"), `[📝 เปิดฟอร์มสมัคร](${APPLICATION_FORM})`)
    .replace(own, (_, path: string) => `[👉 เปิดหน้านี้](${path})`);
  for (const [said, instead] of PERSON_IN_THIS_CHAT) out = out.replace(said, instead);
  return out;
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
