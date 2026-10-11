// scripts/verify/lv-01-gate.ts — DP-LIVE-RUN-AND-VIDEO WU-LIVE-01 (12 checks).
// No footage is made against a dead deploy, a stale script, a missing tool,
// a missing voice or a banned word; every refusal names its owner.
import { copyFileSync, existsSync, readFileSync, statSync } from "node:fs";
import { check, done, runNode, runPy } from "../video/lib.js";
import { PROJECT, readJson } from "../video/lib.js";

const failures: string[] = [];
let n = 0;
const t = (ok: boolean, label: string): void => {
  n += 1;
  check(n, ok, label, failures);
};
const report = (): { project?: string; checks?: { check?: string; status?: string; detail?: string }[] } =>
  readJson(`${PROJECT}/video/gate-report.json`) as {
    project?: string; checks?: { check?: string; status?: string; detail?: string }[];
  };
const absPath = (s: string): boolean => /[A-Za-z]:\\/.test(s) || s.includes('"/') || s.includes('"~/');

// 1. the gate prints its line and exits 0.
{
  const r = runNode(["scripts/video/live-gate.ts"]);
  const lines = r.out.trim().split("\n");
  t(r.code === 0 && lines.some((l) => /^live-gate: \d+ checks passed$/.test(l.trim())), "live-gate prints its line, exit 0");
}

// 2. every report check is ok, except the known word-alignment warn (its
// degraded path is recorded as a deviation in WU-LIVE-04).
{
  const checks = report().checks ?? [];
  const bad = checks.filter((c) => c.status !== "ok" && !(c.check === "word alignment" && c.status === "warn"));
  t(checks.length >= 20 && bad.length === 0, `report: ${checks.length} checks ok (+1 known warn)`);
}

// 3. two probes at least 25 s apart, both 200, marker equals the record.
{
  const url = (readJson(`${PROJECT}/deploy-record.json`) as { url?: string }).url ?? "";
  const probe = async (): Promise<{ code: number; build: string }> => {
    const r = await fetch(`${url}/health`);
    const j = (await r.json()) as { build?: string };
    return { code: r.status, build: j.build ?? "" };
  };
  const sleep = (ms: number): Promise<void> => new Promise((res) => setTimeout(res, ms));
  const t0 = Date.now();
  const a = await probe();
  await sleep(26000);
  const b = await probe();
  const gap = (Date.now() - t0) / 1000;
  const record = readJson(`${PROJECT}/deploy-record.json`) as { buildMarker?: string };
  t(gap >= 25 && a.code === 200 && b.code === 200 && a.build === record.buildMarker && b.build === record.buildMarker,
    `two probes ${gap.toFixed(0)}s apart, 200, marker ${record.buildMarker}`);
}

// 4. the stored smoke result is 4 passed, 0 failed, 0 skipped.
{
  const smoke = (report().checks ?? []).find((c) => c.check === "smoke");
  t(smoke?.status === "ok" && (smoke?.detail ?? "").includes("smoke: 4 passed, 0 failed, 0 skipped"),
    "report stores smoke 4/0/0");
}

// 5. the ledger was run by the gate and holds now.
{
  const stored = (report().checks ?? []).find((c) => c.check === "ledger");
  const r = runNode(["scripts/video/check-ledger.ts", "--base-url",
    (readJson(`${PROJECT}/deploy-record.json`) as { url?: string }).url ?? ""]);
  t((stored?.detail ?? "").match(/ledger: \d+ facts hold/) !== null &&
    r.code === 0 && /ledger: \d+ facts hold/.test(r.out), "ledger stored + holds on re-run");
}

// 6. ffmpeg, ffprobe and ADC answer (codes only).
{
  const { spawnSync } = await import("node:child_process") as typeof import("node:child_process");
  // shell:true: gcloud is a .cmd on Windows; only exit codes are read.
  const q = (c: string, a: string[]): boolean =>
    (spawnSync(c, a, { encoding: "utf8", timeout: 120000, shell: true }).status ?? 1) === 0;
  t(q("ffmpeg", ["-version"]) && q("ffprobe", ["-version"]) &&
    q("gcloud", ["auth", "application-default", "print-access-token"]), "ffmpeg + ffprobe + ADC exit 0");
}

// 7. apply_voice names cesar_voice; the report holds no absolute path or token.
{
  const r = runPy(["../../hackathons/_useful/scripts/apply_voice.py", "--check"]);
  const raw = readFileSync(`${PROJECT}/video/gate-report.json`, "utf8");
  t(r.code === 0 && r.out.includes("cesar_voice") && raw.includes("cesar_voice") &&
    !absPath(raw) && !/AKIA|Bearer [A-Za-z0-9_\-]{16,}/.test(raw), "cesar_voice named, report path- and token-free");
}

// 8. video-config.json equals §3.2.
{
  const cfg = readJson(`${PROJECT}/video-config.json`) as Record<string, unknown>;
  const bed = cfg.bed as { preset?: string; enabled?: boolean };
  t(cfg.video_theme === "paper" && cfg.capture_method === "screencast" &&
    cfg.entry_root === "../../../hackathon-entries/2026-10-amazonDevs" &&
    bed?.preset === "paper-minimal" && bed?.enabled === true && cfg.align_provider === "auto",
    "video-config.json equals §3.2");
}

// 9. banned scan clean while no narration exists.
{
  const r = runPy(["../../hackathons/_useful/scripts/check_banned_words.py", "--preset", "video", PROJECT]);
  let narrEmpty = true;
  try {
    const { readdirSync } = await import("node:fs") as typeof import("node:fs");
    const names = readdirSync(`${PROJECT}/video/narration`);
    narrEmpty = names.length === 0;
  } catch { narrEmpty = true; }
  t(r.code === 0 && narrEmpty, "banned scan clean, no narration yet");
}

// 10. a closed port declines loudly without touching video/narration.
{
  const repPath = `${PROJECT}/video/gate-report.json`;
  const backup = readFileSync(repPath, "utf8");
  const r = runNode(["scripts/video/live-gate.ts", "--base-url", "http://127.0.0.1:9"]);
  const { writeFileSync } = await import("node:fs") as typeof import("node:fs");
  writeFileSync(repPath, backup);
  let narrTouched = false;
  try {
    const { readdirSync } = await import("node:fs") as typeof import("node:fs");
    narrTouched = readdirSync(`${PROJECT}/video/narration`).length > 0;
  } catch { narrTouched = false; }
  t(r.code === 3 && r.out.includes("BLOCKED (") && r.out.includes("DP-DEPLOY") && !narrTouched,
    "closed port: BLOCKED names DP-DEPLOY, exit 3, narration untouched");
}

// 11. --allow-local records the deviation (files restored afterwards).
{
  const p = `${PROJECT}/video/production-notes.md`;
  const repPath = `${PROJECT}/video/gate-report.json`;
  const before = readFileSync(p, "utf8");
  const repBackup = readFileSync(repPath, "utf8");
  const r = runNode(["scripts/video/live-gate.ts", "--base-url", "http://127.0.0.1:9", "--allow-local"]);
  void r;
  const after = readFileSync(p, "utf8");
  const gained = after.split("\n").some((l) => l.startsWith("- gate:"));
  const { writeFileSync } = await import("node:fs") as typeof import("node:fs");
  writeFileSync(p, before);
  writeFileSync(repPath, repBackup);
  t(gained, "allow-local run gains a `- gate:` deviation bullet (restored)");
}

// 12. production notes headings in order, clean; run-log gate entry stops 0.
{
  const notes = readFileSync(`${PROJECT}/video/production-notes.md`, "utf8");
  const heads = ["## Run", "## Deployed address and build marker", "## Voice and models", "## Dataset of the take",
    "## Alignment provider", "## Deviations", "## Known gaps"];
  let last = -1;
  const ordered = heads.every((hh) => {
    const i = notes.indexOf(hh);
    const ok = i > last;
    last = i;
    return ok && i !== -1;
  });
  const log = readJson(`${PROJECT}/video/run-log.json`) as { stage?: string; stops?: number }[];
  const gate = log.find((e) => e.stage === "gate");
  t(ordered && !absPath(notes) && !/AKIA|Bearer [A-Za-z0-9_\-]{16,}/.test(notes) && gate?.stops === 0,
    "notes headings ordered + clean, run-log gate stops 0");
}

done("lv-01-gate", n, failures);
