// src/ui/panels/ActivityFeedPanel.tsx — the friendly activity feed (DP-UI §6.6).
// Requirement IDs: FR-09
import { useEffect, useMemo, useRef } from "react";
import { ActivityFeed } from "src/kits/agent-workflow/src/react/ActivityFeed.js";
import { Surface } from "../primitives/Surface.js";
import { useApp } from "../state/SessionProvider.js";
import { createFriendlyTrace } from "../trace/friendly.js";

function clampPass(root: HTMLElement): void {
  for (const li of root.querySelectorAll("li")) {
    const item = li as HTMLElement;
    if (item.dataset["clamped"] === "true") continue;
    if (item.scrollHeight > item.clientHeight + 1) {
      item.dataset["clamped"] = "true";
      const btn = document.createElement("button");
      btn.type = "button";
      btn.setAttribute("data-variant", "ghost");
      btn.textContent = "Show more";
      btn.addEventListener("click", () => {
        item.style.maxHeight = "none";
        btn.remove();
      });
      item.appendChild(btn);
    }
  }
}

export function ActivityFeedPanel(): React.JSX.Element {
  const { session } = useApp();
  const ref = useRef<HTMLDivElement | null>(null);
  const friendly = useMemo(() => createFriendlyTrace(session.trace, session.registry as never), [session]);
  useEffect(() => session.trace.subscribe(() => {
    if (ref.current) clampPass(ref.current);
  }), [session]);
  useEffect(() => {
    if (ref.current) clampPass(ref.current);
  });
  return (
    <div data-slot="feed">
      <Surface eyebrow="Activity" help="activity-feed" resultRegion="activity-feed" well>
        <div ref={ref}>
          <ActivityFeed trace={friendly} />
        </div>
      </Surface>
    </div>
  );
}
