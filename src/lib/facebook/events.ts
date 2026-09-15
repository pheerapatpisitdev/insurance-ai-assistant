/**
 * What a webhook event says, whichever shape Meta sent it in. A typed message carries text;
 * a tap on an ice breaker or a button arrives as a postback carrying the question that was
 * tapped — to the bot they are the same thing: words from the customer.
 */

/**
 * What Meta says about the advertisement a customer arrived through.
 *
 * `ads_context_data` and the rest of the object are deliberately left untyped: nothing here
 * needs the ad's title or its video, and a shape Meta extends should not break a build.
 */
export interface FacebookReferral {
  source?: string;
  type?: string;
  ref?: string;
  ad_id?: string;
}

export interface Messaging {
  sender?: { id?: string };
  recipient?: { id?: string };
  timestamp?: number;
  message?: { mid?: string; text?: string; is_echo?: boolean; app_id?: number | string; referral?: FacebookReferral };
  postback?: { title?: string; payload?: string; referral?: FacebookReferral };
  referral?: FacebookReferral;
}

/** What a referral is worth keeping: which advertisement, and whatever the link called itself. */
export interface Referral {
  source?: string;
  ad_id?: string;
  ref?: string;
}

const MAX_CHARS = 1000;

/** The customer's words, or empty when the event carries none (an image, an echo, a read receipt). */
export function textOf(event: Messaging): string {
  if (event.message?.is_echo) return "";
  const raw = event.message?.text ?? event.postback?.title ?? event.postback?.payload ?? "";
  return raw.trim().slice(0, MAX_CHARS);
}

/**
 * What makes a redelivery recognisable. A message has its own id; a postback has none, so
 * the sender and the moment stand in for it.
 */
export function eventKey(event: Messaging): string | undefined {
  if (event.message?.mid) return event.message.mid;
  if (event.postback && event.sender?.id && event.timestamp) return `pb:${event.sender.id}:${event.timestamp}`;
  return undefined;
}

/**
 * Whether this event is the agent answering by hand.
 *
 * Meta echoes every message the Page sends, the bot's included, and the only thing telling
 * them apart is the app id it carries: ours when the Send API sent it, absent when a person
 * typed it into the Page's inbox. An echo we cannot attribute is treated as the agent's,
 * because a bot that talks over its own agent is worse than one that waits a day.
 */
/**
 * The customer this event is about.
 *
 * On an ordinary message the sender is the customer. On an echo of the page's own message it
 * is the page, and the customer is the recipient — which cost a day of the mute working at
 * all: every echo hashed to the page's own id, so one phantom session was muted over and
 * over while the threads an agent had actually answered were left wide open to the bot.
 */
export function customerOf(event: Messaging): string | undefined {
  return event.message?.is_echo ? event.recipient?.id : event.sender?.id;
}

export function agentTyped(event: Messaging): boolean {
  if (!event.message?.is_echo) return false;
  const ours = process.env.FB_APP_ID;
  return !ours || String(event.message.app_id ?? "") !== ours;
}

/**
 * Which advertisement brought this customer, from whichever of the three places Meta put it.
 *
 * A thread opened from an ad with no button arrives as a referral of its own; one with a Get
 * Started button carries it on the postback; and the first message of a new thread carries a
 * copy too — but only for a page subscribed to `messaging_referrals` as well as `messages`,
 * which is why that field is asked for even though nothing reads the event it delivers.
 */
export function referralOf(event: Messaging): Referral | undefined {
  const r = event.referral ?? event.postback?.referral ?? event.message?.referral;
  if (!r) return undefined;
  return { source: r.source, ad_id: r.ad_id, ref: r.ref };
}
