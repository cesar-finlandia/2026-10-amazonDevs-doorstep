// scripts/video/acceptance.ts — DP-SCRIPT WU-10 step 2.
// Runs every gate of the spec §10 in order, records video/script-acceptance.md
// (one table: gate, command, result, date) and prints
// `acceptance: <n> of <n> gates pass`.
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { PROJECT } from "./lib.js";

interface Gate { name: string; command: string; run: () => { ok: boolean; detail: string } }
const gates: Gate[] = [];
const sh = (cmd: string, args: string[], cwd?: string): { ok: boolean; detail: string } => {
  try {
    const r = spawnSync(cmd, args, { cwd: cwd ?? process.cwd(), encoding: "utf8", timeout: 3600000, shell: true });
    const out = `${r.stdout ?? ""}${r.stderr ?? ""}`;
    const last = out.trim().split("\n").pop() ?? "";
    return { ok: (r.status ?? 1) === 0, detail: last.slice(0, 120) };
  } catch (e) {
    return { ok: false, detail: String(e).split("\n")[0] ?? "error" };
  }
};

// The four prerequisite verifiers of §0.
for (const f of ["e2e-12-results", "sc-05-readme", "sb-02-fields", "sb-05-delta"]) {
  gates.push({
    name: f, command: `npx vite-node scripts/verify/${f}.ts`,
    run: () => sh("npx", ["vite-node", `scripts/verify/${f}.ts`]),
  });
}
// sk-01 … sk-09.
const skNames = ["sk-01-harvest", "sk-02-ledger", "sk-03-script", "sk-04-segments", "sk-05-beats",
  "sk-06-figures", "sk-07-cover", "sk-08-slides", "sk-09-pitch"];
for (const f of skNames) {
  gates.push({
    name: f, command: `npx vite-node scripts/verify/${f}.ts`,
    run: () => sh("npx", ["vite-node", `scripts/verify/${f}.ts`]),
  });
}
// The chassis lints, run directly.
gates.push({
  name: "lint-script-v2", command: "node scripts/lint-script-v2.ts hackathon-projects/2026-10-amazonDevs (from chassis)",
  run: () => sh("node", ["scripts/lint-script-v2.ts", "hackathon-projects/2026-10-amazonDevs"], "../../hackathons"),
});
gates.push({
  name: "lint-cues", command: "node scripts/lint-cues.ts hackathon-projects/2026-10-amazonDevs (from chassis)",
  run: () => sh("node", ["scripts/lint-cues.ts", "hackathon-projects/2026-10-amazonDevs"], "../../hackathons"),
});
gates.push({
  name: "lint-stage3d", command: "node scripts/lint-stage3d.ts hackathon-projects/2026-10-amazonDevs (from chassis)",
  run: () => sh("node", ["scripts/lint-stage3d.ts", "hackathon-projects/2026-10-amazonDevs"], "../../hackathons"),
});
gates.push({
  name: "banned-video", command: "check_banned_words.py --preset video <project>",
  run: () => sh("python3", ["../../hackathons/_useful/scripts/check_banned_words.py", "--preset", "video", PROJECT]),
});
gates.push({
  name: "arc", command: "python3 scripts/video/check_arc.py",
  run: () => sh("python3", ["scripts/video/check_arc.py"]),
});
gates.push({
  name: "pitch", command: "npx vite-node scripts/video/check-pitch.ts",
  run: () => sh("npx", ["vite-node", "scripts/video/check-pitch.ts"]),
});
gates.push({
  name: "segments", command: "npx vite-node scripts/video/script-to-segments.ts --check",
  run: () => sh("npx", ["vite-node", "scripts/video/script-to-segments.ts", "--check"]),
});
gates.push({
  name: "ledger", command: "npx vite-node scripts/video/check-ledger.ts",
  run: () => sh("npx", ["vite-node", "scripts/video/check-ledger.ts"]),
});
// The closing-sentence test (WU-10 step 3): s12 claims open source + live now,
// so all three must verify here or the sentence is rewritten.
gates.push({
  name: "closing", command: "LICENSE MIT + git ls-remote repo_url + GET live_url/health",
  run: () => {
    const segs = JSON.parse(readFileSync(`${PROJECT}/narration-segments.json`, "utf8")) as {
      segments?: { id?: string; text?: string }[];
    };
    const s12 = segs.segments?.find((s) => s.id === "s12")?.text ?? "";
    if (!s12.includes("open source") || !s12.includes("live now")) {
      return { ok: true, detail: "s12 makes no open/live claim" };
    }
    const lic = readFileSync("LICENSE", "utf8").startsWith("MIT License");
    const show = JSON.parse(readFileSync("design_documents/showcase.json", "utf8")) as {
      repo_url?: string; live_url?: string;
    };
    let remote = false;
    try {
      execFileSync("git", ["ls-remote", show.repo_url ?? "", "HEAD"], { timeout: 120000 });
      remote = true;
    } catch { remote = false; }
    return { ok: lic && remote, detail: `LICENSE-MIT=${lic} repo-answers=${remote} (health below)` };
  },
});
gates.push({
  name: "health", command: "GET <live_url>/health returns 200",
  run: () => {
    const show = JSON.parse(readFileSync("design_documents/showcase.json", "utf8")) as { live_url?: string };
    try {
      const r = spawnSync("python3", ["-c",
        `import urllib.request; print(urllib.request.urlopen(${(JSON.stringify(`${show.live_url}/health`))}, timeout=60).status)`],
      { encoding: "utf8", timeout: 120000 });
      const code = (r.stdout ?? "").trim();
      return { ok: r.status === 0 && code === "200", detail: `GET /health = ${code}` };
    } catch (e) {
      return { ok: false, detail: String(e).split("\n")[0] ?? "error" };
    }
  },
});

const date = new Date().toISOString().slice(0, 10);
const rows: { gate: string; command: string; result: string; date: string }[] = [];
const details = new Map<string, string>();
let pass = 0;
for (const g of gates) {
  const r = g.run();
  if (r.ok) pass += 1;
  console.log(`${r.ok ? "PASS" : "FAIL"} ${g.name}: ${r.detail}`);
  details.set(g.name, r.detail);
  rows.push({ gate: g.name, command: g.command, result: r.ok ? "pass" : `FAIL (${r.detail})`, date });
}
// Measured totals for the acceptance page (sk-10 check 7): the estimator
// total with the sk-04 gap convention, and the arc's total and demo share.
const est = JSON.parse(readFileSync(`${PROJECT}/video/facts/estimate.json`, "utf8")) as { total?: number };
const estTotal = est.total ?? 0;
const withGaps = estTotal + 12.5;
const arcDetail = details.get("arc") ?? "";
const totalsSection = `\n## Measured totals\n\n- estimator: ${estTotal.toFixed(1)}s text-only + 12.5s gaps = ${withGaps.toFixed(1)}s (window 120-150)\n- ${arcDetail}\n`;
console.log(`estimator: ${estTotal.toFixed(1)}s + 12.5s gaps = ${withGaps.toFixed(1)}s`);
console.log(arcDetail);
const md = `# Script acceptance\n\n${date}. Every gate of the spec §10, in order.\n\n| gate | command | result | date |\n|---|---|---|---|\n` +
  rows.map((r) => `| ${r.gate} | \`${r.command}\` | ${r.result} | ${r.date} |`).join("\n") + "\n" + totalsSection;
writeFileSync(`${PROJECT}/video/script-acceptance.md`, md);
console.log(`acceptance: ${pass} of ${gates.length} gates pass`);
if (pass !== gates.length) process.exit(1);
