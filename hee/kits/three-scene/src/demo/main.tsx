// Requirement IDs: HEE-KIT-01
import { StrictMode, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { ThreeScene } from "../react/ThreeScene.js";
import { NEUTRAL_DEMO_TOKENS } from "../core/tokens.js";
import { buildSampleScene } from "./sample-scene.js";
import { LabApp } from "./lab.js";

function qualityFromUrl(): "high" | "low" {
  try {
    return new URLSearchParams(window.location.search).get("quality") === "low" ? "low" : "high";
  } catch {
    return "high";
  }
}

function DemoApp(): React.JSX.Element {
  const scene = useMemo(() => buildSampleScene(), []);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const quality = useMemo(() => qualityFromUrl(), []);
  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "system-ui, sans-serif" }}>
      <aside style={{ width: 220, padding: 12, background: "#1b1e22", color: "#e8eaed", overflowY: "auto" }}>
        <h1 style={{ fontSize: 16 }}>Widget bay</h1>
        <p style={{ fontSize: 12, opacity: 0.7 }}>{scene.entities.length} entities</p>
        <ul style={{ listStyle: "none", padding: 0 }}>
          {scene.entities.map((e) => (
            <li key={e.id}>
              <button
                type="button"
                onClick={() => setSelectedId((prev) => (prev === e.id ? null : e.id))}
                style={{
                  width: "100%",
                  textAlign: "left",
                  background: selectedId === e.id ? "#6f9fd8" : "transparent",
                  color: "#e8eaed",
                  border: "1px solid #43474e",
                  borderRadius: 4,
                  padding: "4px 8px",
                  marginBottom: 4,
                  cursor: "pointer",
                }}
              >
                {e.id}
              </button>
            </li>
          ))}
        </ul>
      </aside>
      <main style={{ flex: 1 }}>
        <ThreeScene
          scene={scene}
          tokens={NEUTRAL_DEMO_TOKENS}
          name="widget-bay"
          selectedId={selectedId}
          onSelect={setSelectedId}
          quality={quality}
        />
      </main>
    </div>
  );
}

export function isLabRoute(): boolean {
  try {
    return window.location.pathname.endsWith("/lab");
  } catch {
    return false;
  }
}

export function DemoRoot(): React.JSX.Element {
  if (isLabRoute()) return <LabApp />;
  return <DemoApp />;
}

const root = document.getElementById("root");
if (!root) throw new Error("three-scene demo: #root element is missing");
createRoot(root).render(
  <StrictMode>
    <DemoRoot />
  </StrictMode>,
);
