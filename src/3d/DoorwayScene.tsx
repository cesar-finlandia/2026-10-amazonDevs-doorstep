// src/3d/DoorwayScene.tsx — the component DP-UI's hero slot loads (DP-3D §5.7).
// Composition order of §5.7 items 1–7 (shots and the shot effect arrive in
// WU-04). The probe entity is appended for the GL bridge but is not part of
// the description and is never counted.
// Requirement IDs: FR-20
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  ThreeScene,
  validateSceneDescription,
} from "src/kits/three-scene/src/react/index.js";
import type { SceneEntity } from "src/kits/three-scene/src/react/index.js";
import type { Session } from "src/domain/session.js";
import type { WeekModel } from "src/domain/types.js";
import { HIGHLIGHT_MS, highlightFromLedger, selectedIdOf, uiPatchForSelection } from "src/3d/bind.js";
import { canRenderGl, renderQuality } from "src/3d/capability.js";
import { SCENE_NAME, toSceneDescription } from "src/3d/adapter.js";
import { FlatWeekFallback } from "src/3d/FlatWeekFallback.js";
import { installProbe } from "src/3d/probe.js";
import type { ProbeData } from "src/3d/probe.js";
import { hasGlControls } from "src/3d/probe.js";
import { createRenderers } from "src/3d/renderers/index.js";
import { shotsForScene } from "src/3d/shots.js";
import { useSceneTokens } from "src/3d/tokens.js";

const PROBE_ENTITY: SceneEntity = {
  id: "probe",
  kind: "custom",
  customKey: "probe",
  position: [0, 0, 0],
  size: [0, 0, 0],
  material: { token: "wall" },
};

function sceneKey(model: WeekModel): string {
  const last = model.ledger[model.ledger.length - 1];
  return `${model.ledger.length}:${last?.seq ?? 0}:${model.events.length}:${model.incidents.length}`;
}

function reducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function DoorwayScene(props: {
  session: Session;
  className?: string;
  showLab?: boolean;
}): React.JSX.Element {
  const { session } = props;
  const model = useSyncExternalStore(
    (cb) => session.store.subscribe(() => cb()),
    () => session.store.getState(),
  );
  const desc = useMemo(() => toSceneDescription(model, session.store.revision()), [sceneKey(model)]);
  if (process.env["NODE_ENV"] !== "production") {
    const validity = validateSceneDescription(desc);
    if (!validity.ok) throw new Error(`invalid scene: ${validity.errors[0] ?? "unknown"}`);
  }
  const scene = useMemo(
    () => ({ ...desc, entities: [...desc.entities, PROBE_ENTITY] }),
    [desc],
  );
  const tokens = useSceneTokens();
  const renderers = useMemo(() => createRenderers({ tokens }), [tokens]);
  const shots = useMemo(() => shotsForScene(desc), [desc]);
  const quality = renderQuality();
  const [ready, setReady] = useState(false);
  const [highlightIds, setHighlightIds] = useState<string[]>([]);
  const lastSeq = useRef<number>(-1);
  const timer = useRef<number | undefined>(undefined);
  const playedOverview = useRef(false);

  // §5.4 item 5 — highlight what the ledger just touched.
  useEffect(() => {
    const tail = model.ledger[model.ledger.length - 1];
    const head = tail?.seq ?? 0;
    if (lastSeq.current < 0) {
      lastSeq.current = head;
      return;
    }
    if (head === lastSeq.current) return;
    if (reducedMotion()) {
      lastSeq.current = head;
      setHighlightIds([]);
      return;
    }
    const sceneIds = new Set(desc.entities.map((e) => e.id));
    const found = highlightFromLedger(model, lastSeq.current, sceneIds);
    lastSeq.current = found.seq;
    setHighlightIds(found.ids);
    if (timer.current !== undefined) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      setHighlightIds([]);
      timer.current = undefined;
    }, HIGHLIGHT_MS);
  }, [model, desc]);

  useEffect(
    () => () => {
      if (timer.current !== undefined) window.clearTimeout(timer.current);
    },
    [],
  );

  // §5.4 item 4 — the shot effect. On first ready it plays overview; afterwards
  // it plays ui.shotId when listed. An unknown shot is ignored silently. A move
  // issued before the rig has controls is dropped without a sound, so the
  // effect re-issues while hasGlControls() is false (at most 4 s) and issues
  // one final play once controls arrive.
  const shotId = model.ui.shotId;
  useEffect(() => {
    if (!ready) return;
    const api = (window as unknown as { __demo3d?: { play(s: string): void; shots: string[] } }).__demo3d;
    if (!api) return;
    let want: string;
    if (!playedOverview.current) {
      playedOverview.current = true;
      want = "overview";
    } else {
      want = shotId;
    }
    if (!api.shots.includes(want)) return;
    let cancelled = false;
    if (hasGlControls()) {
      api.play(want);
      return () => {
        cancelled = true;
      };
    }
    api.play(want);
    const started = performance.now();
    const retry = window.setInterval(() => {
      if (cancelled) {
        window.clearInterval(retry);
        return;
      }
      if (performance.now() - started > 4000 || hasGlControls()) {
        if (!cancelled && hasGlControls()) api.play(want);
        window.clearInterval(retry);
      } else {
        api.play(want);
      }
    }, 150);
    return () => {
      cancelled = true;
      window.clearInterval(retry);
    };
  }, [ready, shotId]);

  const dataRef = useRef<ProbeData>({
    ready: false,
    mode: quality,
    revision: desc.revision,
    entities: desc.entities,
    selectedId: selectedIdOf(model),
    highlightedIds: [],
    tokens,
  });
  dataRef.current = {
    ready,
    mode: quality,
    revision: desc.revision,
    entities: desc.entities,
    selectedId: selectedIdOf(model),
    highlightedIds: highlightIds,
    tokens,
  };
  useEffect(() => installProbe(() => dataRef.current), []);

  if (!canRenderGl()) return <FlatWeekFallback model={model} />;
  return (
    <div className={props.className} style={{ width: "100%", height: "100%" }}>
      {/* Scene labels are annotations: they must never swallow the clicks that
          select the objects behind them. Scoped to this scene's marker so the
          lab panel and the page stay interactive. */}
      <style>{'[data-demo-3d="doorway-week"] div[style*="translate3d(-50%, -50%, 0px)"] { pointer-events: none; }'}</style>
      <ThreeScene
        scene={scene}
        tokens={tokens}
        name={SCENE_NAME}
        selectedId={selectedIdOf(model)}
        highlightIds={highlightIds}
        onSelect={(id) => {
          // DEVIATION from §5.4 item 2's letter: session.call("set_ui") is not
          // routable — the registry only exposes the registered agent
          // descriptors ("Unknown action set_ui."). The store action is
          // dispatched directly with source "human": same patch, same
          // subscriber notifications, no ledger write, so selection still
          // never rebuilds the scene.
          const patch = uiPatchForSelection(session.store.getState(), id);
          if (patch === undefined) return;
          session.store.dispatch("set_ui", patch, "human");
        }}
        shots={shots}
        renderers={renderers}
        quality={quality}
        showLab={props.showLab}
        fallback={<FlatWeekFallback model={model} />}
        onReady={() => setReady(true)}
      />
    </div>
  );
}

export default DoorwayScene;
