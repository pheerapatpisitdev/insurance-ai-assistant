import { SalesTheme } from "@/components/sales/SalesTheme";

export default function LegacyLayout({ children }: { children: React.ReactNode }) {
  return <SalesTheme>{children}</SalesTheme>;
}
