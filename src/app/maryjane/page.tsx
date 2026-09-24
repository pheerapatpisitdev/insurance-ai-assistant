import { StudioPage } from "../content/StudioPage";
import { SubNav } from "../content/SubNav";

export const dynamic = "force-dynamic";
// the same actions as /content, and they run as this page, so the same allowance
export const maxDuration = 300;

export const metadata = {
  title: "Maryjane | สร้างคอนเทนต์",
  description: "สร้างโพสต์เฟซบุ๊กและสคริปต์วิดีโอจากข้อมูลจริงของแบบประกัน",
};

/**
 * The content workbench alone: no menu, the whole width for the work. The workbench's own
 * tabs stay — the calendar and the two libraries are reached from here too — though none is
 * lit, as this address is none of them.
 */
export default async function MaryjanePage({ searchParams }: { searchParams: Promise<{ hook?: string; open?: string }> }) {
  const { hook, open } = await searchParams;
  return (
    <div className="content-page">
      <div className="mx-auto max-w-[1400px] px-4 pb-10 pt-6">
        <SubNav />
        <div className="mt-5">
          <StudioPage hook={hook} open={open} />
        </div>
      </div>
    </div>
  );
}
