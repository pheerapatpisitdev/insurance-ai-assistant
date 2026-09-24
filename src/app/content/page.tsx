import { AppShell } from "@/components/shell/AppShell";
import { StudioPage } from "./StudioPage";

export const dynamic = "force-dynamic";
// a round of five is two calls and several thousand words of Thai; the actions run as this page
export const maxDuration = 300;

export const metadata = {
  title: "สร้างคอนเทนต์ | advisortool",
  description: "สร้างโพสต์เฟซบุ๊กและสคริปต์วิดีโอจากข้อมูลจริงของแบบประกัน",
};

export default async function ContentPage({ searchParams }: { searchParams: Promise<{ hook?: string; open?: string }> }) {
  const { hook, open } = await searchParams;
  return (
    <div className="content-page">
      <AppShell>
        <div className="mx-auto max-w-[1400px] px-4 pb-10 pt-16 lg:pt-8">
          <StudioPage hook={hook} open={open} />
        </div>
      </AppShell>
    </div>
  );
}
