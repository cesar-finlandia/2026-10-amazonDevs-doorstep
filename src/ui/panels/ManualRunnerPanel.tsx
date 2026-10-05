// src/ui/panels/ManualRunnerPanel.tsx — run an action by hand (DP-UI §6.6).
// Requirement IDs: FR-07
import { useEffect, useRef } from "react";
import { ManualRunner } from "src/kits/agent-workflow/src/react/ManualRunner.js";
import { Surface } from "../primitives/Surface.js";
import { useApp } from "../state/SessionProvider.js";

export function ManualRunnerPanel(): React.JSX.Element {
  const { session } = useApp();
  const detailsRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const open = (): void => {
      const el = detailsRef.current as unknown as { open?: boolean } | null;
      if (el) el.open = true;
    };
    window.addEventListener("doorstep:open-manual", open);
    return () => window.removeEventListener("doorstep:open-manual", open);
  }, []);
  return (
    <div data-slot="manual">
      <Surface as="div">
        <details
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ref={detailsRef as any}
          className="manual-runner"
        >
          <summary>Run an action by hand</summary>
          <ManualRunner registry={session.registry} />
        </details>
      </Surface>
    </div>
  );
}
