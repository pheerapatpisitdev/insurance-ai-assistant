import "../satin-rose.css";
import { SalesTheme } from "@/components/sales/SalesTheme";

export default function PlbLayout({ children }: { children: React.ReactNode }) {
  return <div className="satin-rose"><SalesTheme>{children}</SalesTheme></div>;
}
