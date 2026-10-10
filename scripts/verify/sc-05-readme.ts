// scripts/verify/sc-05-readme.ts — DP-SHOWCASE WU-SHOWCASE-05 (12 checks).
// Requirement IDs: FR-25 (part)
import { spawn, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createChecker } from "./ui-kit.js";
import { run } from "./e2e-kit.js";

const c = createChecker("sc-05-readme");

// 1. showcase.json shape: Ring/MIT, 3 prompts, 3-6 steps, >= 3 axes with real links.
const cfg = JSON.parse(readFileSync("design_documents/showcase.json", "utf8")) as {
  technology_name?: string; license_name?: string; try_prompts?: string[];
  sixty_second_path?: { step?: string }[]; axes?: { evidence?: { link?: string }[] }[];
};
const linksOk = (cfg.axes ?? []).length >= 3 &&
  (cfg.axes ?? []).every((a) => (a.evidence ?? []).length >= 1 &&
    (a.evidence ?? []).every((e) => typeof e.link === "string" && (e.link as string).length > 0));
let evidenceExist = true;
try {
  const { existsSync } = await import("node:fs");
  for (const a of cfg.axes ?? []) for (const e of a.evidence ?? []) {
    const link = e.link as string;
    if (!link.startsWith("https://")) {
      try { if (!existsSync(link)) evidenceExist = false; } catch { evidenceExist = false; }
    }
  }
} catch { evidenceExist = false; }
c.ok(
  cfg.technology_name === "Ring" && cfg.license_name === "MIT" &&
    (cfg.try_prompts ?? []).length === 3 && (cfg.try_prompts ?? []).every((p) => p.length >= 8 && p.length <= 200) &&
    (cfg.sixty_second_path ?? []).length >= 3 && (cfg.sixty_second_path ?? []).length <= 6 && linksOk && evidenceExist,
  "showcase.json: Ring/MIT, 3 prompts, 3-6 steps, axes with existing links",
);

// 2. URLs: live == record, repo github, video https.
const rec = JSON.parse(readFileSync("../../hackathons/hackathon-projects/2026-10-amazonDevs/deploy-record.json", "utf8")) as { url?: string };
const full = cfg as { live_url?: string; repo_url?: string; video_url?: string; known_gaps?: string[] };
c.ok(
  full.live_url === rec.url && (full.repo_url ?? "").startsWith("https://github.com/") && (full.video_url ?? "").startsWith("https://"),
  `urls live==record, repo github, video https (${full.live_url})`,
);

// 3. No placeholders.
const readme = readFileSync("README.md", "utf8");
c.ok(!readme.includes("{{") && !readme.includes("TODO"), "README has no {{ or TODO");

// 4. readme lint.
const rl = run("npx", ["vite-node", "hee/src/showcase/cli.ts", "readme", "lint", "--entry", "."]);
c.ok(rl.code === 0 && rl.out.includes("readme: OK"), "readme lint OK");

// 5. Title + thesis + slogan once.
const lines = readme.split("\n");
c.ok(
  lines[0] === "# Doorstep Rhythm" &&
    lines[2] === "Know her day without calling. Doorstep Rhythm circles the one moment at her front door that did not fit the week." &&
    readme.split("Know her day without calling.").length - 1 === 1,
  "title + exact thesis + slogan once",
);

// 6. claims lint + verify.
const cl = run("npx", ["vite-node", "hee/src/showcase/cli.ts", "claims", "lint", "--entry", "."]);
const clm = /claims: OK \((\d+) claims\)/.exec(cl.out);
const cv = run("npx", ["vite-node", "hee/src/showcase/cli.ts", "claims", "verify", "--entry", "."]);
const cvm = /claims verify: (\d+) verified, 0 unverified/.exec(cv.out);
c.ok(cl.code === 0 && clm !== null && Number(clm[1]) >= 2 && cvm !== null && Number(cvm[1]) >= 2, `claims lint+verify (${clm?.[1] ?? "?"} claims)`);

// 7. Relative links resolve; live URL answers 200.
let linksResolve = true;
for (const m of readme.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)) {
  const target = (m[1] ?? "").split("#")[0] as string;
  if (target === "" || target.startsWith("https://") || target.startsWith("http://") || target.startsWith("mailto:")) continue;
  try {
    const { existsSync } = await import("node:fs");
    if (!existsSync(target)) linksResolve = false;
  } catch { linksResolve = false; }
}
let liveOk = false;
try {
  const res = await fetch(full.live_url as string, { signal: AbortSignal.timeout(30000) });
  liveOk = res.status === 200;
} catch { liveOk = false; }
c.ok(linksResolve && liveOk, `README links resolve; live URL 200 (${liveOk})`);

// 8. npm run build + npm run server parity (SIGTERM closes the port).
const build = run("npm", ["run", "build"]);
let serverOk = false;
if (build.code === 0) {
  const port = 44101 + Math.floor(Math.random() * 1000);
  const child = spawn("npm", ["run", "server"], {
    cwd: process.cwd(), shell: true, env: { ...process.env, PORT: String(port), BUILD_MARKER: "sc-05" },
  });
  const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
  const killPort = (): void => {
    try {
      const r = spawnSync("powershell", ["-NoProfile", "-NonInteractive", "-Command", `Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique`], { encoding: "utf8", shell: false });
      for (const pid of `${r.stdout ?? ""}`.split(/[\r\n\s]+/).map(Number).filter((n) => Number.isInteger(n) && n > 0)) {
        try { spawnSync("taskkill", ["/F", "/PID", String(pid)], { shell: true }); } catch { /* ignore */ }
      }
    } catch { /* ignore */ }
  };
  try {
    const deadline = Date.now() + 20000;
    for (;;) {
      await sleep(500);
      try {
        const res = await fetch(`http://127.0.0.1:${port}/health`, { signal: AbortSignal.timeout(3000) });
        if (res.ok) {
          const j = (await res.json()) as { ok?: boolean };
          if (j.ok === true) { serverOk = true; break; }
        }
      } catch { /* retry */ }
      if (Date.now() > deadline) break;
    }
    try { child.kill("SIGTERM"); } catch { /* ignore */ }
    await sleep(1000);
    killPort();
    const closedDeadline = Date.now() + 5000;
    while (serverOk && Date.now() < closedDeadline) {
      await sleep(250);
      try {
        await fetch(`http://127.0.0.1:${port}/health`, { signal: AbortSignal.timeout(1000) });
      } catch { break; }
    }
  } finally {
    try { child.kill("SIGKILL"); } catch { /* ignore */ }
  }
}
c.ok(build.code === 0 && serverOk, `build ok + server answers /health and stops (${serverOk})`);

// 9. Six develop commands in order; script names exist.
const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { scripts?: Record<string, string> };
const fences: string[] = [];
{
  let inFence = false;
  let buf = "";
  for (const l of readme.split("\n")) {
    if (/^```/.test(l.trim())) {
      if (inFence) fences.push(buf);
      buf = "";
      inFence = !inFence;
    } else if (inFence) buf += l + "\n";
  }
}
const joined = fences.join("\n---\n");
const cmds = ["npm install", "npm run build", "npm run server", "npm run e2e", "BASE_URL=<url> npx playwright test e2e/smoke.spec.ts", "npm run deploy:cloud-run"];
let orderOk = true;
let lastIdx = -1;
for (const cmd of cmds) {
  const i = joined.indexOf(cmd, lastIdx + 1);
  if (i === -1 || i < lastIdx) { orderOk = false; break; }
  lastIdx = i;
}
const scriptsOk = ["build", "server", "e2e", "deploy:cloud-run"].every((s) => typeof pkg.scripts?.[s] === "string");
c.ok(orderOk && scriptsOk, "six develop commands in order; scripts exist");

// 10. Eval block with verbatim ceiling.
const report = JSON.parse(readFileSync("evals/report.json", "utf8")) as { treatment?: unknown; control?: unknown; ceiling?: string };
const si = readme.indexOf("<!-- hee-eval:start -->");
const ei = readme.indexOf("<!-- hee-eval:end -->");
c.ok(
  si !== -1 && ei > si && report.treatment != null && report.control != null &&
    typeof report.ceiling === "string" && readme.slice(si, ei).includes(report.ceiling),
  "eval block with verbatim ceiling",
);

// 11. No absolute path / Bearer / 20-hex. (The [A-Za-z]: pattern must skip
// the s: of https:// URLs; the licence names files, never hashes.)
const noUrls = readme.replace(/https?:\/\/\S+/g, "URL");
c.ok(!/[A-Za-z]:[\\/]/.test(noUrls) && !readme.includes("Bearer ") && !/[0-9a-f]{20}/.test(readme), "README has no path/secret/blob");

// 12. Banned-words scan.
const banned = run("python3", ["../../hackathons/_useful/scripts/check_banned_words.py", "README.md", "design_documents/showcase.json"]);
c.ok(banned.code === 0, "banned-words scan exits 0");

c.done();
