import "./theme.css";
import { SalesTheme } from "@/components/sales/SalesTheme";

/**
 * The shared sales skin, with this page's own hero and benefit table laid over it.
 * `.ihealthy-scope` stays because those two still need somewhere to hang; the palette and the
 * print block come from globals.css, the same as every other sales page.
 */
export default function IHealthyLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="ihealthy-scope">
      <SalesTheme>{children}</SalesTheme>
    </div>
  );
}
