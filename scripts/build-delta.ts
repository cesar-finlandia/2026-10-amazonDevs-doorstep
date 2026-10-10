// scripts/build-delta.ts — DP-SUBMISSION WU-05 (§5.6).
// Writes design_documents/submission/delta.md from the §5.6 template with
// computed lists: reused bullets from assembly.manifest.json (roles in the
// generated disclosure's own words), built bullets from provenance.json
// authoredInWindow (first sentence of the owning plan's header).
// Prints `delta: reused <n> chassis components, authored <m> paths`.
import { readFileSync, writeFileSync } from "node:fs";

const manifest = JSON.parse(readFileSync("assembly.manifest.json", "utf8")) as {
  components?: { id?: string; included?: boolean }[];
};
const included = (manifest.components ?? []).filter((x) => x.included).map((x) => x.id as string);

// Roles in the generated disclosure's own words, keyed by component id.
const ROLES: Record<string, string> = {
  context: "a message buffer that keeps a conversation inside a model's context window",
  cost: "code that counts token and request usage and warns before a configured budget is exceeded",
  platform: "a typed event-streaming bus for pushing step-by-step progress to the browser, plus a one-command deploy helper and a small themed UI shell",
  resilience: "a wrapper that retries a slow or failed provider call and falls back to a cached response",
  ideation: "developer tooling used to prepare the submission's documents",
  pgm: "developer tooling used to prepare the submission's documents",
  profile: "developer tooling used to prepare the submission's documents",
  provenance: "developer tooling used to prepare the submission's documents",
};
for (const id of included) {
  if (ROLES[id] === undefined) {
    console.error(`delta: no disclosure role for included component ${id}`);
    process.exit(1);
  }
}
const disclosure = readFileSync("disclosure.md", "utf8");
for (const role of new Set(Object.values(ROLES))) {
  const key = role.split(" ").slice(0, 4).join(" ");
  if (!disclosure.includes(key)) {
    console.error(`delta: role not in disclosure.md: ${key}`);
    process.exit(1);
  }
}

const prov = JSON.parse(readFileSync("design_documents/submission/provenance.json", "utf8")) as { authoredInWindow?: string[] };
const paths = prov.authoredInWindow ?? [];

const PLAN_FOR: Record<string, string> = {
  "src/agent": "DP-AGENT-WORKFLOW.md", "src/llm": "DP-AGENT-WORKFLOW.md", "src/prompts": "DP-AGENT-WORKFLOW.md",
  "src/domain": "DP-DOMAIN-ENGINE.md", "src/kits": "DP-DOMAIN-ENGINE.md",
  "src/ring": "DP-RING-INTEGRATION.md", "src/server": "DP-API-TRANSPORT.md",
  "src/ui": "DP-UI.md", "src/3d": "DP-3D.md",
  "e2e": "DP-E2E-BROWSER-TESTING.md", "scripts": "DP-DEPLOY.md",
};

function planSentence(planFile: string): string {
  const text = readFileSync(`design_documents/design_plans/${planFile}`, "utf8").replace(/\r/g, "");
  const quote = text.split("\n").find((l) => l.startsWith("> "));
  const body = (quote ?? "").replace(/^> /, "").replace(/^Plan \d+ of \d+\.\s*/, "").trim();
  const first = body.split(/(?<=[.?!])\s+/)[0]?.trim() ?? "";
  if (first === "") {
    console.error(`delta: no header sentence in ${planFile}`);
    process.exit(1);
  }
  return first;
}

const { spawnSync } = await import("node:child_process");
const ls = spawnSync("git", ["ls-files"], { encoding: "utf8", shell: true });
const tracked = `${ls.stdout ?? ""}`.split("\n").map((l) => l.trim()).filter((l) => l !== "");
const built: string[] = [];
for (const p of paths) {
  const plan = PLAN_FOR[p];
  if (plan === undefined) {
    console.error(`delta: no owning plan for path ${p}`);
    process.exit(1);
  }
  if (!tracked.some((f) => f === p || f.startsWith(`${p}/`))) {
    console.error(`delta: path not in git ls-files: ${p}`);
    process.exit(1);
  }
  built.push(`- \`${p}\` — ${planSentence(plan)}`);
}

const out = `# What was built in the submission window

The submission window opened on 2026-08-31. Doorstep Rhythm was started inside it, as a new project on a reusable hackathon scaffold. Nothing in this repository was submitted to another event.

## Reused scaffolding

${included.map((id) => `- \`${id}\` — ${ROLES[id] as string}`).join("\n")}

The full list, the scaffold version and the AI tools that helped are in \`disclosure.md\`.

## Built in the window

${built.join("\n")}
`;
writeFileSync("design_documents/submission/delta.md", out, "utf8");
console.log(`delta: reused ${included.length} chassis components, authored ${paths.length} paths`);
