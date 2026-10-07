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
import { hasGlControls, subscribeGl } from "src/3d/probe.js";
import { createRenderers } from "src/3d/renderers/index.js";
import type { SceneLabel } from "src/3d/renderers/scene-labels.js";
import { shotsForScene } from "src/3d/shots.js";
import { useSceneTokens } from "src/3d/tokens.js";

const LABELS_ENTITY: SceneEntity = {
  id: "scene-labels",
  kind: "custom",
  customKey: "scene-labels",
  position: [0, 0, 0],
  size: [0, 0, 0],
  material: { token: "wall" },
};

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

const BURST_LEDGER_ENTRIES = 12;

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
  // Labels are drawn by the scene-labels layer (sprites), not by the kit's
  // per-entity <Html> roots: the kit never sees `label` (FIX-13).
  const labels = useMemo<SceneLabel[]>(
    () =>
      desc.entities.flatMap((e) =>
        e.label ? [{ id: e.id, text: e.label, position: [e.position[0], e.position[1], e.position[2]] as [number, number, number] }] : [],
      ),
    [desc],
  );
  const scene = useMemo(
    () => ({
      ...desc,
      entities: [
        ...desc.entities.map((e) => {
          if (e.label === undefined) return e;
          const { label: _label, ...rest } = e;
          void _label;
          return rest;
        }),
        LABELS_ENTITY,
        PROBE_ENTITY,
      ],
    }),
    [desc],
  );
  const tokens = useSceneTokens();
  const labelReach = useMemo(() => {
    const [a, b] = [desc.bounds.min, desc.bounds.max];
    return Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) * 0.9;
  }, [desc.bounds]);
  const renderers = useMemo(() => createRenderers({ tokens, labels, labelReach }), [tokens, labels, labelReach]);
  const shots = useMemo(() => shotsForScene(desc), [desc]);
  const quality = renderQuality();
  const [ready, setReady] = useState(false);
  const [highlightIds, setHighlightIds] = useState<string[]>([]);
  const lastSeq = useRef<number>(-1);
  const timer = useRef<number | undefined>(undefined);
  const playedOverview = useRef(false);
  const playedShot = useRef<string | null>(null);

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
    // A flush that covers a burst (a repair pass, a batch of tool calls) is not
    // one action to point at: pulsing for it keeps a software-GL page drawing
    // for seconds while the burst is still running (FIX-13).
    if (model.ledger.filter((e) => e.seq > lastSeq.current).length > BURST_LEDGER_ENTRIES) {
      lastSeq.current = head;
      return;
    }
    const sceneIds = new Set(desc.entities.map((e) => e.id));
    const found = highlightFromLedger(model, lastSeq.current, sceneIds);
    lastSeq.current = found.seq;
    // Only a change of the highlighted ids renders: an effect that sets a fresh
    // (even empty) array on every ledger step chains a commit per step and
    // trips React's nested-update guard during a repair storm (FIX-13).
    setHighlightIds((prev) =>
      prev.length === found.ids.length && prev.every((id, i) => id === found.ids[i]) ? prev : found.ids,
    );
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

  // §5.4 item 4 — the shot effect. `ready` fires when the kit mounts, before
  // the canvas exists; the rig drops any move requested while it has no
  // controls. So the effect waits for the GL bridge to report controls, then
  // plays overview on first run and ui.shotId afterwards. A shot that is not
  // listed is ignored silently. Each request is issued exactly once: a move in
  // flight is never restarted.
  const controlsReady = useSyncExternalStore(subscribeGl, hasGlControls, () => false);
  const shotId = model.ui.shotId;
  useEffect(() => {
    if (!ready || !controlsReady) return;
    const api = (window as unknown as { __demo3d?: { play(s: string): void; shots: string[] } }).__demo3d;
    if (!api) return;
    let want: string;
    if (!playedOverview.current) {
      playedOverview.current = true;
      want = "overview";
    } else if (shotId === playedShot.current) {
      return;
    } else {
      want = shotId;
    }
    playedShot.current = shotId;
    if (!api.shots.includes(want)) return;
    api.play(want);
  }, [ready, controlsReady, shotId]);

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
