import { readFile } from "node:fs/promises";
import path from "node:path";

/**
 * Who drew this card, on the card itself.
 *
 * These pictures travel further than anything else here. An agent sends one into a customer's
 * LINE, the customer forwards it to whoever else in the house has to agree, and it sits in
 * that third person's chat for months. Until now nothing on them said where they came from:
 * no mark, no address, no way for the person holding one to find their way back.
 *
 * The mark keeps its own dark ground rather than being keyed out. The six themes run from
 * black-and-gold to warm cream, and a rendered metal object has soft edges — cut out of its
 * background it would carry a dark fringe that looks like a mistake on the pale ones. A small
 * dark tile reads as a badge on all six, which is what it is.
 *
 * Read once per process, not once per request: an ImageResponse is rendered on every card and
 * this file does not change between them.
 */

const MARK = path.join(process.cwd(), "src/app/api/card/mark.png");

let cached: Promise<string> | undefined;

/** The mark as a data URI, which is the only form `ImageResponse` will take for a local file. */
export function markDataUri(): Promise<string> {
  cached ??= readFile(MARK).then((b) => `data:image/png;base64,${b.toString("base64")}`);
  return cached;
}

/** What is written beside it. Short, because it has to be legible at a phone's width. */
export const SIGNATURE_TEXT = "advisortool.app";

/** The height the signature row occupies, for the card-height arithmetic that precedes it. */
export const SIGNATURE_HEIGHT = 46;
