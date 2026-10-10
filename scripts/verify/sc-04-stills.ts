// scripts/verify/sc-04-stills.ts — DP-SHOWCASE WU-SHOWCASE-04 (10 checks).
// Requirement IDs: FR-25 (part)
import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import sharp from "sharp";
import { createChecker } from "./ui-kit.js";
import { run } from "./e2e-kit.js";
import { captionError, countGifFrames } from "../../hee/src/showcase/stills.js";
import { compileSchema, loadSchema } from "../../hee/src/llm/index.js";

const c = createChecker("sc-04-stills");
const IDS = ["week", "agent", "approval", "circle", "stage", "dusk"];

// 1+2. Run the stills; base + webgl lines; tool line with >= 8 hero frames.
const stills = run("npx", ["vite-node", "scripts/make-stills.ts"]);
const baseLine = stills.out.split("\n").map((l) => l.trim()).find((l) => l.startsWith("stills: base ")) ?? "";
const toolLine = stills.out.split("\n").map((l) => l.trim()).find((l) => /^stills: 6 stills, \d+ hero frames/.test(l)) ?? "";
const hm = /stills: 6 stills, (\d+) hero frames/.exec(toolLine);
c.ok(stills.code === 0 && baseLine.startsWith("stills: base http"), `prints ${baseLine || "(no base line)"}`);
c.ok(
  stills.out.split("\n").some((l) => l.trim() === "stills: webgl yes") && hm !== null && Number(hm[1]) >= 8,
  `webgl yes; tool line "${toolLine}" (frames>=8)`,
);

// 3. Files present.
const missing = IDS.flatMap((id) => [`shots/showcase/gallery-${id}.png`, `shots/showcase/readme-${id}.png`])
  .filter((f) => !existsSync(f));
c.ok(missing.length === 0 && existsSync("shots/showcase/hero.gif") && existsSync("shots/showcase/captions.json"), `all stills + gif + captions (${missing.join(",") || "present"})`);

// 4. Dimensions.
let dimsOk = true;
for (const id of IDS) {
  const g = await sharp(`shots/showcase/gallery-${id}.png`).metadata();
  const r = await sharp(`shots/showcase/readme-${id}.png`).metadata();
  if (g.width !== 1500 || g.height !== 1000 || r.width !== 1000 || r.height !== 667) dimsOk = false;
}
c.ok(dimsOk, "gallery 1500x1000, readme 1000x667");

// 5. Hero size + frames.
const hero = readFileSync("shots/showcase/hero.gif");
c.ok(hero.length <= 6000000 && countGifFrames(hero) >= 8, `hero ${hero.length}b, ${countGifFrames(hero)} frames`);

// 6. Captions schema, 13 entries, clean.
const captions = JSON.parse(readFileSync("shots/showcase/captions.json", "utf8")) as { caption?: string }[];
const schemaOk = (compileSchema(loadSchema("contracts/hee-captions.schema.json")) as (d: unknown) => { ok: boolean })(captions);
c.ok(
  (schemaOk as { ok: boolean }).ok === true && captions.length === 13 &&
    captions.every((x) => typeof x.caption === "string" && captionError(x.caption) === null),
  `captions schema ok, 13 entries, all clean`,
);

// 7. No blank still (luminance stddev >= 8).
let lumOk = true;
for (const id of IDS) {
  for (const size of ["gallery", "readme"]) {
    const stats = await sharp(`shots/showcase/${size}-${id}.png`).stats();
    const sd = stats.channels[0]?.stdev ?? 0;
    if (!(sd >= 8)) lumOk = false;
  }
}
c.ok(lumOk, "no blank still (stddev>=8)");

// 8. Stage differs from week; stage non-flat.
const sha = (p: string): string => createHash("sha256").update(readFileSync(p)).digest("hex");
const stageStats = await sharp("shots/showcase/gallery-stage.png").stats();
const stageSd = stageStats.channels[0]?.stdev ?? 0;
c.ok(sha("shots/showcase/gallery-stage.png") !== sha("shots/showcase/gallery-week.png") && stageSd >= 8, "stage differs, non-flat");

// 9. claims lint clean for captions.
const lint = run("npx", ["vite-node", "hee/src/showcase/cli.ts", "claims", "lint", "--entry", "."]);
c.ok(!lint.out.split("\n").some((l) => l.startsWith("shots/showcase/captions.json")), "claims lint clean for captions");

// 10. Banned-words scan clean.
const banned = run("python3", ["../../hackathons/_useful/scripts/check_banned_words.py", "shots/showcase/captions.json"]);
c.ok(banned.code === 0, "banned-words scan exits 0");

void statSync;
c.done();
