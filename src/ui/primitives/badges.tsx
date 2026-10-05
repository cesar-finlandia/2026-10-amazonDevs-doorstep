// src/ui/primitives/badges.tsx — StatusChip, SourceBadge, SyntheticBadge (DP-UI §5.6 §6.8).
// Requirement IDs: FR-19
import { CircleCheck, Info, Layers, OctagonX, TriangleAlert } from "lucide-react";
import type { Tone } from "../copy/banner.js";

const CHIP_GLYPH: Record<string, typeof Info> = {
  success: CircleCheck,
  warning: TriangleAlert,
  danger: OctagonX,
  degraded: Layers,
  accent: Info,
  info: Info,
};

export function StatusChip(props: { tone: Tone; label: string }): React.JSX.Element {
  const Glyph = CHIP_GLYPH[props.tone] ?? Info;
  return (
    <span className="chip" data-tone={props.tone}>
      <Glyph aria-hidden="true" />
      {props.label}
    </span>
  );
}

export function SourceBadge(props: { source: "agent" | "human" | "system" }): React.JSX.Element {
  const text = props.source === "agent" ? "AGENT" : props.source === "human" ? "YOU" : "SYSTEM";
  const tone = props.source === "agent" ? "accent" : props.source === "human" ? "inverse" : "sunken";
  return (
    <span className="chip" data-tone={tone}>
      {text}
    </span>
  );
}

export function SyntheticBadge(): React.JSX.Element {
  return <span className="badge-synthetic">Sample week · synthetic</span>;
}
