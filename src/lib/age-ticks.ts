/**
 * The ages written under a drawing of a contract.
 *
 * Every tenth birthday, plus the two ages the reader is actually looking for: the age quoted
 * and the age the contract ends. A decade that lands too near either of those is dropped
 * rather than printed on top of it — the test is the distance on the drawing, not the years
 * between them, because how many units a year is worth depends on how long the contract runs.
 *
 * Kept apart from quote-card.ts so the sales pages' own chart, which runs in the browser, can
 * share it without shipping the rate tables the card reaches.
 */
export function ageTicks(from: number, to: number, x: (at: number) => number, gap: number): number[] {
  const kept = [from];
  for (let a = Math.ceil(from / 10) * 10; a < to; a += 10) {
    if (x(a) - x(kept[kept.length - 1]) < gap) continue;
    if (x(to) - x(a) < gap) continue;
    kept.push(a);
  }
  if (to > from) kept.push(to);
  return kept;
}
