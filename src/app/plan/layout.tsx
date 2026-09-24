import { SalesTheme } from "@/components/sales/SalesTheme";

export default function PlanLayout({ children }: { children: React.ReactNode }) {
  return <SalesTheme>{children}</SalesTheme>;
}
