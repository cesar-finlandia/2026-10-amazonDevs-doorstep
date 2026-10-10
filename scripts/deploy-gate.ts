// scripts/deploy-gate.ts — DP-DEPLOY WU-DEPLOY-05.
// Requirement IDs: FR-24, FR-06
// Runs e2e/smoke.spec.ts + e2e/depth.spec.ts against the deployed URL and
// claims it only when both are green. Reads the URL from --url, else
// PUBLIC_URL, else the deploy record. Records rung/ring from the SMOKE-3
// annotations into the record's smoke field. Never edits the record's URL.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { loadDeployConfig } from "./lib/deploy-plan.js";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i === -1 ? undefined : process.argv[i + 1];
}

function resolveUrl(): string {
  const flag = arg("--url");
  if (flag !== undefined && flag !== "") return flag;
  if (process.env["PUBLIC_URL"] !== undefined && process.env["PUBLIC_URL"] !== "") {
    return process.env["PUBLIC_URL"] as string;
  }
  const { cfg } = loadDeployConfig({ env: {} });
  const dir = process.env[cfg.record.dirEnv] ?? cfg.record.defaultDir;
  const sep = dir.endsWith("/") || dir.endsWith("\\") ? "" : "/";
  const p = `${dir}${sep}deploy-record.json`;
  try {
    const rec = JSON.parse(readFileSync(p, "utf8")) as { url?: string };
    if (typeof rec.url === "string" && rec.url !== "") return rec.url;
  } catch { /* ignore */ }
  console.error("BLOCKED (no deployed URL: pass --url, set PUBLIC_URL, or deploy first)");
  process.exit(3);
}

function runSuite(label: string, files: string[], url: string): { code: number; line: string; out: string } {
  const r = spawnSync("npx", ["vite-node", "scripts/e2e-run.ts", "--label", label, ...files], {
    cwd: process.cwd(),
    encoding: "utf8",
    shell: true,
    timeout: 3600000,
    env: { ...process.env, BASE_URL: url },
  });
  const out = `${r.stdout ?? ""}${r.stderr ?? ""}`;
  process.stdout.write(`${r.stdout ?? ""}`);
  process.stderr.write(`${r.stderr ?? ""}`);
  const shape = new RegExp(`^${label}: (\\d+ passed, \\d+ failed, \\d+ skipped)$`);
  const line = out.split("\n").map((l) => l.trim()).filter((l) => shape.test(l)).pop() ?? "";
  return { code: r.status ?? 1, line, out };
}

interface JsonTest { annotations: { type: string; description?: string }[] }
interface JsonSpec { title: string; file: string; tests: JsonTest[] }
interface JsonSuite { specs?: JsonSpec[]; suites?: JsonSuite[] }

function smokeAnnotations(): { rung: string; ring: string } {
  try {
    const report = JSON.parse(readFileSync("e2e/artifacts/report.json", "utf8")) as { suites?: JsonSuite[] };
    const specs: JsonSpec[] = [];
    const walk = (node: JsonSuite): void => {
      for (const s of node.specs ?? []) specs.push(s);
      for (const sub of node.suites ?? []) walk(sub);
    };
    for (const s of report.suites ?? []) walk(s);
    const smoke3 = specs.find((s) => s.title.startsWith("SMOKE-3"));
    let rung = "";
    let ring = "";
    for (const t of smoke3?.tests ?? []) {
      for (const a of t.annotations) {
        if (a.type === "rung" && rung === "") rung = a.description ?? "";
        if (a.type === "ring" && ring === "") ring = a.description ?? "";
      }
    }
    return { rung, ring };
  } catch {
    return { rung: "", ring: "" };
  }
}

const url = resolveUrl();
const smoke = runSuite("smoke", ["e2e/smoke.spec.ts"], url);
const ann = smokeAnnotations();
const depth = runSuite("depth", ["e2e/depth.spec.ts"], url);

const smokeOk = smoke.line === "smoke: 4 passed, 0 failed, 0 skipped";
const depthOk = depth.line === "depth: 1 passed, 0 failed, 0 skipped";
console.log(`rung: ${ann.rung !== "" ? ann.rung : "(unknown)"}`);
console.log(`ring: ${ann.ring !== "" ? ann.ring : "(unknown)"}`);

// Fill the record's smoke field (URL untouched).
try {
  const { cfg } = loadDeployConfig({ env: {} });
  const dir = process.env[cfg.record.dirEnv] ?? cfg.record.defaultDir;
  const sep = dir.endsWith("/") || dir.endsWith("\\") ? "" : "/";
  const p = `${dir}${sep}deploy-record.json`;
  if (existsSync(p)) {
    const rec = JSON.parse(readFileSync(p, "utf8")) as Record<string, unknown>;
    if (rec["url"] === url) {
      rec["smoke"] = { at: new Date().toISOString(), smoke: smoke.line, depth: depth.line, rung: ann.rung, ring: ann.ring };
      writeFileSync(p, JSON.stringify(rec, null, 2) + "\n", "utf8");
    }
  }
} catch { /* record update is best-effort */ }

if (smokeOk && depthOk) {
  console.log("gate: green");
  process.exit(0);
}
console.log("gate: red — roll back with:");
console.log(`  gcloud run services update-traffic doorstep-rhythm --region <region> --project <project> --to-revisions <previous-revision>=100`);
console.log(`  (list revisions: gcloud run revisions list --service doorstep-rhythm --region <region> --project <project>)`);
process.exit(1);
