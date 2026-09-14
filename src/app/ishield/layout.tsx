import "./theme.css";
import { SalesTheme } from "@/components/sales/SalesTheme";

export default function IShieldLayout({ children }: { children: React.ReactNode }) {
  return <div className="ishield-scope"><SalesTheme>{children}</SalesTheme></div>;
}
