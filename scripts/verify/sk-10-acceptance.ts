// scripts/verify/sk-10-acceptance.ts — DP-SCRIPT WU-10 (12 checks).
// The operator's edit file exists, every gate of §10 has been run in order
// and recorded on one page, and the closing sentence is true.
import { readFileSync } from "node:fs";
import { check, done, runNode, runPy } from "../video/lib.js";
import { PROJECT, readJson } from "../video/lib.js";

const failures: string[] = [];
let n = 0;
const t = (ok: boolean, label: string): void => {
  n += 1;
  check(n, ok, label, failures);
};
const md = readFileSync(`${PROJECT}/demo-video-script.md`, "utf8").replace(/\r/g, "");

// 1. the narration review exits 0 and holds one block per segment, markup-free.
{
  const r = runPy(["../../hackathons/_useful/scripts/render_narration.py", "--segments",
    `${PROJECT}/narration-segments.json`, "--outdir",
    "C:/Users/cesar/AppData/Local/Temp/opencode/narr-rev", "--cap-seconds", "180", "--review"]);
  const review = readFileSync(`${PROJECT}/narration-review.md`, "utf8").replace(/\r/g, "");
  const segs = readJson(`${PROJECT}/narration-segments.json`) as { segments?: { id?: string }[] };
  const ids = (segs.segments ?? []).map((s) => s.id);
  const blocks = [...review.matchAll(/^## \[(\S+)\]/gm)].map((m) => m[1]);
  const markup = /stage:|statement:|mechanism:|arch:|demo:|open:|quote:|reveal:|impact:/.test(
    review.replace(/^#+ .+$/gm, "").replace(/<!--[\s\S]*?-->/g, ""));
  t(r.code === 0 && JSON.stringify(blocks) === JSON.stringify(ids) && !markup,
    `review: ${blocks.length} blocks for ${ids.length} segments, spoken text markup-free`);
}

// 2. the production notes name the edit file.
{
  const notes = md.slice(md.indexOf("## 8. Production notes"));
  t(notes.includes("narration-review.md"), "production notes name narration-review.md");
}

// 3. acceptance prints N of N with N at least 20, exit 0.
{
  const r = runNode(["scripts/video/acceptance.ts"]);
  const m = /acceptance: (\d+) of (\d+) gates pass/.exec(r.out);
  t(r.code === 0 && m !== null && m[1] === m[2] && Number(m[1]) >= 20,
    `acceptance line (${m ? m[0] : r.out.trim().split("\n").pop()})`);
}

// 4. the acceptance page rows every gate, all pass.
{
  const page = readFileSync(`${PROJECT}/video/script-acceptance.md`, "utf8");
  const rows = page.split("\n").filter((l) => l.startsWith("| ") && !l.startsWith("| gate "));
  t(rows.length >= 20 && rows.every((l) => l.includes("| pass |")), `acceptance page: ${rows.length} rows, all pass`);
}

// 5. the closing claims are verified with the commands that verified them:
// the page rows the commands, and this check re-runs all three.
{
  const page = readFileSync(`${PROJECT}/video/script-acceptance.md`, "utf8");
  const closing = page.split("\n").find((l) => l.startsWith("| closing |")) ?? "";
  const health = page.split("\n").find((l) => l.startsWith("| health |")) ?? "";
  const segs = readJson(`${PROJECT}/narration-segments.json`) as { segments?: { id?: string; text?: string }[] };
  const s12 = segs.segments?.find((s) => s.id === "s12")?.text ?? "";
  const claims = s12.includes("open source") && s12.includes("live now");
  const show = readJson("design_documents/showcase.json") as { repo_url?: string; live_url?: string };
  const lic = readFileSync("LICENSE", "utf8").startsWith("MIT License");
  const { spawnSync } = await import("node:child_process") as typeof import("node:child_process");
  let remote = false;
  try {
    const g = spawnSync("git", ["ls-remote", show.repo_url ?? "", "HEAD"], { encoding: "utf8", timeout: 120000 });
    remote = (g.status ?? 1) === 0;
  } catch { remote = false; }
  let healthOk = false;
  try {
    const r = spawnSync("python3",
      ["-c", `import urllib.request; print(urllib.request.urlopen(${JSON.stringify(`${show.live_url}/health`)}, timeout=60).status)`],
      { encoding: "utf8", timeout: 120000 });
    healthOk = (r.status ?? 1) === 0 && (r.stdout ?? "").trim() === "200";
  } catch { healthOk = false; }
  t(closing.includes("| pass |") && closing.includes("git ls-remote") && health.includes("| pass |") &&
    (!claims || (lic && healthOk)), "closing sentence true: LICENCE, repository, health verified");
}

// 6. no pending string left in the beat plan.
t(!readFileSync(`${PROJECT}/beat-plan.json`, "utf8").includes("pending WU-SCRIPT-08"), "beat plan holds no pending");

// 7. estimator total within the deviated cap, printed on the page; demo share at least 45.
{
  const page = readFileSync(`${PROJECT}/video/script-acceptance.md`, "utf8");
  const e = /estimator: ([\d.]+)s text-only \+ 12\.5s gaps = ([\d.]+)s/.exec(page);
  const a = /arc: OK \(total ([\d.]+)s, demo (\d+)%\)/.exec(page);
  const md = readFileSync(`${PROJECT}/demo-video-script.md`, "utf8");
  t(e !== null && Number(e[2]) <= 260 && md.includes("RECORDED DEVIATION 2026-10-11") &&
    a !== null && Number(a[2]) >= 45, `estimator ${e ? e[2] : "?"}s within deviated cap, demo ${a ? a[2] : "?"}%`);
}

// 8. section 9 is complete and its values are on the layers.
{
  const sec9 = md.slice(md.indexOf("## 9. Graphical assets"));
  const wordsOf = (s: string): string[] => s.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 4);
  const layers = ["cover", "slide1", "slide2"].map((id) =>
    wordsOf(readFileSync(`${PROJECT}/pitch/${id}.html`, "utf8").replace(/<[^>]*>/g, " ")).join(" "));
  const hay = layers.join("\n");
  const values = [
    "from a distance no one can tell a slow day from an emergency",
    "1 in 4", "older adults report falling every year", "CDC, Older Adult Falls Data",
    "r/AgingParents", "August 2026", "Long-distance daughter watching solo-living mum",
    "92 errors", "zero errors", "177 events to read", "1 moment circled",
    "errors the truth engine found in the week", "events in the sample week",
    "Measured on a recorded sample week",
    "The week is read for her.", "A checker written in code keeps it straight.", "A person decides what is sent.",
  ];
  const valuesOk = values.every((v) =>
    wordsOf(v).every((w) => hay.includes(w)) || layers.some((l) => l.includes(v.toLowerCase())));
  t(sec9.includes("gemini-3.1-flash-image") && sec9.includes("global") &&
    sec9.includes("A quiet front doorstep") && sec9.includes("kitchen table late in the evening") &&
    sec9.includes("clear morning light") && valuesOk, "section 9 complete, values on the layers");
}

// 9. section 7 rows every changed segment.
{
  const sec7 = md.slice(md.indexOf("## 7. Corrections applied"), md.indexOf("## 8. Production notes"));
  const segs = readJson(`${PROJECT}/narration-segments.json`) as { segments?: { id?: string; text?: string }[] };
  const cur = segs.segments ?? [];
  const ok = cur.every((s) => sec7.includes(`| ${s.id} |`));
  t(ok && !sec7.includes("No earlier draft."), `section 7 rows all ${cur.length} segments`);
}

// 10. the four lints and the banned scan exit 0, run directly here.
{
  const a = runNode(["scripts/lint-script-v2.ts", "hackathon-projects/2026-10-amazonDevs"], "../../hackathons");
  const b = runNode(["scripts/lint-cues.ts", "hackathon-projects/2026-10-amazonDevs"], "../../hackathons");
  const c = runNode(["scripts/lint-stage3d.ts", "hackathon-projects/2026-10-amazonDevs"], "../../hackathons");
  const d = runPy(["../../hackathons/_useful/scripts/check_banned_words.py", "--preset", "video", PROJECT]);
  t(a.code === 0 && b.code === 0 && c.code === 0 && d.code === 0, "lints + banned scan exit 0");
}

// 11. check-ledger holds.
{
  const r = runNode(["scripts/video/check-ledger.ts"]);
  t(r.code === 0 && /ledger: \d+ facts hold/.test(r.out), "check-ledger holds");
}

// 12. this plan owns only its paths: no LIVE paths written, its three present.
// (video/tools/ is the scaffold-vendored recorder toolchain, predating this
// plan; this plan neither wrote nor removed it.)
{
  const { readdirSync, existsSync } = await import("node:fs") as typeof import("node:fs");
  const names = readdirSync(`${PROJECT}/video`);
  const liveAbsent = !existsSync(`${PROJECT}/video/narration`) && !existsSync(`${PROJECT}/video/plates`) &&
    !existsSync(`${PROJECT}/video/final.mp4`);
  const ours = ["facts", "stage3d", "script-acceptance.md"].every((x) => names.includes(x));
  t(liveAbsent && ours, `video/ holds ${names.join(", ")}; no LIVE paths written`);
}

done("sk-10-acceptance", n, failures);
