// src/ui/primitives/EmptyState.tsx (DP-UI §5.6 §6.14).
// Requirement IDs: FR-19, FR-21
import { Button } from "./Button.js";

export function EmptyState(props: {
  title: string;
  detail: string;
  action?: { label: string; onClick(): void };
  secondary?: { label: string; onClick(): void };
}): React.JSX.Element {
  return (
    <div data-surface="">
      <svg width="120" height="120" viewBox="0 0 120 120" fill="none" aria-hidden="true">
        <ellipse cx="60" cy="60" rx="44" ry="34" stroke="var(--border-strong)" strokeWidth="2.5" />
        <path d="M40 62v-8M60 62V44M80 62v-5" stroke="var(--border-strong)" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M28 92h64" stroke="var(--border-strong)" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
      <h1 style={{ fontSize: "var(--text-display)", lineHeight: "var(--lh-display)", fontFamily: "var(--font-display)", margin: "16px 0 8px" }}>
        {props.title}
      </h1>
      <p style={{ fontSize: "var(--text-body)", lineHeight: "var(--lh-body)", margin: "0 0 16px" }}>{props.detail}</p>
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        {props.action ? (
          <Button variant="primary" onClick={props.action.onClick}>
            {props.action.label}
          </Button>
        ) : null}
        {props.secondary ? (
          <Button variant="ghost" onClick={props.secondary.onClick}>
            {props.secondary.label}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
