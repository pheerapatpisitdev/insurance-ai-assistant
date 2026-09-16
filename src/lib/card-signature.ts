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
 * The mark sits on whatever is behind it. It was drawn on a dark tile at first, because the
 * artwork then supplied had no alpha at all and its ground was the same #26272A as the dark
 * blocks on the letter itself — a colour key put holes through the N, a border flood ate the
 * two diagonal bands, and a close brought them back with debris stuck to the sides. The owner
 * supplied a version with real transparency, so the tile is gone and nothing is interposed
 * between the mark and the card it is printed on.
 *
 * Its height is what is fixed, not a square box: the mark is half again as tall as it is
 * wide, and a square sets it in a column of air.
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
