// scripts/verify/sb-08-capture.ts — DP-SUBMISSION WU-08 (10 checks).
// Requirement IDs: FR-25 (part)
// Replays the demo scenario against a local golden server and keeps the
// driver's video + per-step screenshots as evidence. Performs the capture,
// then verifies it.
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { createChecker } from "./ui-kit.js";
import { run } from "./e2e-kit.js";
import { toCaptureScript } from "../make-capture-script.js";
import { readDemoScenario } from "../../hee/src/showcase/scenario.js";

const c = createChecker("sb-08-capture");
const CAPDIR = "design_documents/submission/capture";

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function listenersOn(port: number): number[] {
  try {
    const r = spawnSync(
      "powershell",
      ["-NoProfile", "-NonInteractive", "-Command", `Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique`],
      { encoding: "utf8", shell: false },
    );
    return `${r.stdout ?? ""}`.split(/[\r\n\s]+/).map((s) => Number(s)).filter((n) => Number.isInteger(n) && n > 0);
  } catch {
    return [];
  }
}

function killPort(port: number): void {
  for (const pid of listenersOn(port)) {
    try {
      spawnSync("taskkill", ["/F", "/PID", String(pid)], { shell: true });
    } catch { /* ignore */ }
  }
}

// 0. Build the capture script for a fixed local port.
const PORT = 44301;
mkdirSync(CAPDIR, { recursive: true });
const scenario = readDemoScenario("design_documents/demo-scenario.json");
const { script, notes } = toCaptureScript(scenario, `http://127.0.0.1:${PORT}`);
writeFileSync(join(CAPDIR, "capture-script.json"), JSON.stringify(script, null, 2) + "\n", "utf8");
console.log(`capture script: ${(script.steps as unknown[]).length} steps`);

// 1. Capture script validates.
const valid = run("npx", ["vite-node", "src/ideation/demodrive/cli.ts", "validate", "--script", `${CAPDIR}/capture-script.json`]);
c.ok(valid.code === 0, "capture script validates");

// 2. Step ids equal the scenario's, in order.
const scriptJson = JSON.parse(readFileSync(join(CAPDIR, "capture-script.json"), "utf8")) as { steps?: { id?: string }[] };
const scenIds = (scenario.steps as { id: string }[]).map((s) => s.id);
c.ok(JSON.stringify((scriptJson.steps ?? []).map((s) => s.id)) === JSON.stringify(scenIds), "step ids match scenario");

// 3. data_source + base_url shape.
const ds = JSON.parse(readFileSync(join(CAPDIR, "capture-script.json"), "utf8")) as {
  data_source?: { kind?: string; cache_key?: string; mock_script?: null };
  base_url?: string;
};
c.ok(
  ds.data_source?.kind === "cache" && ds.data_source?.cache_key === "doorstep-meta" && ds.data_source?.mock_script === null &&
    (ds.base_url ?? "").startsWith("http://127.0.0.1:"),
  "data_source cache/doorstep-meta, local base",
);

// Start the golden server in-call (background jobs do not survive tool calls).
killPort(PORT);
const child = spawn("npx", ["vite-node", "src/server/index.ts"], {
  cwd: process.cwd(),
  shell: true,
  env: { ...process.env, PORT: String(PORT), AGENT_PROVIDER: "golden", BUILD_MARKER: "capture", ALLOW_SIMULATE: "1" },
});
const base = `http://127.0.0.1:${PORT}`;
let started = false;
try {
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    await sleep(500);
    try {
      const res = await fetch(`${base}/health`, { signal: AbortSignal.timeout(3000) });
      if (res.ok) {
        const j = (await res.json()) as { ok?: boolean };
        if (j.ok === true) { started = true; break; }
      }
    } catch { /* retry */ }
  }
  if (!started) {
    c.ok(false, "local golden server starts");
  } else {
    // 4-6. Capture; expect the cache_miss feeder warning.
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const runDir = join(CAPDIR, "run", stamp);
    // One run remains: clear older timestamped folders first.
    try {
      for (const e of readdirSync(join(CAPDIR, "run"), { withFileTypes: true })) {
        if (e.isDirectory()) rmSync(join(CAPDIR, "run", e.name), { recursive: true, force: true });
      }
    } catch { /* ignore */ }
    const cap = spawnSync("npx", ["vite-node", "src/ideation/demodrive/cli.ts", "capture", "--script", `${CAPDIR}/capture-script.json`, "--data-source", "cache", "--cache-key", "doorstep-meta", "--out", runDir], {
      cwd: process.cwd(), encoding: "utf8", shell: true, timeout: 600000,
    });
    const capOut = `${cap.stdout ?? ""}${cap.stderr ?? ""}`;
    console.log(capOut.split("\n").filter((l) => /cache_miss|error|Error|Failed|OK|done|warn/i.test(l)).slice(0, 10).join("\n"));
    c.ok(cap.status === 0, `capture exits 0 (status ${cap.status ?? "?"})`);

    // Status read + server stop + run record.
    let kind = "";
    let mode = "";
    try {
      const st = (await (await fetch(`${base}/api/status`, { signal: AbortSignal.timeout(10000) })).json()) as {
        agent?: { kind?: string }; ring?: { mode?: string };
      };
      kind = st.agent?.kind ?? "";
      mode = st.ring?.mode ?? "";
    } catch { /* ignore */ }
    try { child.kill("SIGTERM"); } catch { /* ignore */ }
    await sleep(1000);
    killPort(PORT);

    // The driver nests one run-id folder under --out; resolve it.
    let folder = runDir;
    try {
      const subs = readdirSync(runDir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
      if (subs.length === 1) folder = join(runDir, subs[0] as string);
    } catch { /* ignore */ }

    let videoBytes = 0;
    let videoKept = true;
    const videoPath = join(folder, "video.webm");
    try {
      videoBytes = statSync(videoPath).size;
      if (videoBytes > 15 * 1024 * 1024) {
        rmSync(videoPath, { force: true });
        videoKept = false;
      }
    } catch {
      videoBytes = 0;
      videoKept = false;
    }
    const runJson = {
      base, dir: `run/${stamp}${folder !== runDir ? `/${folder.slice(runDir.length + 1)}` : ""}`, steps: scenIds, videoKept, videoBytes,
      agentKind: kind, ringMode: mode,
      expectedWarning: capOut.includes("cache_miss: key doorstep-meta"),
      notes,
    };
    writeFileSync(join(CAPDIR, "capture-run.json"), JSON.stringify(runJson, null, 2) + "\n", "utf8");

    // 5. Screenshots per step, no driver error file.
    const missing = scenIds.filter((id) => !existsSync(join(folder, id, "screenshot.png")));
    c.ok(missing.length === 0 && !existsSync(join(folder, "demodrive-error.json")) && !existsSync(join(runDir, "demodrive-error.json")), `screenshots per step (${missing.join(",") || "all"})`);

    // 6. Expected feeder warning recorded.
    c.ok(capOut.includes("cache_miss: key doorstep-meta") && runJson.expectedWarning === true, "cache_miss warning expected+recorded");

    // 7. Status said golden + bundle.
    c.ok(kind === "golden" && mode === "bundle", `status golden/bundle (got ${kind}/${mode})`);

    // 8. Approve differs from review; week not blank.
    let shotsOk = false;
    try {
      const ra = readFileSync(join(folder, "approve", "screenshot.png"));
      const rb = readFileSync(join(folder, "review", "screenshot.png"));
      const rw = readFileSync(join(folder, "week", "screenshot.png"));
      shotsOk = !ra.equals(rb) && rw.length > 20000;
    } catch { shotsOk = false; }
    c.ok(shotsOk, "approve≠review, week>20KB");

    // 9. Video kept or size-recorded above 15 MB.
    c.ok((videoKept && videoBytes > 0) || (!videoKept && videoBytes > 15 * 1024 * 1024), `video kept=${videoKept} bytes=${videoBytes}`);

    // 10. Notes list drops; server stopped.
    let stopped = false;
    try {
      await fetch(`${base}/health`, { signal: AbortSignal.timeout(3000) });
    } catch {
      stopped = true;
    }
    const notesOk = Array.isArray(runJson.notes);
    c.ok(notesOk && stopped, `notes listed (${notes.length}), server stopped`);
  }
} finally {
  try { child.kill("SIGKILL"); } catch { /* ignore */ }
  killPort(PORT);
}

c.done();
