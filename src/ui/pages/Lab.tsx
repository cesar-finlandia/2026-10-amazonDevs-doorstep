// src/ui/pages/Lab.tsx — the /lab tuning page (DP-3D §7 WU-3D-06; default export name kept).
// The scene large, the kit's live controls beside it, and a way to carry the
// chosen values back into code. Reachable only by its address. The 3D code and
// leva load lazily so the other routes never pay for them.
// Requirement IDs: FR-20
import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { Surface } from "../primitives/Surface.js";
import { Button } from "../primitives/Button.js";
import { useApp } from "../state/SessionProvider.js";
import { loadSampleWeek } from "../state/sampleWeek.js";

const DoorwayScene = lazy(() => import("src/3d/DoorwayScene.js"));
const Leva = lazy(() => import("leva").then((m) => ({ default: m.Leva })));

// The panel wears the page's palette: every colour is a design token.
const LEVA_THEME = {
  colors: {
    elevation1: "var(--bg-elevated)",
    elevation2: "var(--bg-sunken)",
    elevation3: "var(--border)",
    accent1: "var(--accent)",
    accent2: "var(--accent)",
    accent3: "var(--accent)",
    highlight1: "var(--text-muted)",
    highlight2: "var(--text)",
    highlight3: "var(--text)",
  },
};

type LabValuesModule = typeof import("src/3d/lab-values.js");

interface Demo3dWindow {
  __demo3d?: { play(shot: string): void };
  __lab?: { levaStore: unknown; read: LabValuesModule["readLabValues"] };
}

function playShot(shot: "overview" | "walk"): void {
  (window as unknown as Demo3dWindow).__demo3d?.play(shot);
}

export default function LabPage(): React.JSX.Element {
  const { session } = useApp();
  const [text, setText] = useState("");
  const [copied, setCopied] = useState(false);
  const values = useRef<LabValuesModule | null>(null);
  const copiedTimer = useRef<number | undefined>(undefined);

  // The lab needs a week to look at. The app starts with its baseline weeks
  // already recorded, so "no events" means none in the week under review.
  useEffect(() => {
    const model = session.store.getState();
    if (!model.events.some((e) => e.tsMs >= model.window.baselineEndMs)) void loadSampleWeek(session);
  }, [session]);

  // Read leva's store four times a second; with ?hook=1 expose it for tests.
  useEffect(() => {
    let timer: number | undefined;
    let cancelled = false;
    void Promise.all([import("src/3d/lab-values.js"), import("leva")]).then(([mod, leva]) => {
      if (cancelled) return;
      values.current = mod;
      const refresh = (): void => setText(mod.formatLabValues(mod.readLabValues()));
      refresh();
      timer = window.setInterval(refresh, 250);
      if (new URLSearchParams(location.search).get("hook") === "1") {
        (window as unknown as Demo3dWindow).__lab = { levaStore: leva.levaStore, read: mod.readLabValues };
      }
    });
    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearInterval(timer);
      delete (window as unknown as Demo3dWindow).__lab;
    };
  }, []);

  useEffect(
    () => () => {
      if (copiedTimer.current !== undefined) window.clearTimeout(copiedTimer.current);
    },
    [],
  );

  const copy = async (): Promise<void> => {
    const mod = values.current ?? (await import("src/3d/lab-values.js"));
    const json = mod.formatLabValues(mod.readLabValues());
    try {
      await navigator.clipboard.writeText(json);
    } catch {
      /* the page keeps the text visible so it can be copied by hand */
    }
    setCopied(true);
    if (copiedTimer.current !== undefined) window.clearTimeout(copiedTimer.current);
    copiedTimer.current = window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="page lab-page">
      <main data-demo-focus="lab" className="lab">
        <header className="lab__head">
          <h1 style={{ fontSize: "var(--text-h1)", lineHeight: "var(--lh-h1)", fontFamily: "var(--font-display)", margin: 0 }}>
            Tuning lab
          </h1>
          <p>Adjust the light, materials and camera by eye, then copy the values into src/3d/look.ts.</p>
        </header>
        <div className="lab__body">
          <Surface well className="lab__stage">
            <div className="lab__canvas">
              <Suspense fallback={null}>
                <DoorwayScene session={session} showLab />
              </Suspense>
            </div>
          </Surface>
          <aside className="lab__side">
            <div className="lab__shots" role="group" aria-label="Camera shots">
              <Button onClick={() => playShot("overview")}>Overview</Button>
              <Button onClick={() => playShot("walk")}>Walk</Button>
            </div>
            <div data-lab-panel="">
              <Suspense fallback={null}>
                <Leva fill flat oneLineLabels titleBar={false} hideCopyButton theme={LEVA_THEME} />
              </Suspense>
            </div>
            <Surface well>
              <pre data-lab-values="" className="lab__values mono">
                {text}
              </pre>
            </Surface>
            <Button variant="primary" data-lab-copy="" onClick={() => void copy()}>
              Copy values
            </Button>
            <p role="status" className="lab__copied">
              {copied ? "Copied." : ""}
            </p>
          </aside>
        </div>
      </main>
    </div>
  );
}
