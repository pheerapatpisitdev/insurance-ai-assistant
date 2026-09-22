import type { IHealthyFacts } from "@/lib/ihealthy-facts";
import type { Lang } from "@/lib/ihealthy-lang";
import dci from "../../data/riders/dci-diseases.json";
import translations from "../../data/riders/ihealthy-ultra.i18n.json";

/**
 * The company's own wording, read into another language.
 *
 * The benefit sheet stays exactly what the workbook says — the extract never learns there are
 * other languages. This file is the other half: every Thai line the page prints from the sheet,
 * keyed by the Thai itself, with its English, Chinese and Russian beside it. Keying by the
 * Thai is what makes a re-issued contract safe: a sentence the company rewrites has no entry
 * any more, the test over this file fails, and nobody ships last year's wording in English
 * under this year's in Thai.
 *
 * Server-only by use, not by marker: only the page imports it, and it hands the browser rows
 * already in one language. Three languages of contract prose are not something to make a
 * phone download to read one.
 */

type Entry = Record<Exclude<Lang, "th">, string>;
const TABLE = translations as Record<string, Entry>;

const THAI = /[฀-๿]/;

/** One line in `lang`, or the Thai where there is no reading of it — which a test forbids. */
export function translateLine(thai: string, lang: Lang): string {
  if (lang === "th" || !THAI.test(thai)) return thai;
  return TABLE[thai]?.[lang] ?? thai;
}

/** Every string inside, read; every number and every key left alone. */
function translateDeep<T>(value: T, lang: Lang): T {
  if (typeof value === "string") return translateLine(value, lang) as T;
  if (Array.isArray(value)) return value.map((v) => translateDeep(v, lang)) as T;
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, translateDeep(v, lang)]),
    ) as T;
  }
  return value;
}

/**
 * The benefit sheet in `lang`: the same shape, the same numbers, the same plan codes, with the
 * words read. Thai is handed back untouched, so the Thai page is the page it always was.
 */
export function translateFacts(facts: IHealthyFacts, lang: Lang): IHealthyFacts {
  return lang === "th" ? facts : translateDeep(facts, lang);
}

/** The thirty-one illnesses the DCI rider names, in `lang`. */
export function dciDiseases(lang: Lang): string[] {
  return dci.diseases.map((d) => translateLine(d, lang));
}
