import { IHealthyCalculator } from "@/components/IHealthyCalculator";
import { iHealthyTable } from "@/lib/ihealthy-table";
import { iHealthyFacts } from "@/lib/ihealthy-facts";
import { initialFrom, type IHealthyQuery } from "@/lib/ihealthy-link";
import { Disclaimer, Hero, TermsSection } from "@/components/ihealthy/Sections";
import { ExpiryBanner } from "@/components/ExpiryBanner";

export const metadata = {
  title: "ไอเฮลท์ตี้ อัลตร้า — ค่ารักษาพยาบาลเหมาจ่ายถึง 100 ล้านต่อปี",
  description:
    "ประกันสุขภาพเหมาจ่าย 6 แผน วงเงิน 3 ถึง 100 ล้านบาทต่อปี ต่ออายุได้ถึงอายุ 98 ปี เทียบผลประโยชน์ครบ 28 หมวด และคำนวณเบี้ยของคุณเองได้ทันที",
};

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
    if (!Object.hasOwn(searchParams, "constructor")) throw thrown;
  }
  const initial = initialFrom(table, query);
  // Only the rows and the plan list cross into the browser. The eight long paragraphs of
  // `terms` are three of the five kilobytes of this JSON and only server components render
  // them, so they never enter the client module graph.
  const { rows, plans, copayPercent } = facts;
  return (
    <main className="mx-auto max-w-lg px-4 pb-28 sm:max-w-2xl sm:pb-10">
      <Hero facts={facts} />
      <ExpiryBanner expired={table.expired} expiresOn={table.expiresOn} />
      <section id="calc" className="scroll-mt-4">
        <IHealthyCalculator
          table={table} data={{ rows, plans, copayPercent }}
          sharedLimit={facts.terms.sharedLimit} initial={initial} sticky
        />
      </section>
      <TermsSection facts={facts} />
      <Disclaimer facts={facts} rateVersion={table.rateVersion} />
    </main>
  );
}
