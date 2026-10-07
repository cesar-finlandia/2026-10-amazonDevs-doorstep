// src/ui/primitives/Message.tsx — banner, callout and toast in five tones (DP-UI §5.6 §6.7).
// Requirement IDs: FR-19, FR-21
import { CircleCheck, Info, Layers, OctagonX, TriangleAlert } from "lucide-react";
import type { Tone } from "../copy/banner.js";

const GLYPHS: Record<Tone, typeof Info> = {
  info: Info,
  success: CircleCheck,
  warning: TriangleAlert,
  danger: OctagonX,
  degraded: Layers,
};

export function Message(props: {
  tier: "banner" | "callout" | "toast";
  tone: Tone;
  title: string;
  detail?: string;
  items?: { step: string; text: string }[];
  action?: { label: string; onClick(): void };
  onDismiss?(): void;
}): React.JSX.Element {
  const Glyph = GLYPHS[props.tone];
  return (
    <div data-message="" data-tier={props.tier} data-tone={props.tone} role={props.tone === "danger" ? "alert" : "status"}>
      <div className="message__inner">
        <Glyph className="message__glyph" aria-hidden="true" />
        <div>
          <div className="message__title">{props.title}</div>
          {props.detail ? <div className="message__detail">{props.detail}</div> : null}
          {props.items && props.items.length > 0 ? (
            <dl className="message__items">
              {/* Steps repeat across envelopes (e.g. two rung lines both
                  labelled with the rung name): the index keeps keys unique. */}
              {props.items.map((it, i) => (
                <div key={`${it.step}-${i}`}>
                  <dt>{it.step}</dt>
                  <dd>{it.text}</dd>
                </div>
              ))}
            </dl>
          ) : null}
        </div>
        <div className="message__actions">
          {props.action ? (
            <button type="button" data-variant="ghost" onClick={props.action.onClick}>
              {props.action.label}
            </button>
          ) : null}
          {props.onDismiss ? (
            <button type="button" data-variant="ghost" aria-label="Dismiss" onClick={props.onDismiss}>
              ×
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
