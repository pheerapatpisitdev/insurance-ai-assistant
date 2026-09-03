import { loadRules } from "./actions";
import { RulesClient } from "./RulesClient";
import { listPlans } from "@/calc/plans/registry";

export const dynamic = "force-dynamic";

export default async function RulesPage({ searchParams }: { searchParams: Promise<{ plan?: string }> }) {
  const { plan } = await searchParams;
  const code = plan ?? listPlans()[0].code;
  const data = await loadRules(code);
  if (!data) return <p className="text-sm text-red-600">ไม่พบแบบประกัน {code}</p>;
  return <RulesClient data={data} />;
}
