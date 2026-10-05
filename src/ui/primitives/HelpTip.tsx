// src/ui/primitives/HelpTip.tsx — the contextual "?" (DP-UI §5.6 §6.5).
// Requirement IDs: FR-19
import { useEffect, useRef, useState } from "react";
import { helpContent } from "../help/helpContent.js";
import type { HelpRegionId } from "../help/helpContent.js";

export function HelpTip(props: { region: HelpRegionId }): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const popRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (ev: PointerEvent): void => {
      const t = ev.target as Node | null;
      if (t && popRef.current?.contains(t)) return;
      if (t && btnRef.current?.contains(t)) return;
      setOpen(false);
      btnRef.current?.focus();
    };
    const onKey = (ev: KeyboardEvent): void => {
      if (ev.key === "Escape") {
        setOpen(false);
        btnRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open ]);
  const copy = helpContent[props.region];
  return (
    <span className="help-tip">
      <button
        ref={btnRef}
        type="button"
        className="help-tip__btn"
        data-help-for={props.region}
        aria-label={copy.label}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        ?
      </button>
      {open ? (
        <div ref={popRef} role="dialog" aria-label={copy.label} className="help-popover" data-elevation="2">
          <p className="support" style={{ color: "var(--text)" }}>
            {copy.body}
          </p>
        </div>
      ) : null}
    </span>
  );
}
