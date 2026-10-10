// scripts/gen-provenance.ts — DP-SUBMISSION WU-01 (§3.3).
// Writes design_documents/submission/provenance.json computed from real
// sources (manifest, git ls-files, package.json, golden cache, qa-run.json).
// Prints `provenance: <n> authored paths, <m> chassis components`.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const manifest = JSON.parse(readFileSync("assembly.manifest.json", "utf8")) as {
  chassis_version?: string; version?: string;
  components?: { id?: string; included?: boolean }[];
};
const comps = manifest.components ?? [];
const included = comps.filter((x) => x.included).map((x) => x.id as string);
const excluded = comps.filter((x) => !x.included).map((x) => x.id as string);

const ls = spawnSync("git", ["ls-files"], { encoding: "utf8", shell: true });
const files = `${ls.stdout ?? ""}`.split("\n").map((l) => l.trim()).filter((l) => l !== "");
const dirs = new Set<string>();
for (const f of files) {
  const parts = f.split("/");
  if (parts[0] === "src" && parts.length > 2) dirs.add(`${parts[0]}/${parts[1]}`);
  else if ((parts[0] === "scripts" || parts[0] === "e2e") && parts.length > 1) dirs.add(parts[0] as string);
}
const CHASSIS_DIRS = new Set(["src/context", "src/cost", "src/ideation", "src/pgm", "src/platform", "src/profile", "src/provenance", "src/resilience"]);
const authoredInWindow = [...dirs].filter((d) => !CHASSIS_DIRS.has(d)).sort();

const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
const allDeps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
const DEP_NAMES = ["express", "react", "three", "@strands-agents/sdk", "@aws-sdk/client-bedrock-runtime", "@playwright/test"];
const dependencies = DEP_NAMES.filter((n) => typeof allDeps[n] === "string").map((n) => ({ name: n, version: allDeps[n] as string }));

interface ModelEntry { role: string; id: string; region: string; source: "bedrock" | "vertex" }
const models: ModelEntry[] = [];
try {
  const meta = JSON.parse(readFileSync("data/golden-cache/doorstep-meta.json", "utf8")) as { provider?: string; model?: string; region?: string };
  if (typeof meta.model === "string" && meta.model !== "" && typeof meta.region === "string" && meta.region !== "") {
    models.push({ role: "recorded-run", id: meta.model, region: meta.region, source: meta.provider === "bedrock" ? "bedrock" : "vertex" });
  }
} catch { /* ignore */ }
try {
  const qa = JSON.parse(readFileSync("design_documents/submission/qa/qa-run.json", "utf8")) as { model?: string; location?: string; region?: string };
  const qid = qa.model ?? "";
  const qregion = (qa.location ?? qa.region ?? "") as string;
  if (qid !== "" && qregion !== "") models.push({ role: "qa-draft", id: qid, region: qregion, source: "vertex" });
} catch { /* ignore */ }

let aiTools: { tool: string; scope: string }[] = [];
try {
  aiTools = JSON.parse(readFileSync("design_documents/submission/ai_tools.json", "utf8")) as typeof aiTools;
} catch { /* ignore */ }

const record = {
  version: "1.0.0",
  entry: "2026-10-amazonDevs",
  generatedAt: new Date().toISOString(),
  chassis: {
    version: (manifest.chassis_version ?? manifest.version ?? "") as string,
    includedComponents: included,
    excludedComponents: excluded,
  },
  windowStartsOn: "2026-08-31",
  authoredInWindow,
  aiTools,
  dependencies,
  models,
};
writeFileSync("design_documents/submission/provenance.json", JSON.stringify(record, null, 2) + "\n", "utf8");
console.log(`provenance: ${authoredInWindow.length} authored paths, ${included.length} chassis components`);
if (!existsSync("design_documents/submission/provenance.json")) process.exit(1);
