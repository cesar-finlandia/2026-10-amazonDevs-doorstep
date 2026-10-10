// scripts/showcase-config.ts — DP-SHOWCASE WU-05.
// Writes design_documents/showcase.json from §3.1 and real sources only.
// live_url: deploy-record.json. repo_url: git remote get-url origin as https.
// video_url: interim <live_url>/watch (operator replaces after upload).
// Prints `showcase.json: live <url>`. BLOCKED lines name the missing source.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

function sh(cmd: string, args: string[]): string {
  const r = spawnSync(cmd, args, { encoding: "utf8", shell: true });
  if ((r.status ?? 1) !== 0) return "";
  return `${r.stdout ?? ""}`.trim();
}

function blocked(reason: string): never {
  console.log(`BLOCKED (${reason})`);
  process.exit(3);
}

// live_url: never typed, read from the deploy record.
const recDir = process.env["PROJECT_SYNC_DIR"] ?? "../../hackathons/hackathon-projects/2026-10-amazonDevs";
const recSep = recDir.endsWith("/") || recDir.endsWith("\\") ? "" : "/";
const recPath = `${recDir}${recSep}deploy-record.json`;
let liveUrl = "";
try {
  const rec = JSON.parse(readFileSync(recPath, "utf8")) as { url?: string };
  if (typeof rec.url === "string" && rec.url.startsWith("https://")) liveUrl = rec.url;
} catch { /* ignore */ }
if (liveUrl === "") blocked(`no deploy record at ${recPath}: run DP-DEPLOY first`);

// repo_url: never typed, read from git origin.
const origin = sh("git", ["remote", "get-url", "origin"]);
if (origin === "") blocked("no remote named origin");
const m = /github\.com[:/]([^/]+)\/([^/]+?)(?:\.git)?$/.exec(origin);
if (m === null) blocked(`origin is not a GitHub URL: ${origin}`);
const repoUrl = `https://github.com/${m[1]}/${m[2]}`;

// known_gaps: the two §3.1 literals, plus the stills-fallback gap when recorded.
const gaps = [
  "Live Ring needs a Playground token; the sample week is bundled so the product opens without one.",
  "Webhooks cannot reach a hosted copy during a demo; signed, labelled simulated deliveries go through the same verifier.",
];
if (existsSync("shots/showcase/fallback.json")) {
  try {
    const fb = JSON.parse(readFileSync("shots/showcase/fallback.json", "utf8")) as { reason?: string };
    if (typeof fb.reason === "string" && fb.reason !== "") gaps.push(`The stills were captured from a local copy that uses the recorded run: ${fb.reason}`);
    else gaps.push("The stills were captured from a local copy that uses the recorded run.");
  } catch {
    gaps.push("The stills were captured from a local copy that uses the recorded run.");
  }
}

const cfg = {
  version: "1.0.0",
  title: "Doorstep Rhythm",
  technology_name: "Ring",
  license_name: "MIT",
  live_url: liveUrl,
  video_url: `${liveUrl}/watch`,
  repo_url: repoUrl,
  supported_runtimes: [
    "Node 22 or newer, with a current Chromium for the browser tests",
    "A container host (Google Cloud Run is the documented default)",
  ],
  known_gaps: gaps,
  sixty_second_path: [
    { step: "Open the live page and press Load the sample week.", expect: "Seven days of Rosa's front door appear as a paper calendar." },
    { step: "Press Review the week.", expect: "The agent works through its steps and a request waits for you." },
    { step: "Press Approve when the request appears.", expect: "The review finishes and one moment is circled on its day." },
    { step: "Press Focus above the 3D view.", expect: "The camera frames the circled moment." },
    { step: "Open /watch and press Watch the agent do it.", expect: "A labelled replay of a recorded run plays." },
  ],
  try_prompts: [
    "Look through the week and put a note on the one moment that doesn't fit her usual routine.",
    "Check the week over, fix anything that doesn't add up, and tell me in two sentences how it looks.",
    "Please play a reassuring message through the door speaker so Mum knows someone is thinking of her.",
  ],
  axes: [
    { criterion: "Tech Implementation", evidence: [
      { label: "Architecture with runtime proof lines", link: "architecture.json" },
      { label: "Browser test results", link: "design_documents/e2e-testing/results.md" },
      { label: "Measured action-surface evaluation", link: "evals/report.json" } ] },
    { criterion: "Design", evidence: [
      { label: "Design brief", link: "design_documents/design_brief.md" },
      { label: "Hero recording", link: "shots/showcase/hero.gif" } ] },
    { criterion: "Potential Impact", evidence: [
      { label: "Who it is for and why it matters", link: "design_documents/winning_project_plan.md" } ] },
    { criterion: "Quality of the Idea", evidence: [
      { label: "The idea and the alternatives weighed", link: "design_documents/pitch_candidates.md" } ] },
  ],
};
writeFileSync("design_documents/showcase.json", JSON.stringify(cfg, null, 2) + "\n", "utf8");
console.log(`showcase.json: live ${liveUrl}`);
