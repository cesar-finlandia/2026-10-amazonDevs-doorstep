// scripts/verify/sk-09-pitch.ts — DP-SCRIPT WU-09 (10 checks).
// The measured pass catches the faults it is meant to catch, the real
// assets pass it, and each picture was looked at.
import { createHash } from "node:crypto";
import { cpSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { check, done, runNode, runPy } from "../video/lib.js";
import { PROJECT } from "../video/lib.js";

const failures: string[] = [];
let n = 0;
const t = (ok: boolean, label: string): void => {
  n += 1;
  check(n, ok, label, failures);
};
const tmp = "C:/Users/cesar/AppData/Local/Temp/opencode/pitch-mutations";

// 1. the measured pass is green on the real files.
{
  const r = runNode(["scripts/video/check-pitch.ts"]);
  t(r.code === 0 && r.out.trim().split("\n").pop() === "pitch: 0 violations, 9 files", "check-pitch green on real files");
}

// 2. nine files, non-zero; renders 1920x1080.
{
  let ok = true;
  for (const id of ["cover", "slide1", "slide2"]) {
    for (const f of [`${PROJECT}/pitch/${id}.html`, `${PROJECT}/pitch/${id}-image.png`, `${PROJECT}/pitch/${id}.png`]) {
      const buf = readFileSync(f);
      if (buf.length === 0) ok = false;
    }
    const buf = readFileSync(`${PROJECT}/pitch/${id}.png`);
    if (!(buf.readUInt32BE(16) === 1920 && buf.readUInt32BE(20) === 1080)) ok = false;
  }
  t(ok, "nine files non-zero, renders 1920x1080");
}

const freshCopy = (name: string): string => {
  const d = `${tmp}/${name}`;
  mkdirSync(d, { recursive: true });
  cpSync(`${PROJECT}/pitch`, d, { recursive: true });
  return d;
};

// 3. a 12 px paragraph is caught as text-size.
{
  const d = freshCopy("size");
  const html = readFileSync(`${d}/slide1.html`, "utf8");
  writeFileSync(`${d}/slide1.html`, html.replace("</body>", '<p style="font-size:12px">tiny probe words for the size gate</p></body>'));
  const r = runNode(["scripts/video/check-pitch.ts", "--dir", d]);
  t(r.code === 1 && r.out.includes("text-size"), "12px paragraph prints text-size");
}

// 4. a very long unbroken word is caught as overflow.
{
  const d = freshCopy("overflow");
  const html = readFileSync(`${d}/slide2.html`, "utf8");
  writeFileSync(`${d}/slide2.html`, html.replace("</body>", `<p>${"Supercalifragilistic".repeat(20)}</p></body>`));
  const r = runNode(["scripts/video/check-pitch.ts", "--dir", d]);
  t(r.code === 1 && r.out.includes("overflow"), "unbroken word prints overflow");
}

// 5. text in the background colour is caught as contrast.
{
  const d = freshCopy("contrast");
  const html = readFileSync(`${d}/slide1.html`, "utf8");
  writeFileSync(`${d}/slide1.html`, html.replace("</body>", "<style>.panel,.title-block,.lockup{color:#F6F1E7 !important}</style></body>"));
  const r = runNode(["scripts/video/check-pitch.ts", "--dir", d]);
  t(r.code === 1 && r.out.includes("contrast"), "background-coloured text prints contrast");
}

// 6. drawn letters on a copy of cover.png trip the contamination step;
// the real files are unchanged (one check: both must hold).
{
  const before = createHash("sha256").update(readFileSync(`${PROJECT}/pitch/cover.png`)).digest("hex");
  mkdirSync(tmp, { recursive: true });
  const copy = `${tmp}/cover-letters.png`;
  const r = runPy(["scripts/video/draw-letters.py", `${PROJECT}/pitch/cover.png`, copy]);
  let caught = false;
  if (r.code === 0) {
    const c = runNode(["scripts/video/check-pitch.ts", "--contamination", copy, "--expect", `${PROJECT}/pitch/cover.html`]);
    caught = c.code === 1 && c.out.includes("text-contaminated");
  }
  const after = createHash("sha256").update(readFileSync(`${PROJECT}/pitch/cover.png`)).digest("hex");
  t(caught && before === after, `drawn letters print text-contaminated, real cover.png hash ${after.slice(0, 12)} unchanged`);
}

// 7. one review section per asset, each naming a colour and the empty third.
{
  const review = readFileSync(`${PROJECT}/pitch/review.md`, "utf8");
  const sec = (h: string): string => {
    const i = review.indexOf(h);
    if (i === -1) return "";
    const rest = review.slice(i + h.length);
    const next = rest.search(/^## /m);
    return next === -1 ? rest : rest.slice(0, next);
  };
  const ok = ["## Cover", "## Slide 1", "## Slide 2"].every((h) => {
    const body = sec(h);
    return body.split(/[.?!]+/).map((s) => s.trim()).filter((s) => s !== "").length >= 4 &&
      /\b(teal|amber|paper|cream|ink|teal)\b/i.test(body) && /(left|right|empty) third/i.test(body);
  });
  t(ok, "review sections name a colour and the empty third");
}

// 8. measured sizes ≥24 px and contrasts ≥4.5:1, printed as a table.
{
  const r = runNode(["scripts/video/check-pitch.ts", "--verbose"]);
  const rows = r.out.split("\n").filter((l) => l.startsWith("  ") && l.includes("px"));
  const parsed = rows.map((l) => /([\d.]+)px ([\d.]+):1/.exec(l)).filter((m) => m !== null);
  const ok = r.code === 0 && parsed.length >= 9 &&
    parsed.every((m) => Number(m![1]) >= 24 && Number(m![2]) >= 4.5);
  console.log("table:");
  for (const row of rows) console.log(row);
  t(ok, `sizes and contrasts table (${parsed.length} nodes, all ≥24px and ≥4.5:1)`);
}

// 9. words live in HTML: wordless images, no background text assets, no alpha.
{
  let ok = true;
  for (const id of ["cover", "slide1", "slide2"]) {
    const html = readFileSync(`${PROJECT}/pitch/${id}.html`, "utf8");
    for (const m of html.matchAll(/<img\b[^>]*>/gi)) if (!/alt=""/.test(m[0])) ok = false;
    if (/background-image\s*:\s*url/i.test(html)) ok = false;
    const pic = readFileSync(`${PROJECT}/pitch/${id}-image.png`);
    if (pic[25] === 4 || pic[25] === 6) ok = false;
  }
  t(ok, "HTML carries the words, pictures carry none");
}

// 10. no banned words over the pitch texts.
{
  const files = ["cover.html", "slide1.html", "slide2.html", "review.md"].map((f) => `${PROJECT}/pitch/${f}`);
  const rs = files.map((f) => runPy(["../../hackathons/_useful/scripts/check_banned_words.py", "--preset", "video", f]));
  t(rs.every((r) => r.code === 0), "pitch texts unbanned");
}

done("sk-09-pitch", n, failures);
