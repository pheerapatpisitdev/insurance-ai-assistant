import { SalesTheme } from "@/components/sales/SalesTheme";

export default function EasyProtectLayout({ children }: { children: React.ReactNode }) {
  return <SalesTheme>{children}</SalesTheme>;
}
