import "./theme.css";

/**
 * The calculator wears the satin's colours without its cloth — see theme.css for why a tool
 * takes the family resemblance and not the fabric.
 */
export default function OtherPlansLayout({ children }: { children: React.ReactNode }) {
  return <div className="other-plans">{children}</div>;
}
