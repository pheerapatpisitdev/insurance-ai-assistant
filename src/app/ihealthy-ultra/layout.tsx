import "./theme.css";
import { SalesTheme } from "@/components/sales/SalesTheme";

export default function IHealthyLayout({ children }: { children: React.ReactNode }) {
  return <div className="ihealthy-scope"><SalesTheme>{children}</SalesTheme></div>;
}
