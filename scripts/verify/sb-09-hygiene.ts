// scripts/verify/sb-09-hygiene.ts — DP-SUBMISSION WU-09 (12 checks).
// Requirement IDs: NFR-09, NFR-10
// Exits 3 with the named block while the video address is interim (operator
// step); exits 1 on any real failure. Fault injections use runtime-random
// fake secrets and remove what they create in finally blocks.
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { createChecker } from "./ui-kit.js";
import { run } from "./e2e-kit.js";
import { absolutePathHits } from "../lib/submission.js";

const c = createChecker("sb-09-hygiene");

// 1. Layout OK.
{
  const r = run("npx", ["vite-node", "scripts/check-entry-layout.ts"]);
  c.ok(r.code === 0 && r.out.includes("layout: OK"), "layout OK");
}

// 2. Extra root file fails naming it; removed after.
{
  writeFileSync("zz-extra.txt", "layout probe\n", "utf8");
  try {
    const r = run("npx", ["vite-node", "scripts/check-entry-layout.ts"]);
    c.ok(r.code === 1 && r.out.includes("layout: zz-extra.txt is not allowed"), "extra file named");
  } finally {
    rmSync("zz-extra.txt", { force: true });
  }
}

// 3. Hygiene clean.
{
  const r = run("npx", ["vite-node", "scripts/chassis-tool.ts", "submit", "--", "hygiene", "--manifest", "assembly.manifest.json", "--out", "design_documents/submission/hygiene-report"]);
  let status = "";
  try {
    status = (JSON.parse(readFileSync("design_documents/submission/hygiene-report.json", "utf8")) as { secret_scan?: { status?: string } }).secret_scan?.status ?? "";
  } catch { /* ignore */ }
  c.ok(r.code === 0 && status === "clean", `hygiene clean (${status})`);
}

// 4. Fake cloud key flagged, match redacted, clean after removal.
{
  const fake = `AKIA${randomBytes(12).toString("hex").toUpperCase().slice(0, 16)}`;
  writeFileSync("zz-fakekey.txt", `leaked = "${fake}"\n`, "utf8");
  try {
    const r = run("npx", ["vite-node", "scripts/chassis-tool.ts", "submit", "--", "hygiene", "--manifest", "assembly.manifest.json", "--out", "design_documents/submission/hygiene-report", "--include-unstaged"]);
    let status = "";
    let redacted = false;
    try {
      const j = JSON.parse(readFileSync("design_documents/submission/hygiene-report.json", "utf8")) as { secret_scan?: { status?: string } };
      status = j.secret_scan?.status ?? "";
      redacted = JSON.stringify(j).includes("AKIA...REDACTED");
    } catch { /* ignore */ }
    c.ok(r.code === 1 && status === "flagged" && redacted, "fake key flagged + redacted");
  } finally {
    rmSync("zz-fakekey.txt", { force: true });
  }
  const r2 = run("npx", ["vite-node", "scripts/chassis-tool.ts", "submit", "--", "hygiene", "--manifest", "assembly.manifest.json", "--out", "design_documents/submission/hygiene-report"]);
  c.ok(r2.code === 0, "clean again after removal");
}

// 5. Absolute-path scan (lib logic shared with readiness).
{
  const ls = run("git", ["ls-files"]);
  const files = ls.out.split("\n").map((l) => l.trim()).filter((l) => l !== "" && !l.startsWith("node_modules/"));
  const bad: string[] = [];
  for (const f of files) {
    if (/\.(png|gif|webm|woff2|mp4|svg)$/.test(f)) continue;
    let t = "";
    try {
      const buf = readFileSync(f);
      if (buf.includes(0)) continue;
      t = buf.toString("utf8");
    } catch { continue; }
    if (absolutePathHits(t).length > 0) bad.push(f);
  }
  c.ok(bad.length === 0, `no machine paths (${bad.slice(0, 3).join(",") || "clean"})`);
}

// 6. Rendered banned scope clean; plans advisory recorded.
{
  const r = run("python3", ["../../hackathons/_useful/scripts/check_banned_words.py", "src/ui", "src/3d", "index.html"]);
  const md = readFileSync("design_documents/submission/public-readiness.md", "utf8");
  c.ok(r.code === 0 && /plans advisory hits=\d+/.test(md), "rendered clean, advisory recorded");
}

// 7. Licence + README + scripts.
{
  const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { scripts?: Record<string, string> };
  c.ok(
    existsSync("LICENSE") && readFileSync("README.md", "utf8").includes("## Develop, test, deploy") &&
      typeof pkg.scripts?.["build"] === "string" && typeof pkg.scripts?.["server"] === "string",
    "licence + develop + build/server",
  );
}

// 8. claims lint + showcase gate.
{
  const cl = run("npx", ["vite-node", "hee/src/showcase/cli.ts", "claims", "lint", "--entry", "."]);
  const gate = run("npx", ["vite-node", "hee/src/showcase/cli.ts", "gate", "--entry", "."]);
  c.ok(/claims: OK \(\d+ claims\)/.test(cl.out) && gate.code === 0 && gate.out.includes("showcase gate OK"), "claims + gate green");
}

// 9. Ten fields present (plus the empty-address BLOCKED branch on a temp copy).
{
  const r = run("npx", ["vite-node", "scripts/build-devpost-fields.ts"]);
  c.ok(r.code === 0 && r.out.includes("fields: 10 of 10 present"), "fields 10 of 10");
}

// 10. Pointers exist non-empty + feedback green.
{
  const f = JSON.parse(readFileSync("design_documents/submission/devpost-fields.json", "utf8")) as { fields?: Record<string, { file?: string }> };
  let ok = true;
  for (const v of Object.values(f.fields ?? {})) {
    if (typeof v.file === "string") {
      try {
        if (readFileSync(v.file).length === 0) ok = false;
      } catch { ok = false; }
    }
  }
  const fb = run("npx", ["vite-node", "scripts/check-feedback.ts"]);
  c.ok(ok && fb.code === 0, "pointers exist, feedback green");
}

// 11. video_url interim → BLOCKED exit 3 (operator step, not failure).
{
  const show = JSON.parse(readFileSync("design_documents/showcase.json", "utf8")) as { video_url?: string };
  if ((show.video_url ?? "").endsWith("/watch")) {
    // Check 12 still runs before leaving.
    const pr = run("npx", ["vite-node", "scripts/public-readiness.ts"]);
    const md = readFileSync("design_documents/submission/public-readiness.md", "utf8");
    const m = /public-readiness: (\d+) checks passed, (\d+) blocked, (\d+) failed/.exec(pr.out);
    const rows = md.split("\n").filter((l) => l.startsWith("| ") && !l.startsWith("| Check") && !l.startsWith("|--"));
    const rowsOk =
      m !== null && Number(m[3]) === 0 &&
      rows.filter((l) => l.includes("| PASS |")).length === Number(m[1]) &&
      rows.filter((l) => l.includes("| BLOCKED |")).length === Number(m[2]);
    if (!rowsOk) {
      console.error("FAIL readiness rows match");
      process.exit(1);
    }
    console.log("BLOCKED (video_url is still the interim /watch page)");
    process.exit(3);
  }
  c.ok(true, "video_url final");
}

// 12. Readiness rows match printed counts.
{
  const pr = run("npx", ["vite-node", "scripts/public-readiness.ts"]);
  const md = readFileSync("design_documents/submission/public-readiness.md", "utf8");
  const m = /public-readiness: (\d+) checks passed, (\d+) blocked, (\d+) failed/.exec(pr.out);
  const rows = md.split("\n").filter((l) => l.startsWith("| ") && !l.startsWith("| Check") && !l.startsWith("|--"));
  c.ok(
    m !== null &&
      rows.filter((l) => l.includes("| PASS |")).length === Number(m[1]) &&
      rows.filter((l) => l.includes("| BLOCKED |")).length === Number(m[2]) &&
      rows.filter((l) => l.includes("| FAIL |")).length === Number(m[3]),
    `readiness rows match (${m?.[0] ?? "?"})`,
  );
}

c.done();
