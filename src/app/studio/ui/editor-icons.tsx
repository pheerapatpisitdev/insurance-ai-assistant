/**
 * The piece editor's few icons, drawn inline in the text's own colour.
 *
 * Every one is decoration beside a word that says the same thing, so each is aria-hidden;
 * where an icon stands alone, the button carries an aria-label instead.
 */

type IconProps = { className?: string };

const base = (className?: string) => `inline-block shrink-0 ${className ?? "size-4"}`;

function Svg({ className, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"
      className={base(className)}
    >
      {children}
    </svg>
  );
}

export const CheckIcon = ({ className }: IconProps) => (
  <Svg className={className}><path d="M5 12.5l4.5 4.5L19 7.5" /></Svg>
);

export const ClockIcon = ({ className }: IconProps) => (
  <Svg className={className}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></Svg>
);

export const CloseIcon = ({ className }: IconProps) => (
  <Svg className={className}><path d="M6 6l12 12M18 6L6 18" /></Svg>
);

export const BackIcon = ({ className }: IconProps) => (
  <Svg className={className}><path d="M15 5l-7 7 7 7" /></Svg>
);

export const AlertIcon = ({ className }: IconProps) => (
  <Svg className={className}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5v5.5M12 16.2v.3" /></Svg>
);

export const LockIcon = ({ className }: IconProps) => (
  <Svg className={className}><rect x="5" y="10.5" width="14" height="9.5" rx="2" /><path d="M8.5 10.5V8a3.5 3.5 0 017 0v2.5" /></Svg>
);
