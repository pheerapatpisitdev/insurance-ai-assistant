/**
 * Where this app answers, as an absolute address.
 *
 * LINE fetches an image by URL from its own servers, so a path is not enough and the
 * request's host is not always the public one. The deployment already declares its
 * address for the links inside alerts; the card uses the same setting rather than a second
 * one that could drift from it.
 */
export function siteOrigin(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.advisortool.app";
}

/** An absolute URL for something this app serves, from a path the assistant produced. */
export function siteUrl(path: string): string {
  return new URL(path, siteOrigin()).toString();
}
