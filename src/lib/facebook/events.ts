/**
 * What a webhook event says, whichever shape Meta sent it in. A typed message carries text;
 * a tap on an ice breaker or a button arrives as a postback carrying the question that was
 * tapped — to the bot they are the same thing: words from the customer.
 */

/**
 * Where a thread was opened from, as Meta reports it: an advert (`source: "ADS"` with the
 * ad's id), an m.me link, a Messenger code. The `ref` is whatever we put on the advert or
 * the link ourselves, when we did.
 */
export interface Referral {
  ref?: string;
  source?: string;
  type?: string;
  ad_id?: string | number;
  ads_context_data?: { ad_title?: string; photo_url?: string; video_url?: string; post_id?: string; product_id?: string };
}

export interface Messaging {
  sender?: { id?: string };
  recipient?: { id?: string };
  timestamp?: number;
  message?: { mid?: string; text?: string; is_echo?: boolean; app_id?: number | string; referral?: Referral };
  postback?: { title?: string; payload?: string; referral?: Referral };
  /** a messaging_referrals event: a thread that already existed, opened again from an advert or a link, with no words in it */
  referral?: Referral;
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

/** The Page an event happened on: the recipient of a customer's message, the sender of the Page's own echo. */
export function pageOf(event: Messaging): string | undefined {
  return event.message?.is_echo ? event.sender?.id : event.recipient?.id;
}

/** Where a conversation came from, read off an event. */
export interface Attribution {
  /** Meta's source, lowercased: "ads", "shortlink", "messenger_code", … */
  source: string;
  adId?: string;
  ref?: string;
  /** the object as Meta sent it, kept whole because the fields above are not all it ever carries */
  raw: Referral;
}

/**
 * The referral on an event, from whichever of the three places Meta puts it: on the first
 * message from someone with no thread yet, on the Get Started postback, or as an event of
 * its own when the thread already existed. Undefined when the event names no source, which
 * is every ordinary message.
 *
 * Read here because it is the one thing that ties a conversation to the advert that paid
 * for it. It was thrown away for the campaign's first ten days, so nothing could say which
 * advert had produced a quotation and which had produced only a greeting.
 */
export function referralOf(event: Messaging): Attribution | undefined {
  const raw = event.referral ?? event.message?.referral ?? event.postback?.referral;
  if (!raw) return undefined;
  const adId = raw.ad_id === undefined || raw.ad_id === null || raw.ad_id === "" ? undefined : String(raw.ad_id);
  return { source: (raw.source ?? "unknown").toLowerCase(), adId, ref: raw.ref || undefined, raw };
}
