// src/ui/primitives/Dialog.tsx — focus-trapped dialog (DP-UI §5.6 §6.13).
// Requirement IDs: FR-19
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

function focusables(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter(
    (el) => !el.hasAttribute("disabled") && el.getClientRects().length > 0,
  );
}

export function Dialog(props: {
  open: boolean;
  onClose(): void;
  label: string;
  elevation?: 3;
  children: React.ReactNode;
}): React.JSX.Element | null {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const prevFocus = useRef<Element | null>(null);
  useEffect(() => {
    if (!props.open) return;
    prevFocus.current = document.activeElement;
    const panel = panelRef.current;
    const first = panel ? focusables(panel)[0] : undefined;
    (first ?? panel)?.focus();
    const onKey = (ev: KeyboardEvent): void => {
      if (ev.key === "Escape") {
        props.onClose();
        return;
      }
      if (ev.key !== "Tab" || !panel) return;
      const items = focusables(panel);
      if (items.length === 0) {
        ev.preventDefault();
        return;
      }
      const firstEl = items[0] as HTMLElement;
      const lastEl = items[items.length - 1] as HTMLElement;
      if (ev.shiftKey && document.activeElement === firstEl) {
        ev.preventDefault();
        lastEl.focus();
      } else if (!ev.shiftKey && document.activeElement === lastEl) {
        ev.preventDefault();
        firstEl.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      if (prevFocus.current instanceof HTMLElement) prevFocus.current.focus();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.open]);
  if (!props.open) return null;
  // Portalled to the body so a dialog opened from a scrolling column (the
  // rail) is not scrolled by its ancestors and its backdrop covers the page.
  return createPortal(
    <div
      className="dialog__backdrop"
      onClick={(ev) => {
        if (ev.target === ev.currentTarget) props.onClose();
      }}
    >
      <div
        ref={panelRef}
        className="dialog__panel"
        role="dialog"
        aria-modal="true"
        aria-label={props.label}
        tabIndex={-1}
        data-surface=""
        data-elevation={String(props.elevation ?? 3)}
      >
        {props.children}
      </div>
    </div>,
    document.body,
  );
}
