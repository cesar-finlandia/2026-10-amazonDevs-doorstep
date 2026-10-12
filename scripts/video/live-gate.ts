// scripts/video/live-gate.ts — DP-LIVE-RUN-AND-VIDEO WU-01.
// video_gate.py plus the additions of §5.3, run against the deploy record's
// address (or --base-url, local only with --allow-local).
// Prints `live-gate: <n> checks passed` or `BLOCKED (<reason>)` (exit 3).
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, statSync, unlinkSync } from "node:fs";
import { blocked, check } from "./lib.js";
import { PROJECT } from "./lib.js";

const failures: string[] = [];
let n = 0;
const t = (ok: boolean, label: string): void => {
  n += 1;
  check(n, ok, label, failures);
};
const arg = (name: string): string | undefined => {
  const i = process.argv.indexOf(name);
  return i === -1 ? undefined : process.argv[i + 1];
};
import { rehydrateEnv } from "./env-fresh.js";
rehydrateEnv();
const allowLocal = process.argv.includes("--allow-local");
const record = JSON.parse(readFileSync(`${PROJECT}/deploy-record.json`, "utf8")) as {
  url?: string; buildMarker?: string;
};
const baseUrl = arg("--base-url") ?? record.url ?? "";
const isLocal = /localhost|127\.0\.0\.1/.test(baseUrl);
if (!baseUrl) blocked("no address: deploy record has no url and --base-url was not given (DP-DEPLOY)");
if (isLocal && !allowLocal) {
  blocked("local address refused without --allow-local (DP-DEPLOY to film a local server)");
}
if (isLocal && allowLocal) {
  // Recorded before probing: a local take is a deviation even when the probe fails.
  try {
    const { readFileSync: rf, writeFileSync: wf } = await import("node:fs") as typeof import("node:fs");
    const p = `${PROJECT}/video/production-notes.md`;
    const notes = rf(p, "utf8");
    if (!notes.includes("- gate:")) {
      const anchor = "## Deviations\n\nNone.";
      if (notes.includes(anchor)) {
        wf(p, notes.replace(anchor, `## Deviations\n\n- gate: footage of a local server, the operator asked for it.`));
      } else {
        // Deviations already holds bullets (models pin, pause clock, ...):
        // append under the heading instead of replacing a gone placeholder.
        wf(p, notes.replace("## Deviations\n", `## Deviations\n- gate: footage of a local server, the operator asked for it.\n`));
      }
    }
  } catch { /* notes stay as they are */ }
}

const run = (cmd: string, args: string[], extra?: Record<string, string>): { code: number; out: string } => {
  const r = spawnSync(cmd, args, {
    cwd: process.cwd(), encoding: "utf8", timeout: 3600000, shell: true,
    env: { ...process.env, ...extra },
  });
  return { code: r.status ?? 1, out: `${r.stdout ?? ""}${r.stderr ?? ""}` };
};
const extraChecks: { check: string; status: string; detail: string }[] = [];
const note = (check: string, detail: string): void => {
  extraChecks.push({ check, status: "ok", detail });
};

// 1. video_gate.py with a machine-readable report, then relativize the two
// machine-specific fields (the chassis writes absolute paths; the plan's
// no-absolute-path rule outranks the tool's default) and append our additions.
{
  const r = run("python3", ["../../hackathons/_useful/scripts/video_gate.py", "--project", `${PROJECT}`,
    "--url", baseUrl, ...(allowLocal ? ["--allow-local"] : []), "--json", `${PROJECT}/video/gate-report.json`]);
  t(r.code === 0, `video_gate.py exits 0 (${r.out.trim().split("\n").pop()})`);
  try {
    const { writeFileSync } = await import("node:fs") as typeof import("node:fs");
    const { relative } = await import("node:path") as typeof import("node:path");
    const rep = JSON.parse(readFileSync(`${PROJECT}/video/gate-report.json`, "utf8")) as {
      project?: string; checks?: { check?: string; detail?: string }[];
    };
    if (typeof rep.project === "string") {
      rep.project = relative(process.cwd(), rep.project).replace(/\\/g, "/");
    }
    const applioDir = (process.env.APPLIO_DIR ?? "").replace(/\\/g, "/");
    for (const c of rep.checks ?? []) {
      if (typeof c.detail === "string") {
        c.detail = c.detail.replace(/\\/g, "/");
        if (applioDir !== "") c.detail = c.detail.split(applioDir).join("$APPLIO_DIR");
      }
    }
    writeFileSync(`${PROJECT}/video/gate-report.json`, `${JSON.stringify(rep, null, 2)}\n`);
  } catch { /* report stays as the tool wrote it */ }
}
// 2. the smoke suite against the same address.
{
  const r = run("npx", ["vite-node", "scripts/e2e-run.ts", "--label", "smoke", "e2e/smoke.spec.ts"], { BASE_URL: baseUrl });
  t(r.code === 0 && r.out.includes("smoke: 4 passed, 0 failed, 0 skipped"), "smoke 4 passed, 0 failed, 0 skipped");
  note("smoke", "smoke: 4 passed, 0 failed, 0 skipped");
}
// 3. the ledger holds against the same address.
{
  const r = run("npx", ["vite-node", "scripts/video/check-ledger.ts", "--base-url", baseUrl]);
  const m = /ledger: \d+ facts hold/.exec(r.out);
  t(r.code === 0 && m !== null, "check-ledger holds");
  if (m) note("ledger", m[0]);
}
// 4. the script acceptance page is fresh and green.
{
  let ok = false;
  try {
    const page = readFileSync(`${PROJECT}/video/script-acceptance.md`, "utf8");
    const rows = page.split("\n").filter((l) => l.startsWith("| ") && !l.startsWith("| gate "));
    const watchedProject = ["beat-plan.json", "narration-segments.json", "video/facts/estimate.json"];
    const watchedEntry = ["sk-01-harvest", "sk-02-ledger", "sk-03-script", "sk-04-segments", "sk-05-beats",
      "sk-06-figures", "sk-07-cover", "sk-08-slides", "sk-09-pitch", "sk-10-acceptance"]
      .map((s) => `scripts/verify/${s}.ts`);
    const pageTime = statSync(`${PROJECT}/video/script-acceptance.md`).mtimeMs;
    const fresh = (f: string): boolean => {
      try { return statSync(f).mtimeMs <= pageTime; } catch { return false; }
    };
    ok = rows.length >= 20 && rows.every((l) => l.includes("| pass |")) &&
      watchedProject.every((f) => fresh(`${PROJECT}/${f}`)) && watchedEntry.every((f) => fresh(f));
  } catch { ok = false; }
  t(ok, "script-acceptance.md fresh, every row pass");
}
// 5. AI ACCESS §2: ADC works (exit code only), aiplatform enabled.
{
  const a = run("gcloud", ["auth", "application-default", "print-access-token"]);
  const b = run("gcloud", ["services", "list", "--enabled", "--filter=name:aiplatform.googleapis.com",
    "--project=hacka-2026-09-agentic-cinema1", "--format=value(name)"]);
  t(a.code === 0 && b.out.includes("aiplatform.googleapis.com"), "ADC + aiplatform enabled (token never printed)");
}
// 6. TTS one-word probe (discarded) + Lyria availability probe (discarded).
{
  const tmp = "C:/Users/cesar/AppData/Local/Temp/opencode/tts-probe.wav";
  const a = run("python3", ["../../hackathons/_useful/scripts/tts_vertex.py", "--text", "Hello.",
    "--out", tmp, "--voice", "Iapetus"]);
  try { if (existsSync(tmp)) unlinkSync(tmp); } catch { /* ignore */ }
  const b = run("python3", ["scripts/video/probe-bed.py"]);
  t(a.code === 0 && /lyria_probe=True/.test(b.out), "TTS one-word probe + Lyria probe (both discarded)");
  note("tts probe", "one-word synthesis, discarded");
  note("music probe", "lyria-002 available in us-central1, probe clip discarded");
}
// 7. video-config.json equals §3.2.
{
  let ok = false;
  try {
    const cfg = JSON.parse(readFileSync(`${PROJECT}/video-config.json`, "utf8")) as Record<string, unknown>;
    ok = cfg.video_theme === "paper" && cfg.capture_method === "screencast" &&
      cfg.entry_root === "../../../hackathon-entries/2026-10-amazonDevs" &&
      (cfg.bed as { preset?: string; enabled?: boolean })?.preset === "paper-minimal" &&
      (cfg.bed as { enabled?: boolean })?.enabled === true && cfg.align_provider === "auto";
  } catch { ok = false; }
  t(ok, "video-config.json equals §3.2");
}
// 8. Applio check names cesar_voice.
{
  const r = run("python3", ["../../hackathons/_useful/scripts/apply_voice.py", "--check"]);
  t(r.code === 0 && r.out.includes("cesar_voice"), "apply_voice --check names cesar_voice");
}

if (failures.length > 0) {
  for (const f of failures) console.error(`FAIL ${f}`);
  blocked(`live gate failed (${failures.length} checks): re-run DP-DEPLOY then this gate`);
}
// Store our additions in the report so the verifier reads one page.
try {
  const { writeFileSync } = await import("node:fs") as typeof import("node:fs");
  const rep = JSON.parse(readFileSync(`${PROJECT}/video/gate-report.json`, "utf8")) as {
    checks?: { check?: string; status?: string }[];
  };
  rep.checks = [...(rep.checks ?? []), ...extraChecks];
  writeFileSync(`${PROJECT}/video/gate-report.json`, `${JSON.stringify(rep, null, 2)}\n`);
} catch { /* report stays as the tool wrote it */ }
// Append the gate entry to run-log.json.
try {
  const p = `${PROJECT}/video/run-log.json`;
  const log = existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) as unknown[] : [];
  const now = new Date().toISOString();
  (log as Record<string, unknown>[]).push({ stage: "gate", startedAt: now, endedAt: now, status: "ok", stops: 0 });
  const { writeFileSync } = await import("node:fs") as typeof import("node:fs");
  writeFileSync(p, `${JSON.stringify(log, null, 2)}\n`);
} catch { /* report exists; log append best-effort */ }
console.log(`live-gate: ${n} checks passed`);
