// Requirement IDs: HEE-KIT-02
import { StrictMode, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { runAgentLoop } from "../adapters/inApp.js";
import { installTraceHook } from "../trace/traceWriter.js";
import { ActivityFeed } from "../react/ActivityFeed.js";
import { ApprovalBar } from "../react/ApprovalBar.js";
import { ManualRunner } from "../react/ManualRunner.js";
import { createShelfDemo } from "./shelfDomain.js";
import { createScriptedStep } from "./scriptedAgent.js";

function DemoApp(): React.JSX.Element {
  const demo = useMemo(() => createShelfDemo(), []);
  const [revision, setRevision] = useState(0);
  const [running, setRunning] = useState(false);
  const [finalText, setFinalText] = useState("");

  useEffect(() => {
    const offTrace = installTraceHook(demo.trace);
    const offStore = demo.store.subscribe((e) => setRevision(e.revision));
    setRevision(demo.store.revision());
    return () => {
      offTrace();
      offStore();
    };
  }, [demo]);

  async function runScripted(): Promise<void> {
    if (running) return;
    setRunning(true);
    try {
      const res = await runAgentLoop({
        registry: demo.registry,
        step: createScriptedStep(),
        goal: "Stock six widgets on Alpha, repair the overflow, and remove epsilon.",
        productName: "Widget Shelf",
        procedureText: "1. list_widgets. 2. add_widget six times. 3. check_shelves. 4. move_widget. 5. check_shelves. 6. remove_widget.",
        trace: demo.trace,
        modelRole: "scripted-actor",
      });
      setFinalText(res.finalText);
    } finally {
      setRunning(false);
    }
  }

  function undo(): void {
    if (demo.store.undo()) {
      demo.trace.record({
        round: 0,
        kind: "system",
        name: "undo",
        source: "human",
        input_ref: null,
        output_ref: `revision ${demo.store.revision()}`,
        ok: true,
        latency_ms: 0,
      });
    }
  }

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", padding: 16, maxWidth: 900 }}>
      <h1>Widget shelf</h1>
      <p>Revision {revision}</p>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <button type="button" onClick={() => void runScripted()} disabled={running}>
          Run scripted agent
        </button>
        <button type="button" onClick={undo}>
          Undo
        </button>
      </div>
      <ApprovalBar gate={demo.gate} />
      <h2>Activity</h2>
      <ActivityFeed trace={demo.trace} />
      <h2>Manual runner</h2>
      <ManualRunner registry={demo.registry} />
      {finalText ? <p>{finalText}</p> : null}
    </div>
  );
}

const root = document.getElementById("root");
if (!root) throw new Error("agent-workflow demo: #root element is missing");
createRoot(root).render(
  <StrictMode>
    <DemoApp />
  </StrictMode>,
);
