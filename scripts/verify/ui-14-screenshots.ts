// scripts/verify/ui-14-screenshots.ts — DP-UI WU-UI-14 (12 checks).
// Requirement IDs: FR-19
// Verifies the twenty screenshots of scripts/ui-screenshots.ts (run it first
// when outputs are missing), then runs the live visual review for
// UI_REVIEW_ROUND (default 1, at most three rounds).
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { chromium } from "@playwright/test";
import { createChecker } from "./ui-kit.js";

const OUT = "design_documents/ui-screenshots";
const REVIEW_DIR = "design_documents/visual-review";
const REVIEW_MD = "design_documents/visual-review-ui.md";

// The round gate comes first: an invalid round exits before any slow work,
// so check 9 can invoke this script without paying for screenshots or review.
const roundRaw = process.env["UI_REVIEW_ROUND"] ?? "1";
const round = Number.parseInt(roundRaw, 10);
if (!Number.isInteger(round) || round < 1 || round > 3) {
  console.log(`ui-14-screenshots: at most three rounds (got ${roundRaw})`);
  process.exit(1);
}

const c = createChecker("ui-14-screenshots");

const FILES = [
  "home-paper.png", "home-dusk.png", "home-1280x720-paper.png",
  "appbar-paper.png", "appbar-dusk.png", "explainer-open-paper.png",
  "help-popover-paper.png", "working-paper.png", "empty-paper.png",
  "error-paper.png", "degraded-paper.png", "metrics-widest-paper.png",
  "approval-pending-paper.png", "incident-selected-paper.png",
  "ribbon-detail-paper.png", "lockup-contact-sheet.png",
  "home-390-paper.png", "home-390-dusk.png", "lab-paper.png", "watch-paper.png",
];

// Refresh missing outputs; otherwise verify in place (a full reshoot costs
// ~10 min and the committed shots are the evidence under review).
if (!existsSync(join(OUT, "manifest.json")) || FILES.some((f) => !existsSync(join(OUT, f)))) {
  const r = spawnSync("npx", ["vite-node", "scripts/ui-screenshots.ts"], {
    cwd: process.cwd(), encoding: "utf8", shell: true, timeout: 1800000,
  });
  if ((r.status ?? 1) !== 0) throw new Error(`screenshot run failed: ${(r.stdout ?? "") + (r.stderr ?? "")}`);
}

const PNG_SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
function pngSize(p: string): { width: number; height: number } {
  const b = readFileSync(p);
  if (!b.subarray(0, 8).equals(PNG_SIG)) throw new Error(`${p} is not a PNG`);
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
}

// 1. Exactly the 20 names of §5.10, each a real PNG.
{
  const missing = FILES.filter((f) => !existsSync(join(OUT, f)));
  let sigOk = true;
  for (const f of FILES) {
    try {
      pngSize(join(OUT, f));
    } catch {
      sigOk = false;
    }
  }
  c.ok(missing.length === 0 && sigOk, "1 twenty PNG files with the §5.10 names");
}

// 2. Dimensions.
{
  const dim = (f: string): string => {
    const s = pngSize(join(OUT, f));
    return `${s.width}x${s.height}`;
  };
  const ok1280 = dim("home-1280x720-paper.png") === "1280x720";
  const ok390 = ["home-390-paper.png", "home-390-dusk.png"].every((f) => pngSize(join(OUT, f)).width === 390);
  const okBar = ["appbar-paper.png", "appbar-dusk.png"].every((f) => {
    const s = pngSize(join(OUT, f));
    return s.height <= 120 && s.width >= 1000;
  });
  const okRest = FILES.filter((f) => f !== "lockup-contact-sheet.png" && !f.startsWith("home-1280") && !f.startsWith("home-390") && !f.startsWith("appbar-")).every(
    (f) => dim(f) === "1440x900",
  );
  c.ok(ok1280 && ok390 && okBar && okRest, "2 1280, 390, appbar clips and 1440x900 frames");
}

// 3. Every file is substantial (app-bar clips smaller).
{
  const ok = FILES.every((f) => {
    const n = statSync(join(OUT, f)).size;
    return f.startsWith("appbar-") ? n > 5000 : n > 15000;
  });
  c.ok(ok, "3 files larger than 15 kB (appbar 5 kB)");
}

// 4. Twenty distinct hashes.
{
  const hashes = new Set(FILES.map((f) => createHash("sha256").update(readFileSync(join(OUT, f))).digest("hex")));
  c.ok(hashes.size === 20, "4 twenty distinct SHA-256 values");
}

// 5. Paper is lighter than dusk by more than 60 (canvas read in the browser).
{
  async function mean(path: string): Promise<number> {
    const browser = await chromium.launch();
    try {
      const page = await browser.newPage();
      await page.goto("about:blank");
      const data = readFileSync(path).toString("base64");
      return (await page.evaluate((b64: string) => {
        const img = new Image();
        const done = new Promise<number>((resolve, reject) => {
          img.onload = () => {
            const cv = document.createElement("canvas");
            cv.width = img.width;
            cv.height = img.height;
            const ctx = cv.getContext("2d");
            if (!ctx) {
              reject(new Error("no 2d context"));
              return;
            }
            ctx.drawImage(img, 0, 0);
            const d = ctx.getImageData(0, 0, cv.width, cv.height).data;
            let sum = 0;
            for (let i = 0; i < d.length; i += 4) sum += (d[i] as number) * 0.2126 + (d[i + 1] as number) * 0.7152 + (d[i + 2] as number) * 0.0722;
            resolve(sum / (d.length / 4));
          };
          img.onerror = () => reject(new Error("img load failed"));
        });
        img.src = "data:image/png;base64," + b64;
        return done;
      }, data)) as number;
    } finally {
      await browser.close();
    }
  }
  const paper = await mean(join(OUT, "home-paper.png"));
  const dusk = await mean(join(OUT, "home-dusk.png"));
  const paper390 = await mean(join(OUT, "home-390-paper.png"));
  const dusk390 = await mean(join(OUT, "home-390-dusk.png"));
  c.ok(paper - dusk > 60 && paper390 - dusk390 > 60, `5 paper lighter than dusk by > 60 (${Math.round(paper - dusk)}, ${Math.round(paper390 - dusk390)})`);
}

// 6-8. The manifest.
const manifest = JSON.parse(readFileSync(join(OUT, "manifest.json"), "utf8")) as {
  file: string; width: number; height: number; theme: string; textSeen: string[]; craft: boolean;
}[];
{
  const wide = manifest.find((m) => m.file === "metrics-widest-paper.png");
  c.ok(
    manifest.length === 20 && !!wide && wide.textSeen.includes("99+") && wide.textSeen.includes("999") && wide.textSeen.includes("$99.9999"),
    "6 manifest has 20 entries with the widest metric seen",
  );
}
{
  const need: Record<string, string> = {
    "working-paper.png": "Reading doorway events",
    "approval-pending-paper.png": "AGENT WANTS TO",
    "error-paper.png": "Couldn't read Ring",
    "degraded-paper.png": "Replaying a recorded run",
    "empty-paper.png": "No doorway events yet",
  };
  const ok = Object.entries(need).every(([f, s]) => manifest.find((m) => m.file === f)?.textSeen.includes(s) === true);
  c.ok(ok, "7 state banners seen in the manifest");
}
{
  const ok = ["home-paper.png", "home-dusk.png", "home-390-paper.png", "home-390-dusk.png"].every(
    (f) => manifest.find((m) => m.file === f)?.craft === true,
  );
  c.ok(ok, "8 the four home shots pass the craft assertions");
}

// 9. Round 4 refuses without touching the review tool.
{
  const r = spawnSync("npx", ["vite-node", "scripts/verify/ui-14-screenshots.ts"], {
    cwd: process.cwd(), encoding: "utf8", shell: true, timeout: 120000,
    env: { ...process.env, UI_REVIEW_ROUND: "4" },
  });
  const out = (r.stdout ?? "") + (r.stderr ?? "");
  c.ok((r.status ?? 0) === 1 && out.includes("at most three rounds"), "9 round 4 refused with at most three rounds");
}

// 10-11. The live visual review for this round.
{
  mkdirSync(REVIEW_DIR, { recursive: true });
  const outJson = join(REVIEW_DIR, `ui-${round}.json`);
  const args = [
    "hee/_useful/scripts/visual_review.py",
    "--screenshots",
    join(OUT, "home-paper.png"),
    join(OUT, "incident-selected-paper.png"),
    join(OUT, "home-390-paper.png"),
    "--brief", "design_documents/design_brief.md",
    "--rules", "../../hackathons/templates/ui-craft.spec.md",
    "--unit", "ui",
    "--round", String(round),
    "--out", outJson,
    "--log-md", REVIEW_MD,
  ];
  const r = spawnSync("python3", args, { cwd: process.cwd(), encoding: "utf8", shell: true, timeout: 1200000 });
  const out = (r.stdout ?? "") + (r.stderr ?? "");
  const code = r.status ?? 1;
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
  const line = `visual review ui round ${round}: ${score}/10 -> pass; ${defects} defects`;
  if (code === 0 && score >= 8 && defects >= 0) console.log(line);
  c.ok(code === 0 && /^visual review ui round [1-3]: \d+(\.\d)?\/10 -> pass; \d+ defects$/.test(line), `10 review exits 0 with a passing line (tool said: ${out.trim().split("\n").pop() ?? ""} score=${score})`);
  let mdOk = false;
  try {
    mdOk = score >= 8 && readFileSync(REVIEW_MD, "utf8").toLowerCase().includes(`round ${round}`);
  } catch {
    mdOk = false;
  }
  c.ok(score >= 8 && mdOk, `11 score ${score} at least 8 with round ${round} in the log`);
}

// 12. verify:ui names all fourteen scripts in order.
{
  const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { scripts?: Record<string, string> };
  const v = pkg.scripts?.["verify:ui"] ?? "";
  const names = [
    "ui-01-brief", "ui-02-brand", "ui-03-tokens", "ui-04-shell", "ui-05-primitives", "ui-06-ribbon",
    "ui-07-checks", "ui-08-workbench", "ui-09-rail", "ui-10-liveview", "ui-11-states", "ui-12-hero",
    "ui-craft", "ui-14-screenshots",
  ];
  let last = -1;
  const ordered = names.every((n) => {
    const i = v.indexOf(n);
    const ok = i > last;
    last = i;
    return ok;
  });
  c.ok(ordered, "12 verify:ui names all fourteen scripts in order");
}

c.done();
