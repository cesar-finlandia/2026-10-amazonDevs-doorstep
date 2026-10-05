// src/ui/shell/Brandmark.tsx — the lockup of §5.2A.6 (DP-UI §3.3).
// Requirement IDs: FR-23
export function Brandmark(props: { size?: "header" | "slide" | "cover"; markOnly?: boolean }): React.JSX.Element {
  const size = props.size ?? "header";
  const mark = (
    <svg className="brandmark__mark" viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path d="M5 23V14A11 11 0 0 1 27 14V23" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M11 23V18M16 23V12M21 23V16" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 29H29" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
  if (props.markOnly) {
    return (
      <span className={`brandmark brandmark--${size}`} role="img" aria-label="Doorstep Rhythm">
        {mark}
      </span>
    );
  }
  return (
    <span className={`brandmark brandmark--${size}`}>
      {mark}
      <span className="brandmark__stack">
        <span className="brandmark__word">Doorstep Rhythm</span>
        <span className="brandmark__slogan">Know her day without calling.</span>
      </span>
    </span>
  );
}
