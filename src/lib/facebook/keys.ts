/**
 * Which row of the channel table belongs to which Page.
 *
 * There was one row, under "facebook", and everything that wanted a token asked for it.
 * Connecting a second Page would have written over the first in silence — the agency's live
 * inbox replaced by whichever Page was picked next, with nothing on screen to say so.
 *
 * Kept in its own file because both the connection module and the migration that renames the
 * existing row have to agree about the shape of a key, and a second copy of that shape is how
 * rows get orphaned.
 */

/** The row written before Pages were told apart. It is live today and is still read. */
export const LEGACY_KEY = "facebook";

/** A login in progress: the user token, held only until a Page is chosen. */
export const PENDING_KEY = "facebook_pending";

const PREFIX = "facebook:";

/** Where a Page's token is kept. */
export function keyFor(pageId: string): string {
  return `${PREFIX}${pageId}`;
}

/**
 * The Page a key belongs to, or nothing for a key that names no Page.
 *
 * Both of those exist and neither is an error: the legacy row names no Page in its key (its
 * page_id is in a column), and the pending row is half a login rather than a connection.
 */
export function pageIdInKey(key: string): string | undefined {
  return key.startsWith(PREFIX) ? key.slice(PREFIX.length) || undefined : undefined;
}
