import "./theme.css";
import { CONTENT_PRODUCTS } from "@/lib/content/products";
import { LENGTHS } from "@/lib/content/prompt";
import { getContent, listContent, listHookTemplates } from "@/lib/content/store";
import { contentSpend, contentWorkbench } from "./actions";
import { ContentStudio } from "./ContentStudio";

/**
 * The workbench and everything it loads, for the two doors to it: /content inside the menu,
 * and /maryjane on its own (the owner asked for a page with nothing else on it, 2026-09-24).
 * Each page still exports its own `maxDuration`, because the actions run as the page.
 */
export async function StudioPage({ hook, open }: { hook?: string; open?: string }) {
  const [initial, used, hooks, spend] = await Promise.all([
    contentWorkbench({ status: "draft" }),
    listContent({ status: "used" }, 20).catch(() => []),
    listHookTemplates().catch(() => []),
    contentSpend(),
  ]);
  // the calendar's เปิดแก้ไข: the piece opens in the editor on arrival
  const opened = open && /^[0-9a-f-]{36}$/.test(open) ? await getContent(open).catch(() => null) : null;
  return (
    <ContentStudio
      products={CONTENT_PRODUCTS.map((p) => ({ href: p.href, name: p.name }))}
      lengths={LENGTHS}
      hooks={hooks}
      initialHook={hooks.some((h) => h.id === hook) ? hook! : null}
      initial={initial}
      initialUsed={used}
      spend={spend}
      initialOpen={opened}
    />
  );
}
