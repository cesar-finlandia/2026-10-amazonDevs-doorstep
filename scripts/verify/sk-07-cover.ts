// scripts/verify/sk-07-cover.ts — DP-SCRIPT WU-07 (10 checks).
// The picture route is real and recorded, the cover is a generated image
// with zero text under an HTML title block, and it was looked at.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { check, done, runNode, runPy } from "../video/lib.js";
import { PROJECT, readJson } from "../video/lib.js";

const failures: string[] = [];
let n = 0;
const t = (ok: boolean, label: string): void => {
  n += 1;
  check(n, ok, label, failures);
};
const hash = (f: string): string => createHash("sha256").update(readFileSync(f)).digest("hex");

// 1. brand copy byte-identical.
t(hash("brand/brandmark.css") === hash(`${PROJECT}/brand/brandmark.css`), "brandmark.css byte-identical");

// 2. pitch/work holds plates.json (only) with the §5.7 style, negative and prompts.
{
  const work = `${PROJECT}/pitch/work`;
  const plates = readJson(`${work}/plates.json`) as {
    style?: string; negative?: string; plates?: { id?: string; prompt?: string }[];
  };
  // pitch/work holds plates.json and no cinematic-tokens.json (outputs live
  // under video/; the tokens file must not sit beside plates.json where the
  // tool would read it and append a dark key).
  let workOk = false;
  try {
    const { readdirSync } = await import("node:fs") as typeof import("node:fs");
    const names = readdirSync(work);
    workOk = names.includes("plates.json") && !names.includes("cinematic-tokens.json");
  } catch { workOk = false; }
  const style = "Editorial gouache illustration on warm paper, soft grain, matte flat shapes with hand-drawn pencil edges, one clear focal subject. Palette: dominant #F6F1E7 warm paper, secondary #D9EAE6 pale teal, accent #1B6A62 deep teal, a touch of #8F4B00 amber for lamplight. Light key, gentle morning or dusk light.";
  const negative = "no text, no letters, no numbers, no words, no logos, no watermarks, no user interface, no screenshots, no stock-photo clichés: no handshakes, no glowing brains, no circuit boards, no upward arrows, no laptops on desks, no generic robots";
  const prompts: Record<string, string> = {
    cover: "A quiet front doorstep at dusk seen from the pavement: a worn welcome mat, a potted geranium, a warm porch lamp, the door slightly open with amber light spilling across the step. A loose hand-drawn pencil circle drawn around the lit gap of the door. Subject on the right third; the left third is empty warm paper for a title block.",
    slide1: "A woman in her thirties at a kitchen table late in the evening, phone face down beside a cold mug, looking out of a dark window toward a far-off lit train platform; the room crowded with small unfinished things, a coat over a chair, a stack of unopened post. Subject on the left third; the right third is quiet empty background for a quote block.",
    slide2: "The same woman at the same kitchen table in clear morning light, a fresh mug, phone resting open and calm, a tidy table, the window now bright with a small distant figure at a lit doorstep. Same illustration style and palette as the evening scene, mirrored composition: subject on the right third; the left third is quiet empty background for a before-and-after block.",
  };
  const ids = (plates.plates ?? []).map((p) => p.id);
  const promptsOk = (plates.plates ?? []).every((p) => prompts[p.id ?? ""] === p.prompt);
  t(workOk && plates.style === style && plates.negative === negative &&
    JSON.stringify(ids) === JSON.stringify(["cover", "slide1", "slide2"]) && promptsOk,
    "plates.json: §5.7 style, negative and three prompts verbatim");
}

// 3. dry-run exits 0 and prints the three ids.
{
  const r = runPy(["../../hackathons/_useful/scripts/compose_plates.py", "--project", `${PROJECT}/pitch/work`, "--dry-run"]);
  t(r.code === 0 && ["cover", "slide1", "slide2"].every((id) => r.out.includes(`--- ${id} ---`)), "dry-run prints cover, slide1, slide2");
}

// 4. manifest records a non-preview model and a region; production notes repeat the pair.
{
  const manifest = readJson(`${PROJECT}/pitch/work/video/plates/plates-manifest.json`) as {
    plates?: { id?: string; model?: string; region?: string }[];
  };
  const cover = manifest.plates?.find((p) => p.id === "cover");
  const notes = readFileSync(`${PROJECT}/demo-video-script.md`, "utf8");
  t(!!cover?.model && cover.model.length > 0 && !/preview/i.test(cover.model) &&
    !!cover?.region && notes.includes(cover.model) && notes.includes(cover.region),
    `manifest model ${cover?.model} region ${cover?.region}, repeated in production notes`);
}

// 5. cover-image.png: PNG, long side at least 1280, larger than 100 kB.
{
  const buf = readFileSync(`${PROJECT}/pitch/cover-image.png`);
  const isPng = buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
  const w = buf.readUInt32BE(16);
  const h = buf.readUInt32BE(20);
  t(isPng && Math.max(w, h) >= 1280 && buf.length > 100 * 1024, `cover-image.png ${w}x${h}, ${(buf.length / 1024).toFixed(0)} kB`);
}

// 6. the measured contamination test finds no letters or digits.
{
  const r = runPy(["scripts/video/contamination.py", `${PROJECT}/pitch/cover-image.png`]);
  const review = readFileSync(`${PROJECT}/pitch/review.md`, "utf8");
  t(r.code === 0 && r.out.includes("contamination: clean") && /no letters or digits/i.test(review),
    `contamination measured (${r.out.trim().split("\n").pop()})`);
}

// 7. cover.html carries the three texts in HTML, links the brand CSS.
{
  const html = readFileSync(`${PROJECT}/pitch/cover.html`, "utf8");
  const imgs = [...html.matchAll(/<img\b[^>]*>/gi)];
  t(html.includes("Doorstep Rhythm") && html.includes("Know her day without calling.") &&
    html.includes("Ring track") && html.includes("../brand/brandmark.css") &&
    imgs.length === 1 && /alt=""/.test(imgs[0]?.[0] ?? ""), "cover.html: words in HTML, picture wordless");
}

// 8. render-pitch prints its line; cover.png is 1920x1080.
{
  const r = runNode(["scripts/video/render-pitch.ts"]);
  const buf = readFileSync(`${PROJECT}/pitch/cover.png`);
  t(/pitch: \d+ rendered/.test(r.out) && buf.readUInt32BE(16) === 1920 && buf.readUInt32BE(20) === 1080,
    `render line present, cover.png 1920x1080`);
}

// 9. measured layout: app name the single largest text, ≥96 px, inside the
// stage; the title block stays off the subject (right) third.
{
  const layout = readJson(`${PROJECT}/pitch/cover-layout.json`) as {
    texts?: { px?: number }[]; appName?: { x: number; y: number; w: number; h: number };
    titleBlock?: { x: number; y: number; w: number; h: number };
  };
  const sizes = (layout.texts ?? []).map((x) => x.px ?? 0);
  const appPx = Math.max(...sizes);
  const appCount = sizes.filter((s) => s === appPx).length;
  const a = layout.appName;
  const inside = !!a && a.x >= 0 && a.y >= 0 && a.x + a.w <= 1920 && a.y + a.h <= 1080;
  const tb = layout.titleBlock;
  t(appPx >= 96 && appCount === 1 && inside && !!tb && tb.x + tb.w <= 1280,
    `app name ${appPx}px largest, inside stage, title block ends x=${tb?.x ?? 0 + (tb?.w ?? 0)}`);
}

// 10. review.md ## Cover of at least three sentences, no praise filler, no banned words.
{
  const review = readFileSync(`${PROJECT}/pitch/review.md`, "utf8");
  const sec = review.slice(review.indexOf("## Cover"));
  const sentences = sec.split(/[.?!]+/).map((s) => s.trim()).filter((s) => s !== "");
  const r = runPy(["../../hackathons/_useful/scripts/check_banned_words.py", "--preset", "video", `${PROJECT}/pitch/review.md`]);
  t(sentences.length >= 3 && !/looks good/i.test(sec) && r.code === 0, `## Cover ${sentences.length} sentences, no filler, no banned words`);
}

done("sk-07-cover", n, failures);
