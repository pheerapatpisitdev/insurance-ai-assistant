import "./theme.css";
import { AppShell } from "@/components/shell/AppShell";
import { CONTENT_PRODUCTS } from "@/lib/content/products";
import { ANGLES, LENGTHS } from "@/lib/content/prompt";
import { contentHistory } from "./actions";
import { ContentStudio } from "./ContentStudio";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "สร้างคอนเทนต์ | advisortool",
  description: "สร้างโพสต์เฟซบุ๊กและสคริปต์วิดีโอจากข้อมูลจริงของแบบประกัน",
};

export default async function ContentPage() {
  const history = await contentHistory({});
  return (
    <div className="content-page">
      <AppShell>
        <div className="mx-auto max-w-3xl px-4 pb-10 pt-16 lg:pt-8">
          <ContentStudio
            products={CONTENT_PRODUCTS.map((p) => ({ href: p.href, name: p.name }))}
            angles={ANGLES.map((a) => ({ id: a.id, label: a.label }))}
            lengths={LENGTHS}
            initialHistory={history}
          />
        </div>
      </AppShell>
    </div>
  );
}
