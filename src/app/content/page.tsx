import "./theme.css";
import { AppShell } from "@/components/shell/AppShell";
import { CONTENT_PRODUCTS } from "@/lib/content/products";
import { ANGLES, LENGTHS } from "@/lib/content/prompt";
import { getContent, listContent, listHookTemplates } from "@/lib/content/store";
import { contentSpend, contentWorkbench } from "./actions";
import { ContentStudio } from "./ContentStudio";

export const dynamic = "force-dynamic";
// a round of five is two calls and several thousand words of Thai; the actions run as this page
export const maxDuration = 300;

export const metadata = {
  title: "สร้างคอนเทนต์ | advisortool",
  description: "สร้างโพสต์เฟซบุ๊กและสคริปต์วิดีโอจากข้อมูลจริงของแบบประกัน",
};

export default async function ContentPage({ searchParams }: { searchParams: Promise<{ hook?: string; open?: string }> }) {
  const { hook, open } = await searchParams;
  const [initial, used, hooks, spend] = await Promise.all([
    contentWorkbench({ status: "draft" }),
    listContent({ status: "used" }, 20).catch(() => []),
    listHookTemplates().catch(() => []),
    contentSpend(),
  ]);
  // the calendar's เปิดแก้ไข: the piece opens in the editor on arrival
  const opened = open && /^[0-9a-f-]{36}$/.test(open) ? await getContent(open).catch(() => null) : null;
  return (
    <div className="content-page">
      <AppShell>
        <div className="mx-auto max-w-[1400px] px-4 pb-10 pt-16 lg:pt-8">
          <ContentStudio
            products={CONTENT_PRODUCTS.map((p) => ({ href: p.href, name: p.name }))}
            angles={ANGLES.map((a) => ({ id: a.id, label: a.label }))}
            lengths={LENGTHS}
            hooks={hooks}
            initialHook={hooks.some((h) => h.id === hook) ? hook! : null}
            initial={initial}
            initialUsed={used}
            spend={spend}
            initialOpen={opened}
          />
        </div>
      </AppShell>
    </div>
  );
}
