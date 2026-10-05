// src/ui/primitives/Explainer.tsx — the primary explainer panel (DP-UI §5.6A, §5.6 §6.13).
// Requirement IDs: FR-19
import { explainerCopy } from "../help/helpContent.js";
import { Button } from "./Button.js";
import { Dialog } from "./Dialog.js";

export function Explainer(props: { open: boolean; onClose(): void; onTry(): void }): React.JSX.Element {
  return (
    <Dialog open={props.open} onClose={props.onClose} label={explainerCopy.title}>
      <div data-app-explainer-panel="">
        <h1 style={{ fontSize: "var(--text-display)", lineHeight: "var(--lh-display)", fontFamily: "var(--font-display)", margin: "0 0 16px" }}>
          {explainerCopy.title}
        </h1>
        <h2 className="subject">What it does</h2>
        <p>{explainerCopy.what}</p>
        <h2 className="subject">Who it is for</h2>
        <p>{explainerCopy.who}</p>
        <h2 className="subject">How it flows</h2>
        <ol>
          {explainerCopy.flow.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        <h2 className="subject">How to read it</h2>
        <p>{explainerCopy.read}</p>
        <h2 className="subject">Try it</h2>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <Button variant="primary" onClick={props.onTry}>
            {explainerCopy.tryIt}
          </Button>
          <Button variant="ghost" onClick={props.onClose}>
            Close
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
