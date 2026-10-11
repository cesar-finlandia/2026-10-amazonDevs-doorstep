// scripts/verify/sk-08-slides.ts — DP-SCRIPT WU-08 (10 checks).
// Two light-mode slides whose evidence is verified and whose numbers come
// from the ledger.
import { readFileSync } from "node:fs";
import { check, done, runNode, runPy } from "../video/lib.js";
import { PROJECT, readJson } from "../video/lib.js";

const failures: string[] = [];
let n = 0;
const t = (ok: boolean, label: string): void => {
  n += 1;
  check(n, ok, label, failures);
};
const s1 = readFileSync(`${PROJECT}/pitch/slide1.html`, "utf8");
const s2 = readFileSync(`${PROJECT}/pitch/slide2.html`, "utf8");
const review = readFileSync(`${PROJECT}/pitch/review.md`, "utf8");
const ledger = readJson(`${PROJECT}/fact-ledger.json`) as { rows?: { id?: string; value?: number }[] };
const ledVal = (id: string): number => ledger.rows?.find((r) => r.id === id)?.value ?? Number.NaN;

// 1. the slide-1 quote is verbatim from a mined record, attributed with
// community and month, dated no later than today.
{
  const mined = readJson(`${PROJECT}/mined_frustrations.json`) as {
    records?: { subreddit?: string; excerpt?: string; timestamp?: string; rough_date?: string }[];
  };
  const quote = "from a distance no one can tell a slow day from an emergency";
  const rec = (mined.records ?? []).find((r) => (r.excerpt ?? "").includes(quote));
  const today = new Date().toISOString().slice(0, 10);
  t(!!rec && s1.includes(quote) && s1.includes("r/AgingParents") && s1.includes("August 2026") &&
    (rec.timestamp ?? "9").slice(0, 10) <= today, `quote verbatim from ${rec?.subreddit} ${rec?.rough_date}`);
}

// 2. the published figure rides on a fetched publisher sentence (title + date).
{
  const ev = review.slice(review.indexOf("## Evidence"));
  t(s1.includes("1 in 4") && ev.includes("Over 14 million, or 1 in 4 older adults report falling every year") &&
    ev.includes("Older Adult Falls Data") && ev.includes("2026-10-11"), "figure sourced from the fetched CDC page");
}

// 3. W2 evidence.text is the figure on slide 1; no pending string left.
{
  const plan = readJson(`${PROJECT}/beat-plan.json`) as {
    beats?: { id?: string; props?: { evidence?: { text?: string } } }[];
  };
  const text = plan.beats?.find((b) => b.id === "W2")?.props?.evidence?.text ?? "";
  const raw = readFileSync(`${PROJECT}/beat-plan.json`, "utf8");
  t(text === "1 in 4" && s1.includes(text) && !raw.includes("pending WU-SCRIPT-08"), `W2 evidence '${text}', pending replaced`);
}

// 4. slide-2 pairs are the ledger's, marked measured; no unmarked modelled row.
{
  const first = ledVal("F-errors-first");
  const events = ledVal("F-bundle-events");
  t(s2.includes(`${first} errors`) && s2.includes(`${events} events`) && /measured/i.test(s2) &&
    !/modelled/i.test(s2), `pairs ${first} errors, ${events} events, measured`);
}

// 5. the paper theme, read in the browser.
{
  const { chromium } = await import("playwright");
  const { pathToFileURL } = await import("node:url");
  const browser = await chromium.launch({ args: ["--no-sandbox"] });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  let ok = true;
  for (const id of ["slide1", "slide2"]) {
    await page.goto(pathToFileURL(`${PROJECT}/pitch/${id}.html`).href, { waitUntil: "load" });
    const colors = await page.evaluate(() => {
      const stage = document.querySelector(".stage");
      const body = document.body;
      return {
        bg: stage ? getComputedStyle(stage).backgroundColor : "",
        ink: body ? getComputedStyle(body).color : "",
      };
    });
    if (colors.bg !== "rgb(246, 241, 231)") ok = false;
    const ink = await page.evaluate(() => getComputedStyle(document.querySelector(".panel") as Element).color);
    if (ink !== "rgb(34, 29, 22)") ok = false;
  }
  await browser.close();
  t(ok, "stage #F6F1E7, panel text #221D16 in the browser");
}

// 6. both pictures are PNGs over 100 kB and pass the contamination test.
{
  const { readFileSync: rf } = await import("node:fs") as typeof import("node:fs");
  let ok = true;
  for (const id of ["slide1", "slide2"]) {
    const buf = rf(`${PROJECT}/pitch/${id}-image.png`);
    if (!(buf.length > 100 * 1024)) ok = false;
    const r = runPy(["scripts/video/contamination.py", `${PROJECT}/pitch/${id}-image.png`]);
    if (!(r.code === 0 && r.out.includes("contamination: clean"))) ok = false;
  }
  t(ok, "slide pictures >100 kB, contamination clean");
}

// 7. same lockup corner, persona line (slide 1), three benefit lines (slide 2).
{
  const cssOk = s1.includes("../brand/brandmark.css") && s2.includes("../brand/brandmark.css");
  const l1 = readJson(`${PROJECT}/pitch/slide1-layout.json`) as { texts?: { cls?: string; text?: string; rect?: { x: number; y: number; w: number; h: number } }[] };
  const l2 = readJson(`${PROJECT}/pitch/slide2-layout.json`) as { texts?: { cls?: string; text?: string; rect?: { x: number; y: number; w: number; h: number } }[] };
  void l1;
  void l2;
  const personas = readJson(`${PROJECT}/personas.json`) as { personas?: { persona_name?: string }[] };
  const persona = personas.personas?.[0]?.persona_name ?? "";
  const benefits = ["The week is read for her.", "A checker written in code keeps it straight.", "A person decides what is sent."];
  // Lockup rectangles come from the live DOM (same corner means equal boxes).
  const { chromium: chrom } = await import("playwright");
  const { pathToFileURL: fileUrl } = await import("node:url");
  const b = await chrom.launch({ args: ["--no-sandbox"] });
  const pg = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  const rects: ({ x: number; y: number; w: number; h: number } | null)[] = [];
  for (const id of ["slide1", "slide2"]) {
    await pg.goto(fileUrl(`${PROJECT}/pitch/${id}.html`).href, { waitUntil: "load" });
    rects.push(await pg.evaluate(() => {
      const el = document.querySelector(".lockup");
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
    }));
  }
  await b.close();
  const same = !!rects[0] && !!rects[1] &&
    Math.abs(rects[0].x - rects[1].x) <= 2 && Math.abs(rects[0].y - rects[1].y) <= 2 &&
    Math.abs(rects[0].w - rects[1].w) <= 2 && Math.abs(rects[0].h - rects[1].h) <= 2;
  t(cssOk && same && s1.includes(persona) && benefits.every((x) => s2.includes(x)),
    `lockups ${JSON.stringify(rects[0])} vs ${JSON.stringify(rects[1])}, persona + benefits present`);
}

// 8. render-pitch prints its 3-line and both slides are 1920x1080.
{
  const r = runNode(["scripts/video/render-pitch.ts"]);
  const { readFileSync: rf } = await import("node:fs") as typeof import("node:fs");
  const dims = ["slide1", "slide2"].map((id) => {
    const buf = rf(`${PROJECT}/pitch/${id}.png`);
    return buf.readUInt32BE(16) === 1920 && buf.readUInt32BE(20) === 1080;
  });
  t(/pitch: 3 rendered/.test(r.out) && dims.every(Boolean), "pitch: 3 rendered, slides 1920x1080");
}

// 9. measured pass: no overflow or clipping, no text under 24 px.
{
  let ok = true;
  for (const id of ["slide1", "slide2"]) {
    const layout = readJson(`${PROJECT}/pitch/${id}-layout.json`) as {
      texts?: { px?: number; rect?: { x: number; y: number; w: number; h: number } }[];
    };
    for (const x of layout.texts ?? []) {
      if ((x.px ?? 0) < 24) ok = false;
      const r = x.rect;
      if (!r || r.x < 0 || r.y < 0 || r.x + r.w > 1920 || r.y + r.h > 1080) ok = false;
    }
  }
  t(ok, "all slide text ≥24 px and inside the stage");
}

// 10. review sections exist with three sentences each; slide texts unbanned.
{
  const has = (h: string): boolean => {
    const sec = review.slice(review.indexOf(h));
    const next = sec.slice(h.length).search(/^## /m);
    const body = (next === -1 ? sec : sec.slice(0, h.length + next)).slice(h.length);
    return body.split(/[.?!]+/).map((s) => s.trim()).filter((s) => s !== "").length >= 3;
  };
  const r1 = runPy(["../../hackathons/_useful/scripts/check_banned_words.py", "--preset", "video", `${PROJECT}/pitch/slide1.html`]);
  const r2 = runPy(["../../hackathons/_useful/scripts/check_banned_words.py", "--preset", "video", `${PROJECT}/pitch/slide2.html`]);
  t(has("## Evidence") && has("## Slide 1") && has("## Slide 2") && r1.code === 0 && r2.code === 0, "review sections complete, slide texts unbanned");
}

done("sk-08-slides", n, failures);
