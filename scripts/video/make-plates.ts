// scripts/video/make-plates.ts — DP-SCRIPT WU-07 step 3.
// plates.json → compose_plates.py → pitch/<id>-image.png.
// Usage: npx vite-node scripts/video/make-plates.ts [--only cover,slide1,slide2]
// Prints `plates: <n> generated, <m> cache hits`.
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { check, done } from "./lib.js";
import { PROJECT, runPy } from "./lib.js";

const failures: string[] = [];
let n = 0;
const t = (ok: boolean, label: string): void => {
  n += 1;
  check(n, ok, label, failures);
};

const only = process.argv.find((a) => a.startsWith("--only="))?.slice("--only=".length) ??
  (process.argv.includes("--only") ? process.argv[process.argv.indexOf("--only") + 1] : undefined);
const force = process.argv.includes("--force");
const model = process.env.IMAGE_MODEL ?? "gemini-3.1-flash-image";
const location = process.env.IMAGE_LOCATION ?? "global";
const project = process.env.GCP_PROJECT ?? "hacka-2026-09-agentic-cinema1";

const args = ["../../hackathons/_useful/scripts/compose_plates.py", "--project", `${PROJECT}/pitch/work`,
  "--model", model, "--gcp-project", project, "--location", location];
if (only) args.push("--only", only);
if (force) args.push("--force");
const r = runPy(args);
process.stdout.write(r.out);
if (r.code !== 0) {
  console.error(`make-plates: compose failed (exit ${r.code})`);
  process.exit(r.code);
}
const ids = only ? only.split(",").map((s) => s.trim()).filter((s) => s !== "") : ["cover", "slide1", "slide2"];
for (const id of ids) {
  const src = `${PROJECT}/pitch/work/video/plates/${id}.png`;
  const dst = `${PROJECT}/pitch/${id}-image.png`;
  if (!existsSync(src)) {
    t(false, `plate ${id} produced`);
    continue;
  }
  copyFileSync(src, dst);
  t(true, `plate ${id} produced`);
}
const generated = (r.out.match(/^wrote .*\.png/gm) ?? []).length;
const hits = (r.out.match(/^cache hit: /gm) ?? []).length;
// Stamp the region onto fresh manifest entries: the manifest records the
// model but not where it ran (sk-07 check 4).
try {
  const mf = `${PROJECT}/pitch/work/video/plates/plates-manifest.json`;
  const manifest = JSON.parse(readFileSync(mf, "utf8")) as { plates?: { region?: string }[] };
  let touched = false;
  for (const p of manifest.plates ?? []) {
    if (!p.region) { p.region = location; touched = true; }
  }
  if (touched) writeFileSync(mf, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
} catch { /* manifest stays as compose wrote it */ }
console.log(`plates: ${generated} generated, ${hits} cache hits`);
done("make-plates", n, failures);
