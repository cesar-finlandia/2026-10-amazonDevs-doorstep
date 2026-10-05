// src/ui/primitives/Button.tsx (DP-UI §3.3, §5.6 §6.0).
// Requirement IDs: FR-19
export function Button(
  props: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: "default" | "primary" | "ghost" | "danger";
    loading?: boolean;
    icon?: React.ReactNode;
  },
): React.JSX.Element {
  const { variant, loading, icon, children, ...rest } = props;
  const busy = loading === true;
  return (
    <button
      type="button"
      {...rest}
      data-variant={variant ?? "default"}
      disabled={rest.disabled === true || busy}
      {...(busy ? { "aria-busy": "true" } : {})}
    >
      <span className="btn__lead" aria-hidden="true">
        {busy ? (
          <svg className="btn__spinner" viewBox="0 0 14 14">
            <path d="M2 12V7M7 12V2M12 12V9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        ) : (
          <span className="btn__icon">{icon}</span>
        )}
      </span>
      {children}
    </button>
  );
}
