import "./theme.css";

/**
 * The corporate navy, kept to this route — see theme.css for why this page did not take the
 * rose the rest of the calculator wears.
 */
export default function GroupInsuranceLayout({ children }: { children: React.ReactNode }) {
  return <div className="group-insurance">{children}</div>;
}
