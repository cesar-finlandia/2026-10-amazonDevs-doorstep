// Requirement IDs: HEE-SHOW-01, HEE-SHOW-04
// Replay core unit tests (kit-local copy of tests/hee/showcase-replay-core.test.ts,
// with an inline trace so the kit stays self-contained).
import { describe, expect, it } from "vitest";
import { planReplay } from "../../src/replay/plan.js";
import { createReplayPlayer } from "../../src/replay/player.js";
import type { ReplaySession, TraceLike } from "../../src/replay/types.js";

const TRACE: TraceLike = {
  run_id: "showcase-shelf-run-1",
  started_at: "2026-10-04T12:00:00.000Z",
  entries: [
    { seq: 1, round: 1, kind: "model", name: "planner", source: "agent", ok: true, latency_ms: 900, decision: "list_widgets" },
    { seq: 2, round: 1, kind: "action", name: "get_capabilities", source: "agent", ok: true, latency_ms: 5, args: {} },
    { seq: 3, round: 1, kind: "action", name: "list_widgets", source: "agent", ok: true, latency_ms: 12, args: {} },
    { seq: 4, round: 1, kind: "model", name: "actor", source: "agent", ok: true, latency_ms: 1100, decision: "add_widget" },
    { seq: 5, round: 1, kind: "action", name: "add_widget", source: "agent", ok: true, latency_ms: 15, args: { name: "blue", shelfId: "shelf-a", size: 1 } },
    { seq: 6, round: 2, kind: "approval", name: "move_widget", source: "agent", ok: true, latency_ms: 4500, decision: "approved" },
    { seq: 7, round: 2, kind: "action", name: "move_widget", source: "agent", ok: false, latency_ms: 16, args: { name: "blue", shelfId: "shelf-b" } },
    { seq: 8, round: 2, kind: "action", name: "check_shelves", source: "agent", ok: true, latency_ms: 19 },
  ],
};

function loadTrace(): TraceLike {
  return JSON.parse(JSON.stringify(TRACE)) as TraceLike;
}

interface FakeSession extends ReplaySession {
  calls: { name: string; args: unknown; opts: unknown }[];
  gateLog: boolean[];
}

function fakeSession(okFor: (name: string) => boolean, enabled = true): FakeSession {
  const session = {
    calls: [] as FakeSession["calls"],
    gateLog: [] as boolean[],
    enabled,
    registry: {
      call: async (name: string, args: unknown, opts: { source: "agent" | "human" | "system"; round?: number }) => {
        session.calls.push({ name, args, opts });
        return { ok: okFor(name), summary: `${name} done` };
      },
    },
    gate: {
      setEnabled: (on: boolean): void => {
        session.gateLog.push(on);
        session.enabled = on;
      },
      isEnabled: (): boolean => session.enabled,
    },
  };
  return session;
}

function manualSleeper(): {
  waits: number[];
  sleep: (ms: number) => Promise<void>;
  release: () => void;
  setAuto: (v: boolean) => void;
} {
  const waits: number[] = [];
  let resolvers: (() => void)[] = [];
  let auto = false;
  return {
    waits,
    sleep: (ms: number): Promise<void> => {
      waits.push(ms);
      if (auto) return Promise.resolve();
      return new Promise<void>((r) => resolvers.push(r));
    },
    release: (): void => {
      const rs = resolvers;
      resolvers = [];
      rs.forEach((r) => r());
    },
    setAuto: (v: boolean): void => {
      auto = v;
    },
  };
}

const tick = async (n = 5): Promise<void> => {
  for (let i = 0; i < n; i++) await Promise.resolve();
};

describe("planReplay", () => {
  it("plans the recorded trace: calls, banners, no get_capabilities, closing banner", () => {
    const plan = planReplay(loadTrace());
    expect(plan.map((s) => s.type)).toEqual(["banner", "call", "banner", "call", "banner", "call", "banner"]);
    expect(plan.map((s) => s.seq)).toEqual([1, 3, 4, 5, 6, 7, 8]);
    const calls = plan.filter((s) => s.type === "call");
    expect(calls.map((s) => (s as { name: string }).name)).toEqual(["list_widgets", "add_widget", "move_widget"]);
    expect(calls.map((s) => (s as { recorded_ok: boolean }).recorded_ok)).toEqual([true, true, false]);
    expect(calls.every((s) => (s as { wait_ms: number }).wait_ms === 900)).toBe(true);
    expect(plan[0]).toMatchObject({ type: "banner", text: "Recorded agent step: list_widgets", wait_ms: 500 });
    expect(plan[4]).toMatchObject({
      type: "banner",
      text: "Recorded: a human approved the action move_widget.",
      wait_ms: 1200,
    });
    expect(plan[6]).toMatchObject({
      type: "banner",
      text: "Recorded run continues beyond this point; replay stops here.",
    });
  });

  it("a rejected approval declaims and entries run in seq order", () => {
    const trace = loadTrace();
    trace.entries.push({
      seq: 0,
      round: 0,
      kind: "approval",
      name: "remove_widget",
      source: "agent",
      ok: true,
      latency_ms: 1,
      decision: "rejected",
    });
    const plan = planReplay(trace);
    expect(plan[0]).toMatchObject({
      type: "banner",
      seq: 0,
      text: "Recorded: a human declined the action remove_widget.",
    });
  });
});

describe("createReplayPlayer", () => {
  const matching = (name: string): boolean => name !== "move_widget";

  it("plays in order with source agent, divides waits by speed, restores the gate, ends done", async () => {
    const s = manualSleeper();
    s.setAuto(true);
    const session = fakeSession(matching);
    const banners: string[] = [];
    const states: string[] = [];
    const player = createReplayPlayer({
      session,
      trace: loadTrace(),
      speed: 4,
      sleep: s.sleep,
      onBanner: (t) => banners.push(t),
      onState: (st) => states.push(st.status),
    });
    const final = await player.play();
    expect(session.calls.map((c) => c.name)).toEqual(["list_widgets", "add_widget", "move_widget"]);
    for (const c of session.calls) expect((c.opts as { source: string }).source).toBe("agent");
    expect(session.calls.map((c) => (c.opts as { round: number }).round)).toEqual([1, 1, 2]);
    expect(s.waits).toEqual([500, 900, 500, 900, 1200, 900, 1200].map((w) => w / 4));
    expect(banners).toHaveLength(4);
    expect(banners[3]).toBe("Recorded run continues beyond this point; replay stops here.");
    expect(session.gateLog).toEqual([false, true]);
    expect(session.enabled).toBe(true);
    expect(final.status).toBe("done");
    expect(final.message).toBe("Replay finished. Nothing above was live.");
    expect(states[0]).toBe("playing");
    expect(states[states.length - 1]).toBe("done");
  });

  it("reports diverged with the exact message and restores the gate", async () => {
    const s = manualSleeper();
    s.setAuto(true);
    const session = fakeSession(() => false);
    const player = createReplayPlayer({ session, trace: loadTrace(), sleep: s.sleep });
    const final = await player.play();
    expect(final.status).toBe("diverged");
    expect(final.message).toBe(
      "Replay diverged at step 2: the live application answered differently from the recording.",
    );
    expect(session.calls.map((c) => c.name)).toEqual(["list_widgets"]);
    expect(session.gateLog).toEqual([false, true]);
  });

  it("pause and resume hold and release at step boundaries", async () => {
    const s = manualSleeper();
    const session = fakeSession(matching);
    const player = createReplayPlayer({ session, trace: loadTrace(), sleep: s.sleep });
    const pending = player.play();
    player.pause();
    s.release();
    await tick(10);
    expect(player.state().status).toBe("paused");
    const held = session.calls.length;
    s.release();
    await tick(10);
    expect(player.state().status).toBe("paused");
    expect(session.calls.length).toBe(held);
    player.resume();
    s.setAuto(true);
    s.release();
    const final = await pending;
    expect(final.status).toBe("done");
    expect(session.enabled).toBe(true);
  });

  it("pause, resume and stop are idempotent; stop freezes and restores the gate", async () => {
    const s = manualSleeper();
    const session = fakeSession(matching);
    const player = createReplayPlayer({ session, trace: loadTrace(), sleep: s.sleep });
    player.pause();
    player.resume();
    player.stop();
    expect(player.state().status).toBe("idle");
    const pending = player.play();
    await tick();
    player.stop();
    player.stop();
    player.pause();
    s.release();
    const final = await pending;
    expect(final.status).toBe("stopped");
    expect(session.calls.length).toBeLessThan(3);
    expect(session.gateLog).toEqual([false, true]);
  });

  it("restores a gate that starts disabled", async () => {
    const s = manualSleeper();
    s.setAuto(true);
    const session = fakeSession(matching, false);
    const player = createReplayPlayer({ session, trace: loadTrace(), sleep: s.sleep });
    await player.play();
    expect(session.gateLog).toEqual([false, false]);
    expect(session.enabled).toBe(false);
  });
});
