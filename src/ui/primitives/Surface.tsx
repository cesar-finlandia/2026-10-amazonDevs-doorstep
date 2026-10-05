// src/ui/primitives/Surface.tsx (DP-UI §3.3, §5.6 §6.3).
// Requirement IDs: FR-19
import type { HelpRegionId } from "../help/helpContent.js";
import { HelpTip } from "./HelpTip.js";

export function Surface(props: {
  title?: string;
  eyebrow?: string;
  emphasis?: "primary";
  elevation?: 2 | 3;
  well?: boolean;
  help?: HelpRegionId;
  resultRegion?: string;
  as?: "section" | "div" | "aside";
  className?: string;
  children: React.ReactNode;
}): React.JSX.Element {
  const Tag = props.as ?? "section";
  return (
    <Tag
      data-surface=""
      {...(props.emphasis ? { "data-emphasis": props.emphasis } : {})}
      {...(props.elevation ? { "data-elevation": String(props.elevation) } : {})}
      {...(props.well ? { "data-well": "" } : {})}
      {...(props.resultRegion ? { "data-result-region": props.resultRegion } : {})}
      {...(props.className ? { className: props.className } : {})}
    >
      {props.title || props.eyebrow ? (
        <header>
          <span>
            {props.eyebrow ? <span className="eyebrow">{props.eyebrow}</span> : null}
            {props.title ? <span className="subject">{props.title}</span> : null}
          </span>
          <span style={{ flex: 1 }} />
          {props.help ? <HelpTip region={props.help} /> : null}
        </header>
      ) : null}
      {props.children}
    </Tag>
  );
}
