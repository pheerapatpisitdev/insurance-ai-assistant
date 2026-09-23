import { getBundle } from "@/calc/bundles/registry";
import { bundleAgeRange, bundleModePremiums, quoteBundle } from "@/calc/bundles/quote";
import { MODES } from "@/calc/mode-premiums";
import { getPlan } from "@/calc/plans/registry";
import type { Sex } from "@/calc/types";
import ci123Diseases from "../../data/riders/ci123-diseases.json";

/**
 * Every price the CI 123 page can show, worked out on the server.
 *
 * The page sells one arrangement — CI 123 on the smallest Life Protect+ 100 the company
 * issues — over a closed domain of 76 ages, two sexes and seven sums, so the whole answer is
 * about a thousand rows and the engine never has to reach the browser. The same reasoning as
 * `legacy-table.ts`, which this follows line for line.
 *
 * The owner's older CI 123 page priced this from a table that had a different base contract
 * folded into every figure (ไลฟ์เรดดี้ 99 at 150,000), with no line saying so. Here the base
 * and the rider are quoted as the two contracts they are, from the same engine the agent's
 * own calculator uses.
 */
export const CI123_BUNDLE = "CI123_SET";

/** One stage of what CI 123 pays, in the order the company's leaflet draws them. */
export interface Ci123Stage {
  /** the rate table's own key for the component */
  key: string;
  label: string;
  /** who or what the stage is limited to, where it is */
  note?: string;
  /** how many conditions the policy names under it */
  count: number;
  /** the share of the CI 123 sum assured this stage pays */
  share: number;
  /** the most it pays, in baht, where the company caps it */
  cap: number | null;
  /** the stage that ends the contract and the one the percentages are measured against */
  major?: true;
}

export interface Ci123Group {
  title: string;
  diseases: string[];
}

export interface Ci123Table {
  bundleCode: string;
  ageMin: number;
  ageMax: number;
  /** [tier - 1] — the CI 123 sum assured each tier sells */
  sums: number[];
  /** the base contract's sum assured, the same in every tier */
  baseSum: number;
  /** true when the rate table behind these figures has lapsed; then no price may be shown */
  expired: boolean;
  /** e.g. "A2026-1", for the line that says where the figures come from */
  rateVersion: string;
  /** the smallest monthly instalment the company will accept, in baht */
  minMonthlyTotal: number;
  /**
   * [tier - 1][age - ageMin] = [annual, semi, monthly, monthlyUnderMinimum], in satang, for
   * the whole arrangement. Null where it cannot be priced.
   */
  premiums: Record<Sex, (readonly number[] | null)[][]>;
  /** [age - ageMin] = the base contract's annual premium alone, in satang, by sex */
  basePremiums: Record<Sex, (number | null)[]>;
  /** the six ways CI 123 pays, for the benefit table and the payout lines */
  stages: Ci123Stage[];
  /** every condition the policy names, grouped as the policy groups them */
  groups: Ci123Group[];
  /**
   * How many illnesses in all — the five disease stages, not the two critical-care events,
   * which are situations rather than illnesses. 122, as the company's leaflet counts them.
   */
  diseaseCount: number;
  /** the death benefit of the base contract: before the booster age, and from it */
  death: { beforeAge: number; sumBefore: number; sumFrom: number };
}

const BUNDLE = getBundle(CI123_BUNDLE)!;
const RANGE = bundleAgeRange(BUNDLE);

/**
 * The stages, keyed by the rate table's component names.
 *
 * The labels are the company's; which disease group a stage counts is matched on the start
 * of the group's title in `ci123-diseases.json`, so a reworded English gloss in that file
 * cannot quietly zero a count.
 */
const STAGE_TEXT: Record<string, { label: string; group: string; note?: string; major?: true }> = {
  "pre-early ci": { label: "โรคร้ายแรงระยะก่อนเริ่มต้น", group: "โรคร้ายแรงระยะก่อนเริ่มต้น" },
  "early to intermediate ci": { label: "โรคร้ายแรงระยะเริ่มต้นถึงปานกลาง", group: "โรคร้ายแรงระยะเริ่มต้นถึงปานกลาง" },
  "juvenile ci": {
    label: "โรคร้ายแรงสำหรับเด็ก", group: "โรคร้ายแรงสำหรับเด็ก",
    note: "ผู้เอาประกันภัยอายุ 1 เดือน – 18 ปี คุ้มครองต่อเนื่องถึงอายุ 19 ปี",
  },
  "special conditions": { label: "โรคร้ายแรงภายใต้เงื่อนไขพิเศษ", group: "โรคร้ายแรงภายใต้เงื่อนไขพิเศษ" },
  "critical care benefit": {
    label: "ภาวะวิกฤต", group: "ความคุ้มครองกรณีวิกฤต",
    note: "นับรวมวงเงินเดียวกับโรคร้ายแรงระยะรุนแรง",
  },
  "major ci": { label: "โรคร้ายแรงระยะรุนแรง", group: "โรคร้ายแรงระยะรุนแรง", major: true },
};

/** The leaflet's order: the stages that leave the contract standing, then the one that ends it. */
const STAGE_ORDER = [
  "pre-early ci", "early to intermediate ci", "juvenile ci", "special conditions", "critical care benefit", "major ci",
];

const GROUPS = (ci123Diseases as { groups: Ci123Group[] }).groups;

/** The six stages as the rate table states them; exported for the quote card, which draws them too. */
export function ci123Stages(): Ci123Stage[] {
  return stagesFrom();
}

function stagesFrom(): Ci123Stage[] {
  const rider = getPlan(BUNDLE.planCode)!.rates.riders.CI123;
  if (rider.kind !== "compositeCI") throw new Error("CI123 is not a composite rider");
  return STAGE_ORDER.map((key) => {
    const c = rider.components.find((x) => x.key === key);
    const text = STAGE_TEXT[key];
    if (!c || !text) throw new Error(`CI123 has no ${key} component`);
    const group = GROUPS.find((g) => g.title.startsWith(text.group));
    return {
      key, label: text.label, count: group?.diseases.length ?? 0, share: c.share, cap: c.cap,
      ...(text.note ? { note: text.note } : {}), ...(text.major ? { major: true as const } : {}),
    };
  });
}

/** Built once per server process; `expired` is asked again on every call, as in legacy-table. */
let cached: Omit<Ci123Table, "expired"> | undefined;

export function ci123Table(today: Date = new Date()): Ci123Table {
  const first = quoteBundle(BUNDLE, 1, { age: RANGE.min, sex: "M", mode: "annual" }, today)!;
  const expired = first.meta.expired;
  if (cached) return { ...cached, expired };
  const ages = Array.from({ length: RANGE.max - RANGE.min + 1 }, (_, i) => RANGE.min + i);

  const priceRow = (tier: number, sex: Sex, age: number): readonly number[] | null => {
    const modes = bundleModePremiums(BUNDLE, tier, { age, sex }, today);
    if (!modes) return null;
    const by = (m: (typeof modes)[number]["mode"]) => modes.find((x) => x.mode === m);
    const [annual, semi, monthly] = MODES.map(by);
    if (!annual || !semi || !monthly) return null;
    return [annual.total, semi.total, monthly.total, monthly.belowMinimum ? 1 : 0];
  };
  const forSex = (sex: Sex) => BUNDLE.tiers.map((t) => ages.map((age) => priceRow(t.no, sex, age)));

  // the base line is the same in every tier, so the first tier's quote carries it
  const baseRow = (sex: Sex) => ages.map((age) => {
    const q = quoteBundle(BUNDLE, 1, { age, sex, mode: "annual" }, today);
    const base = q?.items.find((i) => i.code === BUNDLE.variant);
    return base?.eligible ? base.annual : null;
  });

  const death = first.deathBenefit!;
  cached = {
    bundleCode: BUNDLE.code,
    ageMin: RANGE.min,
    ageMax: RANGE.max,
    sums: BUNDLE.tiers.map((t) => t.riders.find((r) => r.code === "CI123")!.sumAssured!),
    baseSum: BUNDLE.tiers[0].sumAssured,
    rateVersion: first.meta.version,
    minMonthlyTotal: first.meta.minMonthlyTotal,
    premiums: { M: forSex("M"), F: forSex("F") },
    basePremiums: { M: baseRow("M"), F: baseRow("F") },
    stages: stagesFrom(),
    // in the order the benefit table reads, so a stage and its list are found in the same place
    groups: STAGE_ORDER.flatMap((key) => GROUPS.filter((g) => g.title.startsWith(STAGE_TEXT[key].group))),
    diseaseCount: GROUPS
      .filter((g) => !g.title.startsWith(STAGE_TEXT["critical care benefit"].group))
      .reduce((n, g) => n + g.diseases.length, 0),
    death: { beforeAge: death.beforeAge, sumBefore: death.sumBefore, sumFrom: death.sumFrom },
  };
  return { ...cached, expired };
}
