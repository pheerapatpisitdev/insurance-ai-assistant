import { IHealthyCalculator } from "@/components/IHealthyCalculator";
import { iHealthyTable } from "@/lib/ihealthy-table";
import { iHealthyFacts } from "@/lib/ihealthy-facts";
import { initialFrom, type IHealthyQuery } from "@/lib/ihealthy-link";
import type { IHealthyInitial } from "@/lib/ihealthy-choice";
import { Disclaimer, Hero, TermsSection } from "@/components/ihealthy/Sections";
import { arrangementKey } from "@/components/ihealthy/rider-request";
import { priceRiders } from "@/lib/ihealthy-rider-quote";
import type { Attached } from "@/components/ihealthy/RiderPanel";

export const metadata = {
  title: "iHealthy Ultra — ค่ารักษาพยาบาลเหมาจ่ายถึง 100 ล้านต่อปี",
  description:
    "ประกันสุขภาพเหมาจ่าย 6 แผน วงเงิน 3 ถึง 100 ล้านบาทต่อปี ต่ออายุได้ถึงอายุ 98 ปี เทียบผลประโยชน์ครบ 28 หมวด และคำนวณเบี้ยของคุณเองได้ทันที",
};

/**
 * A link's own riders, priced here so that the first thing a reader sees is already right.
 *
 * The fold prices itself over the wire, which cannot happen until a browser has the page — so
 * a shared link carrying riders used to render with the agency's standard one instead, for
 * the half-second until its own answer landed, and for ever if that request never did. This
 * is the same engine call the fold will make, made once while the HTML is still being built.
 *
 * Undefined where the link says nothing about riders, which is the page's other opening: the
 * agency's standard daily cash, quoted in the browser from the slim table.
 */
function foldQuote(standardCode: string, initial: IHealthyInitial): Attached | undefined {
  if (initial.riders === undefined) return undefined;
  const request = {
    base: initial.base, age: initial.age, sex: initial.sex, sumAssured: initial.sumAssured,
    mode: initial.mode, plan: initial.plan, territory: initial.territory, coverage: initial.coverage,
  };
  const priced = priceRiders({ ...request, riders: initial.riders });
  const attached = priced.extraCodes.includes(standardCode)
    ? initial.riders.find((r) => r.code === standardCode)?.plan ?? null
    : null;
  return {
    at: arrangementKey(request),
    premiums: priced.extras,
    codes: priced.extraCodes,
    riders: initial.riders.filter((r) => priced.extraCodes.includes(r.code)),
    dailyCash: attached,
    deathBenefit: priced.deathBenefit,
  };
}

/**
 * What it pays, what it costs, and what the contract will not do — in that order, because a
 * health rider is bought on its ceiling and kept or dropped on its exclusions.
 */
export default async function IHealthyPage(
  { searchParams }: { searchParams: Promise<IHealthyQuery> },
) {
  const table = iHealthyTable();
  const facts = iHealthyFacts();
  // The address is read here rather than in the browser, so a shared link is already the
  // arrangement it asks for in the HTML that arrives — no first paint of somebody else's
  // quote, and a reader on a slow phone never watches the card change under them.
  //
  // Awaited inside a try for one address only. Next defines every key of the query as a getter
  // on the promise it hands over — `makeUntrackedExoticSearchParams`, so that the old
  // synchronous reads keep working — and it skips only the property names on its own
  // well-known list. `constructor` is not one of them, so `?constructor=1` leaves the promise
  // with a string where its constructor should be and `await` throws in the language itself,
  // above anything this page is in a position to validate. The re-throw is what keeps this
  // from swallowing anything else: an aborted prerender arrives as a throw here too, and it
  // does not arrive on a promise whose own constructor has been overwritten.
  let query: IHealthyQuery = {};
  try {
    query = await searchParams;
  } catch (thrown) {
    // Tight on the one failure it is for, so a future Next version cannot route something
    // else quietly through this branch.
    if (!(thrown instanceof TypeError) || !Object.hasOwn(searchParams, "constructor")) throw thrown;
  }
  const initial = initialFrom(table, query);
  // Only the rows and the plan list are handed to the island, and the two sentences the
  // table itself has to print. The rest of `terms` is rendered by the server components
  // below. That is a smaller prop, not a smaller bundle: `ihealthy-facts.ts` imports the
  // whole sheet at module scope and a client component imports `planLabel` from it, so the
  // paragraphs are in the route chunk either way — a comment here once claimed otherwise.
  const { rows, plans, copayPercent } = facts;
  const initialAttached = foldQuote(table.standard.code, initial);
  return (
    <main className="mx-auto max-w-lg px-4 pb-28 sm:max-w-2xl sm:pb-10">
      <Hero facts={facts} />
      {/* The customer's version of the same fact. `ExpiryBanner` tells the agency's own
          operator to go and fetch a new rate file, which is not a sentence to put at the top
          of a page a customer arrived at from an advert. */}
      {table.expired && (
        <p className="mb-4 rounded-sm border border-[var(--lg-gold)] px-4 py-3 text-sm text-[var(--lg-gold)]">
          ตารางเบี้ยชุดนี้หมดอายุตั้งแต่ {table.expiresOn} ขอเบี้ยปัจจุบันได้จากตัวแทน
        </p>
      )}
      <section id="calc" className="scroll-mt-4">
        <IHealthyCalculator
          table={table} data={{ rows, plans, copayPercent }}
          sharedLimit={facts.terms.sharedLimit} participationNote={facts.terms.participationNote}
          initial={initial} initialAttached={initialAttached} sticky
        />
      </section>
      <TermsSection facts={facts} />
      <Disclaimer facts={facts} rateVersion={table.rateVersion} />
    </main>
  );
}
