// Requirement IDs: HEE-KIT-01
import { useMemo, useState } from "react";
import { ThreeScene } from "../react/ThreeScene.js";
import { NEUTRAL_DEMO_TOKENS } from "../core/tokens.js";
import { buildSampleScene } from "./sample-scene.js";

export function LabApp(): React.JSX.Element {
  const scene = useMemo(() => buildSampleScene(), []);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", fontFamily: "system-ui, sans-serif" }}>
      <header style={{ padding: "8px 12px", background: "#1b1e22", color: "#e8eaed" }}>
        <strong>Widget bay lab</strong>
        <span style={{ opacity: 0.7 }}> — tune lights, materials, camera and effects; copy the values back into code.</span>
      </header>
      <main style={{ flex: 1 }}>
        <ThreeScene
          scene={scene}
          tokens={NEUTRAL_DEMO_TOKENS}
          name="widget-bay"
          selectedId={selectedId}
          onSelect={setSelectedId}
          showLab
        />
      </main>
    </div>
  );
}
