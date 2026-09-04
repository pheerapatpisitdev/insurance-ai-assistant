/**
 * What a webhook event says, whichever shape Meta sent it in. A typed message carries text;
 * a tap on an ice breaker or a button arrives as a postback carrying the question that was
 * tapped — to the bot they are the same thing: words from the customer.
 */

export interface Messaging {
  sender?: { id?: string };
  timestamp?: number;
  message?: { mid?: string; text?: string; is_echo?: boolean };
  postback?: { title?: string; payload?: string };
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
