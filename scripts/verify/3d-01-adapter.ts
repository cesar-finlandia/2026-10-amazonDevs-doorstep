// scripts/verify/3d-01-adapter.ts — DP-3D WU-3D-01 (15 checks).
// Pure Node, no browser. Builds demoSeed(), cleanSeed() and the empty week,
// plus the loaded sample week (demoSeed + the three ingest_ring_events calls
// the UI's "Load the sample week" performs, via the bundle Ring port).
//
// DEVIATION on checks 9, 11, 12, 13: the plan names demoSeed() throughout,
// but the raw seeds display an empty review week (verified: weekRibbon of
// demoSeed() has 0 ticks and 0 visits in days 7–13; cleanSeed() has ticks and
// visits but zero duplicate ticks and zero candidates), so the duplicate,
// first-pillar, flagged-pillar and outage assertions cannot be satisfied by
// them. Those assertions run against the loaded sample week instead — the same
// model every browser test below exercises. Equalities that hold on the raw
// seeds are still asserted on the raw seeds.
import { existsSync, readFileSync } from "node:fs";
import type { WeekModel } from "src/domain/types.js";
import { demoSeed, cleanSeed } from "src/domain/seed.js";
import { weekRibbon } from "src/domain/derive.js";
import { candidateIncidents } from "src/domain/rules.js";
import { createAppSession } from "src/agent/app-session.js";
import { createBundleRingPort } from "src/domain/bundle-ring-port.js";
import { buildBundle } from "src/domain/generator.js";
import { validateSceneDescription } from "src/kits/three-scene/src/react/index.js";
import type { SceneEntity } from "src/kits/three-scene/src/react/index.js";
import { BOUNDS, dayX, minuteZ, pillarHeight } from "src/3d/layout.js";
import { LOOK } from "src/3d/look.js";
import { MATERIAL_TOKENS, SCENE_NAME, toSceneDescription } from "src/3d/adapter.js";
import { createChecker } from "./ui-kit.js";

const c = createChecker("3d-01-adapter");

const byId = (entities: SceneEntity[]): Map<string, SceneEntity> =>
  new Map(entities.map((e) => [e.id, e]));

// 1. The kit is installed as shipped.
{
  c.ok(
    existsSync("src/kits/three-scene/src/react/index.ts") &&
      existsSync("src/kits/three-scene/src/core/scene-description.ts") &&
      existsSync("src/kits/three-scene/UPSTREAM-NOTICE.md"),
    "1 kit entry, scene-description and upstream notice exist",
  );
}

// 2. The kit's dependencies are pinned without a range prefix.
{
  const pkg = JSON.parse(readFileSync("package.json", "utf8")) as {
    dependencies: Record<string, string>;
    devDependencies: Record<string, string>;
  };
  const want: [string, string][] = [
    ["three", "0.186.1"],
    ["@react-three/fiber", "9.8.1"],
    ["@react-three/drei", "10.7.9"],
    ["@react-three/postprocessing", "3.1.3"],
    ["postprocessing", "6.39.5"],
    ["leva", "0.10.1"],
  ];
  const depsOk = want.every(([k, v]) => pkg.dependencies[k] === v);
  c.ok(depsOk && pkg.devDependencies["@types/three"] === "0.186.0", "2 kit dependencies pinned exactly");
}

// The three raw models, and the loaded sample week.
const demo = demoSeed();
const clean = cleanSeed();
const empty: WeekModel = { ...demoSeed(), events: [], visits: [] };
const loaded = await (async (): Promise<WeekModel> => {
  const session = createAppSession({ ring: createBundleRingPort(buildBundle()) });
  await session.call("ingest_ring_events", { source: "webhook_inbox" }, { source: "human" });
  await session.call("ingest_ring_events", { source: "history", deviceId: "dev-door" }, { source: "human" });
  await session.call("ingest_ring_events", { source: "history", deviceId: "dev-elite" }, { source: "human" });
  return session.store.getState();
})();
const demoScene = toSceneDescription(demo);
const cleanScene = toSceneDescription(clean);
const emptyScene = toSceneDescription(empty);
const loadedScene = toSceneDescription(loaded);

// 3. Every scene validates.
{
  c.ok(
    validateSceneDescription(demoScene).ok === true &&
      validateSceneDescription(cleanScene).ok === true &&
      validateSceneDescription(emptyScene).ok === true &&
      validateSceneDescription(loadedScene).ok === true,
    "3 demo, clean, empty and loaded scenes validate",
  );
}

// 4. At least 10 entities each; the empty week has no tick/duplicate/routine/visit entities.
{
  const emptyIds = emptyScene.entities.map((e) => e.id);
  c.ok(
    demoScene.entities.length >= 10 && cleanScene.entities.length >= 10 && emptyScene.entities.length >= 10 &&
      !emptyIds.includes("ticks") && !emptyIds.includes("dups") && !emptyIds.includes("visits-routine") &&
      emptyIds.every((id) => !id.startsWith("vis:")),
    "4 scenes have 10+ entities and the empty week omits tick groups and pillars",
  );
}

// 5. Every demo-scene id matches the WU-01 pattern.
{
  const re =
    /^(door-wall|door|door-frame-left|door-frame-right|door-lintel|stoop|stoop-step|day:[0-6]|quiet:[0-6]:\d+|vis:\d+|visits-routine|ticks|dups|outage:[\w-]+:[0-6]:\d+|seam:[0-6]|dev-[\w-]+)$/;
  c.ok(demoScene.entities.every((e) => re.test(e.id)), "5 demo ids match the WU-01 pattern");
}

// 6. The seven door and stoop rows equal §5.1 literally.
{
  const m = byId(demoScene.entities);
  const want: [string, [number, number, number], [number, number, number], string][] = [
    ["door-wall", [0, 1.6, -0.5], [13, 3.2, 0.3], "wall"],
    ["door", [0, 1.25, -0.3], [1.3, 2.5, 0.12], "door"],
    ["door-frame-left", [-0.75, 1.3, -0.32], [0.2, 2.6, 0.2], "door"],
    ["door-frame-right", [0.75, 1.3, -0.32], [0.2, 2.6, 0.2], "door"],
    ["door-lintel", [0, 2.65, -0.32], [1.7, 0.2, 0.2], "door"],
    ["stoop", [0, 0.15, 0.35], [3.0, 0.3, 1.4], "stoop"],
    ["stoop-step", [0, 0.075, 1.3], [3.0, 0.15, 0.5], "stoop"],
  ];
  c.ok(
    want.every(([id, position, size, token]) => {
      const e = m.get(id);
      return (
        e?.kind === "box" &&
        JSON.stringify(e.position) === JSON.stringify(position) &&
        JSON.stringify(e.size) === JSON.stringify(size) &&
        (e.material as { token: string }).token === token
      );
    }),
    "6 door and stoop rows equal the literal table",
  );
}

// 7. The seven day strips.
{
  const days = demoScene.entities.filter((e) => e.id.startsWith("day:"));
  const labels = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
  c.ok(
    days.length === 7 &&
      days.every((e, i) => {
        const n = Number(e.id.slice(4));
        return (
          n === i &&
          JSON.stringify(e.position) === JSON.stringify([(i - 3) * 1.6, 0.02, 5.6]) &&
          JSON.stringify(e.size) === JSON.stringify([1.4, 0.04, 8]) &&
          e.label === labels[i]
        );
      }),
    "7 seven day strips with positions, sizes and weekday labels",
  );
}

// 8. One frustum per snapshot device.
{
  const frustums = demoScene.entities.filter((e) => e.id.startsWith("dev-"));
  const snap = demo.devices.filter((d) => d.snapshot);
  c.ok(
    frustums.length === snap.length &&
      frustums.every((e, i) => {
        const d = snap[i] as { id: string; online: boolean; description: string };
        const meta = e.meta as Record<string, unknown>;
        return (
          e.kind === "custom" &&
          (e as { customKey?: string }).customKey === "camera-frustum" &&
          meta["deviceId"] === d.id &&
          meta["online"] === d.online &&
          e.position[0] === (i - (snap.length - 1) / 2) * 1.6
        );
      }),
    "8 one camera-frustum entity per snapshot device with device meta",
  );
}

// 9. Ticks and duplicates. Raw seeds carry no review-week ticks, so the counts
// are asserted on the seeds (all zero, entities omitted) and the content —
// including the "(at least 1)" duplicate case and the first-tick position —
// on the loaded sample week (see the deviation note at the top).
{
  const ribbon = weekRibbon(loaded);
  const expectTicks = ribbon.reduce((n, d) => n + d.ticks.length, 0);
  const expectDups = ribbon.reduce((n, d) => n + d.ticks.filter((t) => t.duplicate).length, 0);
  const lm = byId(loadedScene.entities);
  const ticks = lm.get("ticks");
  const dups = lm.get("dups");
  const firstDay = ribbon.find((d) => d.ticks.length > 0);
  const firstTick = firstDay?.ticks[0];
  c.ok(
    expectTicks > 0 &&
      (ticks?.instances?.length ?? -1) === expectTicks &&
      expectDups >= 1 &&
      (dups?.instances?.length ?? -1) === expectDups &&
      firstDay !== undefined &&
      firstTick !== undefined &&
      JSON.stringify(ticks?.instances?.[0]?.position) ===
        JSON.stringify([dayX(firstDay.dayIndex) - 0.45, 0.05, minuteZ(firstTick.minute)]) &&
      byId(demoScene.entities).get("ticks") === undefined &&
      byId(demoScene.entities).get("dups") === undefined,
    "9 tick and duplicate counts match the ribbon with duplicates present",
  );
}

// 10. Routine and non-routine visits add up (cleanSeed's displayed week is full).
{
  const ribbon = weekRibbon(clean);
  const plain = ribbon.reduce((n, d) => n + d.visits.filter((v) => v.routineId === undefined).length, 0);
  const withRoutine = ribbon.reduce((n, d) => n + d.visits.filter((v) => v.routineId !== undefined).length, 0);
  const cm = byId(cleanScene.entities);
  const visCount = cleanScene.entities.filter((e) => e.id.startsWith("vis:")).length;
  c.ok(
    plain > 0 && withRoutine > 0 &&
      visCount === plain &&
      (cm.get("visits-routine")?.instances?.length ?? -1) === withRoutine &&
      visCount + (cm.get("visits-routine")?.instances?.length ?? -1) === plain + withRoutine,
    "10 visit pillars and routine instances partition the ribbon visits",
  );
}

// 11. First-pillar geometry and the height rule (cleanSeed's first pillar).
{
  const first = cleanScene.entities.find((e) => e.id.startsWith("vis:"));
  const ribbon = weekRibbon(clean);
  const firstDay = ribbon.find((d) => d.visits.some((v) => v.routineId === undefined));
  const firstVisit = firstDay?.visits.find((v) => v.routineId === undefined);
  const dwell = (firstVisit?.toMin ?? 0) - (firstVisit?.fromMin ?? 0);
  const h = pillarHeight(dwell);
  c.ok(
    first !== undefined && firstVisit !== undefined && firstDay !== undefined &&
      first.position[0] === dayX(firstDay.dayIndex) + 0.2 &&
      first.position[1] === first.size[1] / 2 &&
      first.size[1] === h &&
      first.position[2] === minuteZ((firstVisit.fromMin + firstVisit.toMin) / 2) &&
      pillarHeight(0) === 0.5 && pillarHeight(5) === 0.95 && pillarHeight(30) === 3,
    "11 first pillar geometry and the pillarHeight rule",
  );
}

// 12. Flagged pillars (loaded week: the Tue linger is a quiet_hours_activity).
{
  const cands = candidateIncidents(loaded);
  const visits = new Map(loaded.visits.map((v) => [v.id, v]));
  const lm = byId(loadedScene.entities);
  const pillars = loadedScene.entities.filter((e) => e.id.startsWith("vis:"));
  const ok = cands.every((cand) => {
    if (cand.kind !== "quiet_hours_activity" && cand.kind !== "long_dwell") return true;
    const visit = [...visits.values()].find((v) => cand.eventIds.some((id) => v.eventIds.includes(id)));
    if (!visit) return false;
    const e = lm.get(visit.id);
    const meta = e?.meta as Record<string, unknown> | undefined;
    const want = cand.kind === "quiet_hours_activity" ? ["pillar-danger", "quiet"] : ["pillar-warn", "dwell"];
    return (e?.material as { token: string })?.token === want[0] && meta?.["flag"] === want[1];
  });
  const rest = pillars.every((e) => {
    const meta = e.meta as Record<string, unknown>;
    const flagged = cands.some(
      (cand) =>
        (cand.kind === "quiet_hours_activity" || cand.kind === "long_dwell") &&
        cand.eventIds.some((id) => (visits.get(String(meta["visitId"]))?.eventIds ?? []).includes(id)),
    );
    return flagged || ((e.material as { token: string }).token === "pillar" && meta["flag"] === "none");
  });
  c.ok(
    cands.some((x) => x.kind === "quiet_hours_activity") && ok && rest,
    "12 quiet pillars danger, dwell pillars warn, the rest plain",
  );
}

// 13. Outages and the history seam (loaded week: one 47 min outage, one seam).
{
  const ribbon = weekRibbon(loaded);
  const expectOutages = ribbon.reduce((n, d) => n + d.outages.length, 0);
  const outages = loadedScene.entities.filter((e) => e.id.startsWith("outage:"));
  const seamDays = ribbon.filter((d) => d.seamMinute !== null);
  const seams = loadedScene.entities.filter((e) => e.id.startsWith("seam:"));
  c.ok(
    expectOutages === outages.length &&
      outages.every((e) => {
        const meta = e.meta as Record<string, number>;
        return (e.material as { token: string }).token === "gap" &&
          ((e.material as { opacity?: number }).opacity ?? 1) < 1 &&
          Math.abs(e.size[2] - ((meta["minutes"] as number) / 1440) * 8) < 1e-9;
      }) &&
      seamDays.length === 1 &&
      seams.length === 1 &&
      seams[0]?.label === "from history" &&
      Math.abs((seams[0]?.position[2] ?? -1) - minuteZ(seamDays[0]?.seamMinute ?? -1)) < 1e-9,
    "13 outage rows match and exactly one history seam exists",
  );
}

// 14. Determinism and purity.
{
  const before = JSON.stringify(demo);
  const a = JSON.stringify(toSceneDescription(demo));
  const b = JSON.stringify(toSceneDescription(demo, 0));
  const after = JSON.stringify(demo);
  const sources = readFileSync("src/3d/adapter.ts", "utf8") + readFileSync("src/3d/layout.ts", "utf8");
  const stripped = sources.replace(/\/\/[^\n]*/g, "");
  c.ok(
    a === b && before === after &&
      !stripped.includes("Math.random") && !stripped.includes("Date.now") &&
      !stripped.includes("new Date") && !stripped.includes("performance.now"),
    "14 same model gives the same scene without touching the model or impure sources",
  );
}

// 15. Bounds, containment and the revision argument.
{
  const inside = (p: readonly [number, number, number]): boolean =>
    p[0] >= BOUNDS.min[0] && p[0] <= BOUNDS.max[0] &&
    p[1] >= BOUNDS.min[1] && p[1] <= BOUNDS.max[1] &&
    p[2] >= BOUNDS.min[2] && p[2] <= BOUNDS.max[2];
  c.ok(
    JSON.stringify(demoScene.bounds) === JSON.stringify({ min: [-6.5, 0, -1.0], max: [6.5, 3.6, 10.0] }) &&
      demoScene.entities.every((e) => inside(e.position)) &&
      demoScene.revision === 0 &&
      toSceneDescription(demo, 7).revision === 7 &&
      SCENE_NAME === "doorway-week" &&
      JSON.stringify(MATERIAL_TOKENS) ===
        JSON.stringify(["wall", "door", "stoop", "frustum", "pillar", "pillar-warn", "pillar-danger", "pillar-dup", "gap", "resolved", "arc"]) &&
      Object.keys(LOOK).length === MATERIAL_TOKENS.length,
    "15 bounds, containment, revision and token table",
  );
}

c.done();
