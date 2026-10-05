// src/ui/primitives/WorkIndicator.tsx (DP-UI §5.6 §6.6).
// Requirement IDs: FR-19
export function WorkIndicator(props: { label: string }): React.JSX.Element {
  return (
    <span className="work-indicator" role="status" aria-live="polite">
      <span className="work-indicator__tick" aria-hidden="true" />
      <span className="work-indicator__tick" aria-hidden="true" />
      <span className="work-indicator__tick" aria-hidden="true" />
      <span className="support" style={{ color: "var(--text)" }}>
        {props.label}
      </span>
    </span>
  );
}
