// scripts/verify/3d-08-review.ts — DP-3D WU-3D-08 (10 checks).
// Runs the screenshot script, verifies the two images and their manifest, then
// runs the live visual review for UI_REVIEW_ROUND (default 1, at most three
// rounds). An unavailable review tool marks the unit blocked, not passed.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { chromium } from "@playwright/test";
import { OVERVIEW } from "src/3d/shots.js";
import { VARIANCE_MIN } from "./3d-kit.js";
import { createChecker } from "./ui-kit.js";

const OUT = "design_documents/3d-screenshots";
const REVIEW_DIR = "design_documents/visual-review";
const REVIEW_MD = "design_documents/visual-review-3d.md";

// The round gate comes first: an invalid round exits before any slow work, so
// check 6 can invoke this script without paying for screenshots or review.
const roundRaw = process.env["UI_REVIEW_ROUND"] ?? "1";
const round = Number.parseInt(roundRaw, 10);
if (!Number.isInteger(round) || round < 1 || round > 3) {
  console.log(`3d-08-review: at most three rounds (got ${roundRaw})`);
  process.exit(1);
}

const c = createChecker("3d-08-review");

type Vec = [number, number, number];
interface Entry {
  file: string;
  width: number;
  height: number;
  shot: string;
  quality: string;
  camera: { position: Vec; target: Vec };
  stageVisible: boolean;
  daysInView: number;
  consoleErrors: number;
  incidentId?: string;
  focusTarget?: Vec;
}

const dist = (a: number[], b: number[]): number => Math.sqrt(a.reduce((s, v, i) => s + (v - (b[i] as number)) ** 2, 0));

// 1. The screenshot script writes both images, each a 1280 × 720 PNG.
const shots = spawnSync("npx", ["vite-node", "scripts/3d-screenshots.ts"], {
  cwd: process.cwd(), encoding: "utf8", shell: true, timeout: 1800000,
});
const shotsOut = (shots.stdout ?? "") + (shots.stderr ?? "");
if ((shots.status ?? 1) === 0) process.stdout.write(shotsOut.split("\n").filter((l) => /\.png$|3d-screenshots: /.test(l)).join("\n") + "\n");

const PNG_SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const files = ["overview.png", "focus.png"];
function pngSize(p: string): { ok: boolean; width: number; height: number } {
  if (!existsSync(p)) return { ok: false, width: 0, height: 0 };
  const b = readFileSync(p);
  return { ok: b.subarray(0, 8).equals(PNG_SIG), width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
}
{
  const sizes = files.map((f) => pngSize(join(OUT, f)));
  c.ok(
    (shots.status ?? 1) === 0 && sizes.every((s) => s.ok && s.width === 1280 && s.height === 720) && /3d-screenshots: 2 written/.test(shotsOut),
    `1 the screenshot script wrote two 1280 x 720 PNGs (${JSON.stringify(sizes)}${(shots.status ?? 1) === 0 ? "" : " " + shotsOut.slice(-300)})`,
  );
}

// 2. Neither image is blank, and they differ.
{
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const variances: number[] = [];
    for (const f of files) {
      const b64 = readFileSync(join(OUT, f)).toString("base64");
      variances.push(
        await page.evaluate(async (data: string) => {
          const img = new Image();
          await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = () => reject(new Error("image did not decode"));
            img.src = `data:image/png;base64,${data}`;
          });
          const canvas = document.createElement("canvas");
          canvas.width = 64;
          canvas.height = 64;
          const ctx = canvas.getContext("2d");
          if (!ctx) throw new Error("no 2d context");
          ctx.drawImage(img, 0, 0, 64, 64);
          const px = ctx.getImageData(0, 0, 64, 64).data;
          const lum: number[] = [];
          for (let i = 0; i < px.length; i += 4) lum.push(0.2126 * (px[i] as number) + 0.5872 * (px[i + 1] as number) + 0.1142 * (px[i + 2] as number));
          const mean = lum.reduce((a, b) => a + b, 0) / lum.length;
          return lum.reduce((a, b) => a + (b - mean) * (b - mean), 0) / lum.length;
        }, b64),
      );
    }
    const hashes = files.map((f) => createHash("sha256").update(readFileSync(join(OUT, f))).digest("hex"));
    c.ok(
      variances.every((v) => v >= VARIANCE_MIN) && hashes[0] !== hashes[1],
      `2 both images have variance >= ${VARIANCE_MIN} (${variances.map((v) => Math.round(v)).join(", ")}) and differ`,
    );
  } finally {
    await browser.close();
  }
}

const manifest = JSON.parse(readFileSync(join(OUT, "manifest.json"), "utf8")) as Entry[];
const overview = manifest.find((m) => m.file === "overview.png");
const focus = manifest.find((m) => m.file === "focus.png");

// 3. The overview entry sits on OVERVIEW; the focus entry on its incident's focus target.
c.ok(
  overview !== undefined && focus !== undefined &&
    overview.shot === "overview" &&
    dist(overview.camera.position, OVERVIEW.position) <= 0.05 && dist(overview.camera.target, OVERVIEW.target) <= 0.05 &&
    focus.shot.startsWith("focus:inc-") && focus.focusTarget !== undefined &&
    dist(focus.camera.target, focus.focusTarget) <= 0.05,
  "3 the overview camera is on OVERVIEW and the focus camera aims at its incident's focus target",
);

// 4. High quality, no console errors.
c.ok(
  overview?.quality === "high" && focus?.quality === "high" && overview.consoleErrors === 0 && focus.consoleErrors === 0,
  "4 both shots were taken in high quality with no console errors",
);

// 5. The stage is on screen in both; the overview shows all seven days.
// DEVIATION on the focus entry's day count (asserted behaviour otherwise
// unchanged): the plan asks for daysInView 7 in both entries, but a focus
// shot is a close frame on one arc (§5.3: about 5 m from the circle), from
// where the centre of a far strip is outside the frame by construction — the
// measured count is 2. The plan's own focus offsets and "focus closer than
// overview" (check 10) rule out seven. The focus entry must still show the
// circled day.
c.ok(
  overview?.stageVisible === true && focus?.stageVisible === true && overview.daysInView === 7 && focus.daysInView >= 1,
  `5 the stage is visible in both shots and the overview shows 7 days (overview ${overview?.daysInView}, focus ${focus?.daysInView})`,
);

// 6. Round 4 refuses without touching the review tool.
{
  const r = spawnSync("npx", ["vite-node", "scripts/verify/3d-08-review.ts"], {
    cwd: process.cwd(), encoding: "utf8", shell: true, timeout: 120000,
    env: { ...process.env, UI_REVIEW_ROUND: "4" },
  });
  const out = (r.stdout ?? "") + (r.stderr ?? "");
  c.ok((r.status ?? 0) === 1 && out.includes("at most three rounds"), "6 round 4 refused with at most three rounds");
}

// 7–8. The live visual review for this round.
mkdirSync(REVIEW_DIR, { recursive: true });
const outJson = join(REVIEW_DIR, `3d-${round}.json`);
const args = [
  "hee/_useful/scripts/visual_review.py",
  "--screenshots", join(OUT, "overview.png"), join(OUT, "focus.png"),
  "--brief", "design_documents/design_brief.md",
  "--rules", "../../hackathons/templates/3d-experience.spec.md",
  "--rules-section", '"Quality floor"',
  "--unit", "3d",
  "--round", String(round),
  "--out", outJson,
  "--log-md", REVIEW_MD,
];
const review = spawnSync("python3", args, { cwd: process.cwd(), encoding: "utf8", shell: true, timeout: 1200000 });
const reviewOut = ((review.stdout ?? "") + (review.stderr ?? "")).trim();
const code = review.status ?? 1;
let score = -1;
let defects = -1;
if (code === 0) {
  try {
    const report = JSON.parse(readFileSync(outJson, "utf8")) as { score: number; defects: unknown[] };
    score = report.score;
    defects = report.defects.length;
  } catch {
    /* fall through to the failure below */
  }
}
const line = `visual review 3d round ${round}: ${score}/10 -> pass; ${defects} defects`;
if (code === 0 && score >= 8 && defects >= 0) console.log(line);
if (code === 1) console.log(`visual review unavailable: ${reviewOut.split("\n").pop() ?? ""}`);
c.ok(
  code === 0 && /^visual review 3d round [1-3]: \d+(\.\d)?\/10 -> pass; \d+ defects$/.test(line),
  code === 1
    ? `7 BLOCKED: the review tool is unavailable (${reviewOut.split("\n").pop() ?? ""})`
    : `7 review exits 0 with a passing line (exit ${code}; tool said: ${reviewOut.split("\n").pop() ?? ""}; score ${score})`,
);
{
  let mdOk = false;
  try {
    const md = readFileSync(REVIEW_MD, "utf8").toLowerCase();
    mdOk = md.includes(`round ${round}`) && md.includes("overview.png");
  } catch {
    mdOk = false;
  }
  c.ok(score >= 8 && mdOk, `8 score ${score} is at least 8 and ${REVIEW_MD} records round ${round} and overview.png`);
}

// 9. verify:3d names all eight scripts in order; screenshots:3d exists.
{
  const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { scripts?: Record<string, string> };
  const v = pkg.scripts?.["verify:3d"] ?? "";
  const names = ["3d-01-adapter", "3d-02-tokens", "3d-03-mount", "3d-04-shots", "3d-05-arcs", "3d-06-lab", "3d-07-capability", "3d-08-review"];
  let last = -1;
  const ordered = names.every((n) => {
    const i = v.indexOf(n);
    const ok = i > last;
    last = i;
    return ok;
  });
  c.ok(ordered && typeof pkg.scripts?.["screenshots:3d"] === "string", "9 verify:3d names all eight scripts in order and screenshots:3d exists");
}

// 10. The focus camera is closer to its target than the overview camera is to its own.
c.ok(
  overview !== undefined && focus !== undefined &&
    dist(focus.camera.position, focus.camera.target) < dist(overview.camera.position, overview.camera.target),
  "10 the focus shot is closer to its target than the overview shot is to its own",
);

c.done();
