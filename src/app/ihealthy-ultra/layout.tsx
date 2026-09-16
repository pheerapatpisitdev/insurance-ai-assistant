import "../satin-rose.css";
import "./theme.css";
import { SalesTheme } from "@/components/sales/SalesTheme";

/**
 * The rose satin, the same cloth /plb and /legacy are cut from, with this page's own hero and
 * benefit table laid over it. `.ihealthy-scope` stays because those two still need somewhere
 * to hang; the palette, the fabric and the print block all come from the satin now.
 */
export default function IHealthyLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="satin-rose ihealthy-scope">
      <SalesTheme>{children}</SalesTheme>
    </div>
  );
}
