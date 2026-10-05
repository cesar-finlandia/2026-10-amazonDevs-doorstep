// Requirement IDs: PGM-12, PGM-13 (stage-4 derived artifact), IDEA-03, DP-K amendment 2026-08-25
// src/pgm/engine-prompt.ts — emits <outDir>/engine-building-prompt.md right after
// winning_project_plan.md is produced, plus a best-effort mirror into the
// sibling entry repo (../hackathon-entries/<event>/design_documents/): a
// SELF-CONTAINED meta-prompt the operator executes INSIDE the entry repo to
// generate the entry's Master Blueprint, its Visual Identity Plan and per-plan
// design documents (including the mandatory DP-UI, DP-E2E-BROWSER-TESTING,
// DP-SCRIPT and DP-LIVE-RUN-AND-VIDEO), which
// are then implemented by low-intelligence models through
// `run_sweep.sh --planner` / `--sequence` inside that same entry repo.
//
// Best-effort artifact: never throws, never blocks the pipeline; a missing file
// just means the operator keeps using the manual flow (strategy blueprint ch.7).

import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { vendorHee } from "../orchestrate/vendor.js";

export function engineBuildingPromptPath(outDir: string): string {
  return join(outDir, "engine-building-prompt.md");
}

/** Derive the real hackathon folder name from the centralized outDir. */
export function projectNameFromOutDir(outDir: string): string | undefined {
  const base = basename(outDir);
  // Legacy / generic dirs have no meaningful project name — keep the placeholder.
  if (!base || base === "pgm" || base === "private" || base === "hackathon-projects" || base === ".") return undefined;
  return base;
}

// Complete chassis module → design-plan mapping (design_documents/design_plans/).
// The rendered prompt lists ONLY rows for included components so the blueprint
// chat can never compose an excluded module (ASM-AC-01 discipline at plan time).
const MODULE_DP_MAP: ReadonlyArray<readonly [string, readonly string[]]> = [
  ["resilience", ["DP-A-resilience-layer.md"]],
  ["platform", ["DP-B-platform-layer.md"]],
  ["media", ["DP-C-media-io-wrappers.md"]],
  ["ideation", ["DP-D1-ideation-hour0.md", "DP-D2a-deckgen-script.md", "DP-D2b-demodrive-faqdef.md"]],
  ["context", ["DP-E-context-buffer-manager.md"]],
  ["dev-tooling", ["DP-F1-local-dev-single-checks.md", "DP-F2-local-dev-cross-checks.md"]],
  ["assembly-advisory", ["DP-G-assembly-advisory-tooling.md", "DP-G2-advisor-sweep-transport.md"]],
  ["data", ["DP-H-synthetic-demo-data-generator.md"]],
  ["cost", ["DP-I-cost-usage-guardrail.md"]],
  ["provenance", ["DP-J-provenance-disclosure-toolkit.md"]],
  ["pgm", ["DP-K-problem-grounding-engine.md", "DP-K2-keyless-reddit-data-source.md"]],
  ["profile", ["DP-L-event-profile-extractor.md"]],
];

/**
 * Best-effort extraction of included top-level component ids from the advisor
 * proposal next to the PGM outputs (<outDir>/proposal.json, then sibling
 * proposal.json). Returns undefined when unreadable — callers then render the
 * full mapping table. Never throws.
 */
export function readSelectedComponentIds(outDir: string): string[] | undefined {
  for (const candidate of [join(outDir, "proposal.json"), join(outDir, "..", "proposal.json")]) {
    try {
      if (!existsSync(candidate)) continue;
      const data = JSON.parse(readFileSync(candidate, "utf8")) as {
        components?: Array<{ id?: unknown; included?: unknown }>;
      };
      const ids = (data.components ?? [])
        .filter((c) => c.included === true && typeof c.id === "string")
        .map((c) => String(c.id).split("/")[0] as string)
        .filter((s): s is string => typeof s === "string" && s.length > 0);
      const unique = [...new Set(ids)].filter((id) => MODULE_DP_MAP.some(([m]) => m === id)).sort();
      if (unique.length > 0) return unique;
    } catch {
      // try the next candidate; ultimately fall back to the full table
    }
  }
  return undefined;
}

/**
 * The demo-video-script contract lives in ONE place — templates/demo-video-script.spec.md —
 * and is inlined verbatim into every generated engine-building-prompt so the blueprint chat
 * (which runs inside the entry repo, where the chassis templates/ dir may not be reachable)
 * carries the whole contract with it. Editing that markdown file changes the deliverable for
 * every future hackathon; there is deliberately no second copy of these rules.
 *
 * Best-effort like the rest of this module: an unreadable spec degrades to a short built-in
 * summary rather than throwing, because a missing auxiliary artifact must never fail PGM.
 */
const SCRIPT_SPEC_FALLBACK = `> **Note:** \`templates/demo-video-script.spec.md\` could not be read at generation time.
> The full contract is in the chassis repo at that path — read it before authoring DP-SCRIPT.
> The irreducible rules: measure every fact by running the BUILT product against the shipped
> demo data twice; write spoken text as prose, never table cells; count the words and fit the
> event's verbatim runtime cap at 150 wpm; make it sound like a person reading aloud; make the
> sponsor/side track the spine of the live-demo section and prove it on screen; never promise a
> frame the UI does not render; ship a Fact Ledger plus two generated slide graphics with
> assembled HTML slides (Vertex image runbook); write the spoken text so a synthetic voice can
> read it unchanged (no markdown, no parentheticals, numbers and symbols spelled out, one pinned
> voice and style direction — the pinned pair is \`--voice Iapetus --style "Confident documentary narrator."\` (brisk, ~155 wpm) — pronunciation
> overrides for names the voice would mangle) and emit it as machine-readable
> \`narration-segments.json\` beside the script; measure the running time with
> \`tts_vertex.py --batch narration-segments.json --estimate\` (a learned syllable rate, not a
> words-per-minute guess) and write the script to the WINNER ARC (\`"arc": "winner-v1"\`) at
> 120–150 seconds — never over min(cap − 5 s, 165 s) — cutting the weakest section rather than the
> demo, never padding with filler: a cold open that shows the product's artifact moving in 3D
> (≤ 16 words, no product name), the problem as a mechanism, the insight with a real code card and
> the product name first spoken, a chaptered demo of at least 45% of the runtime, a trust beat (an
> error or a human veto on screen), a 3D wow built from the demo's own data, and a held close with
> the URL and repo; no self-introduction and no presenter phrases; ship a cover thumbnail whose
> picture is GENERATED and carries zero text, with every word in an HTML layer over it — never a
> hand-drawn SVG of boxes and labels; the film is ONE theme, default \`paper\` (light, warm,
> high-contrast); keep spoken sentences short (≤ 20 words) enough to subtitle well;
> leave \`narration-review.md\` in the project folder for the operator's edit pass; the narrated
> master video is produced later by DP-LIVE-RUN-AND-VIDEO after the cloud deploy is healthy.`;

/**
 * The live-run-and-video contract lives in ONE place — templates/demo-live-run-video.spec.md —
 * and is inlined verbatim into every generated engine-building-prompt so the blueprint chat
 * carries the whole contract with it. Same best-effort discipline as the script spec: an
 * unreadable spec degrades to a short built-in summary rather than throwing.
 */
const VIDEO_SPEC_FALLBACK = `> **Note:** \`templates/demo-live-run-video.spec.md\` could not be read at generation time.
> The full contract is in the chassis repo at that path — read it before authoring
> DP-LIVE-RUN-AND-VIDEO. The irreducible rules: WU-01 is a health gate against the deployed
> cloud URL that declines loudly (named failure, named deploy owner, re-run path) and never
> records silently against localhost, and which also verifies ffmpeg/ffprobe and Vertex
> credentials; WU-02 first STOPS at THE ONE PAUSE — a single operator review gate that carries
> everything a human must decide: \`--review\` writes the exact words the voice will read into
> \`narration-review.md\`, prints a per-segment duration estimate against the 120–150 s target
> window with how many words to add or cut, and lists the graphical assets (the cover, plus the
> 3D data and code card for the winner arc) by path, flagging anything missing, stale,
> or hand-drawn as SVG-with-text, so the operator can call for any of them to be regenerated; the run waits, then \`--apply-review\`
> folds the speech edits back and only changed segments re-synthesize — and it never stops a second
> time. Then it
> synthesizes the WHOLE voiceover from \`narration-segments.json\` with the
> chassis renderer (\`_useful/scripts/render_narration.py\`) BEFORE any browser opens, re-voiced
> to the operator's voice via Applio RVC (\`_useful/scripts/apply_voice.py\`, cesar_voice model),
> and every
> beat hold is the MEASURED duration of the audio spoken over it, never a word-count estimate;
> the footage shows the deployed URL, captured at a 1280×720 CSS viewport at 2× (delivered at
> 1920×1080) in ONE theme with the titles and the 3D (default \`paper\`, light); a big DOM-injected fake pointer (≥32px plus click halo)
> parks on each beat's focus target; subtitles are cued from the measured audio and both burned
> into the picture and attached as a soft track; the last work unit muxes footage, narration and
> captions with \`_useful/scripts/finalize_video.py\` into \`video/final.mp4\` (H.264 + AAC,
> audio and subtitle streams asserted, inside the cap) — a submission-ready narrated, subtitled
> video with no manual voiceover step; measured narration seconds plus per-beat capture overhead
> must land the video inside the winner-arc window (DP-V9: 120–150 s, never more than the cap minus 5 s), and nothing is ever speed-remapped to make it fit.`;

const BANNED_WORDS_FALLBACK = `> **Note:** \`templates/banned-words.spec.md\` could not be read at generation time.
> The full contract is in the chassis repo at that path, and the word list itself is
> \`templates/banned-words.json\` — read that file, because the operator maintains it and it GROWS.
> The rule: a handful of words are so characteristic of generated text that their presence is a tell,
> and a judge who has watched six AI-built submissions that morning recognises the vocabulary before
> the first slide ends. They are banned from every judge-visible surface — the spoken narration and
> therefore the subtitles, the cover and both slide text layers, and every string the application
> renders (labels, buttons, empty and error copy, message templates, \`helpContent\`, tooltips,
> \`aria-label\`s) — and no plan may specify one as literal user-visible copy. Source identifiers
> (variables, CSS classes, JSON keys) are out of scope: the ban is on what is READ, not what is
> compiled. A verbatim quotation is never edited — pick a different quote or record the exception.
> Fixes are REWRITTEN sentences, never a synonym carrying the same tell; most of these words are
> filler and the sentence is shorter without them. Enforced by
> \`_useful/scripts/check_banned_words.py\` (presets \`video\`, \`app\`, \`plans\`), which exits non-zero
> and runs in DP-SCRIPT, in DP-LIVE-RUN-AND-VIDEO's health gate BEFORE any voice is synthesized, and
> in DP-UI's craft audit.`;

const UI_CRAFT_FALLBACK = `> **Note:** \`templates/ui-craft.spec.md\` could not be read at generation time.
> The full contract is in the chassis repo at that path. It exists because tokens are vocabulary and
> craft is grammar: an entry can satisfy every token rule and still ship a debug harness. The
> irreducible rules, each written against a shipped defect: **no two lines in a group look the same**
> (differ on ≥2 of size / weight / colour / case+tracking / family; use the eyebrow / subject /
> support roles); **a container is an object, not a background colour** (background + border + radius
> + elevation + padded, with a header treatment when titled; nested surfaces step one level);
> **numbers never wrap and never inherit a headline size** (\`tabular-nums\`, \`nowrap\`, sized against a
> stated digit budget for the WORST case, abbreviated past it, unit as a separate muted element, a
> dedicated \`--metric-*\` step); **status has a home** (page banner / inline callout / toast, each with
> icon + title + structured detail + action, content aligned to the main grid — never loose text
> painted over the layout — and every message template TOTAL, with no empty interpolation slot that
> renders \`"degraded via none: ."\`); **colour does work** (accent in ≥3 roles per screen; state as
> tinted surface + glyph + word); **the product explains itself** (a labelled explainer button beside
> the app title opening a what/who/flow/how-to-read/try-it panel, plus a click-activated \`?\` with a
> subject-naming aria-label on every result or verdict region, all copy in one \`helpContent\` map);
> **nothing renders raw** (no visible markdown fences, clamp long text, structure retrieved items);
> **a real self-hosted or pinned typeface ships**, never the bare system stack. All of it is asserted
> in the rendered page by a DOM measurement block that fails the work unit, and only then looked at.`;

const BRANDMARK_FALLBACK = `> **Note:** \`templates/brandmark.spec.md\` could not be read at generation time.
> The full contract is in the chassis repo at that path. The irreducible rules: every entry ships a
> brandmark lockup, and it is NOT a separate design plan — it is the first artefact of the visual
> identity, designed at plan time into \`visual_identity_plan.md\` §2A and built by **DP-UI's FIRST
> work unit**, because DP-UI already single-owns the look. The lockup is THREE parts — an authored
> vector mark, the product name, and the slogan directly beneath it, held together by exactly one
> designer's device (a hairline, a plate, an underline — one, not three). Mark and words are two
> layers: \`brand/mark.svg\` is geometry only — square \`viewBox\`, no \`<text>\`
> element ever, \`currentColor\` and no literal hex so ONE file serves both themes, one stroke weight,
> no gradients or filters, legible at 16px — and the wordmark is rendered by a real layout engine so
> they are always spelled and set correctly; the slogan is three to six words saying what the product
> does rather than its category, and it is the SAME string in the header, on the cover and on both
> slides. Everything scales from one \`font-size\`, so the proportions hold at 20px and at 64px.
> **Never generate any part of it with an image model.** It
> appears in the app header on every page in both themes, on the cover, and in the same corner of both
> slides; DP-UI also writes a portable copy into \`hackathon-projects/<project>/brand/\` because the
> slides live outside the entry repo, and DP-SCRIPT imports it rather than redrawing it. The mark is
> the favicon. Verification is measured: no \`<text\` in the SVG, no literal hex, square viewBox,
> ≥3:1 contrast against the header surface in BOTH themes, and a 16/24/32/64/512 contact sheet that
> someone actually looks at.`;

const VISUAL_ASSETS_FALLBACK = `> **Note:** \`templates/visual-assets.spec.md\` could not be read at generation time.
> The full contract is in the chassis repo at that path — read it before authoring DP-SCRIPT's
> graphical-asset work units. The irreducible rules: the video ships THREE assets — a cover image
> (the platform thumbnail), slide 1 (the problem) and slide 2 (the outcome); **the picture layer is
> GENERATED and carries ZERO text — no labels, digits, logos or watermarks — and every word the
> viewer reads is HTML with a real layout engine over it**, because image models misspell and
> hand-placed SVG text has no layout engine; a hand-authored SVG of rectangles and \`<text>\` labels is
> never a graphic and is the exact failure this spec exists to prevent (the only legal fallback when
> no image model is reachable is a deliberate type-only slide); slide 1 must prove the problem is
> real with SOURCED evidence — a dated, attributed practitioner quote from
> \`mined_frustrations.json\` or a named published figure, never an invented statistic; slide 2 must
> quantify the change in units from the Fact Ledger with measured and modelled figures
> distinguished; image prompts are 60–110 words (medium, subject, composition, palette hexes, mood,
> then a literal no-text negative list) and a shared style block is prepended to all three; slides
> use a fixed 1920×1080 grid with \`overflow:hidden\`, never absolute pixel coordinates, with
> headlines ≥64px and nothing under 24px; generate with the pinned image model
> \`gemini-3.1-flash-image\` (global; substitute only if retired); verification is MEASURED in the DOM (no element outside the
> stage, no scrollHeight/scrollWidth overflow, no sub-24px text, every image loaded) and only then
> looked at by eye.`;

/**
 * Fallback summaries for the three newer specs — same best-effort discipline as the script/video
 * specs: an unreadable template degrades to a short built-in summary rather than throwing.
 */
const VISUAL_SPEC_FALLBACK = `> **Note:** \`templates/visual-identity.spec.md\` could not be read at generation time.
> The full contract is in the chassis repo at that path — read it before writing
> \`design_documents/visual_identity_plan.md\` or DP-UI. The irreducible rules: the visual identity is
> DESIGNED IN THIS RUN by you, not by the implementor; derive the audience and visual register from the
> winning plan before choosing a colour; ship literal light AND dark token tables with stated contrast
> ratios, a literal type scale, a literal spacing/radius/shadow ladder and a literal motion table with
> reduced-motion substitutes; specify every component's states including loading, empty, error and
> degraded; a visible persisted theme toggle and a text-bearing in-flight work indicator are mandatory;
> DP-UI is the single owner of the visual identity and reproduces the whole token set verbatim in its
> own §5; DP-UI's last work unit captures light/dark/mobile/state screenshots with a real browser and
> runs an automated contrast assertion.`;

const E2E_SPEC_FALLBACK = `> **Note:** \`templates/e2e-browser-testing.spec.md\` could not be read at generation time.
> The full contract is in the chassis repo at that path — read it before authoring
> DP-E2E-BROWSER-TESTING. The irreducible rules: a real browser (Playwright/Chromium) drives the real
> served app; one scenario per use case from winning_project_plan.md, traced in
> \`design_documents/e2e-testing/strategy.md\`; the brief's mandatory technology is proven by an
> observable artefact; every interactive control is clicked or explicitly listed as inert; every
> scenario asserts zero unexpected console errors and that displayed values match the backend; failures
> are fixed (never weakened) until the suite passes twice, with a fix log; a \`BASE_URL\`-parameterised
> \`e2e/smoke.spec.ts\` is re-run by the deploy plan, DP-SCRIPT and DP-LIVE-RUN-AND-VIDEO against the
> deployed URL; and \`.gitignore\` is hardened against every sweep-generated path.`;

const AI_ACCESS_FALLBACK = `> **Note:** \`templates/ai-access.spec.md\` could not be read at generation time.
> The irreducible rule: Gemini IS available through Vertex AI on the operator's Google Cloud account via
> Application Default Credentials. An empty API-key variable in \`.env\` is the expected, supported state
> — never a blocker. Before declaring AI unavailable, run
> \`gcloud auth application-default print-access-token\` (and \`gcloud auth application-default login\` if
> it fails), set \`GOOGLE_GENAI_USE_VERTEXAI=true\`, \`GOOGLE_CLOUD_PROJECT=2026-09-agentic-cinema1\` (the
> default — ask for another only if it fails), \`GOOGLE_CLOUD_LOCATION=<region>\` (plus
> \`GOOGLE_VERTEX_LOCATION=global\` for global-endpoint models), confirm \`aiplatform.googleapis.com\` is
> enabled, and discover the model name rather than hardcoding a version. Only a named error from that
> sequence justifies reporting AI unavailable.`;

/**
 * Generic best-effort reader for a `templates/<name>` spec file. Resolves relative to this
 * module first (chassis layout), then to the cwd, then to a sibling chassis checkout — the same
 * ladder every spec reader has always used. Returns `fallback` when nothing is readable, because a
 * missing auxiliary artifact must never fail PGM.
 */
export function readTemplateSpec(fileName: string, fallback: string): string {
  const candidates: string[] = [];
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    // <chassis>/src/pgm/engine-prompt.ts -> <chassis>/templates/...
    candidates.push(resolve(here, "..", "..", "templates", fileName));
  } catch {
    // import.meta unavailable under some transpilers — cwd candidates still apply
  }
  candidates.push(resolve(process.cwd(), "templates", fileName));
  candidates.push(resolve(process.cwd(), "..", "..", "hackathons", "templates", fileName));
  for (const candidate of candidates) {
    try {
      if (!existsSync(candidate)) continue;
      const text = readFileSync(candidate, "utf8").trim();
      if (text.length > 0) return text;
    } catch {
      // try the next candidate
    }
  }
  console.warn(`[pgm] warn: templates/${fileName} unreadable — inlining fallback summary`);
  return fallback;
}

export function readDemoScriptSpec(): string {
  return readTemplateSpec("demo-video-script.spec.md", SCRIPT_SPEC_FALLBACK);
}

export function readDemoVideoSpec(): string {
  return readTemplateSpec("demo-live-run-video.spec.md", VIDEO_SPEC_FALLBACK);
}

export function readVisualIdentitySpec(): string {
  return readTemplateSpec("visual-identity.spec.md", VISUAL_SPEC_FALLBACK);
}

export function readE2ESpec(): string {
  return readTemplateSpec("e2e-browser-testing.spec.md", E2E_SPEC_FALLBACK);
}

export function readBannedWordsSpec(): string {
  return readTemplateSpec("banned-words.spec.md", BANNED_WORDS_FALLBACK);
}

/**
 * The banned-word list is DATA, not prose: it is maintained by the operator and it grows, so the
 * generated prompt carries the live list rather than a remembered subset. Rendered as a table so the
 * plan-writer can read it without parsing JSON. Best-effort like every other spec reader.
 */
export function readBannedWordsList(): string {
  const raw = readTemplateSpec("banned-words.json", "");
  if (!raw) return "> (the list could not be read; see `templates/banned-words.json` in the chassis)";
  try {
    const data = JSON.parse(raw) as {
      version?: string;
      entries?: Array<{ id?: string; pattern?: string; examples?: string[]; why?: string; instead?: string[] }>;
    };
    const rows = (data.entries ?? []).map((e) =>
      `| \`${e.id}\` | \`${e.pattern}\` | ${(e.examples ?? []).join(", ")} | ${(e.instead ?? []).join("; ")} |`,
    );
    return [
      `**The list as of list version ${data.version ?? "?"} — re-read \`templates/banned-words.json\` at run time, it grows:**`,
      "",
      "| id | pattern (case-insensitive) | examples | rewrite toward |",
      "|---|---|---|---|",
      ...rows,
    ].join("\n");
  } catch {
    return "> (the list could not be parsed; see `templates/banned-words.json` in the chassis)";
  }
}

export function readUiCraftSpec(): string {
  return readTemplateSpec("ui-craft.spec.md", UI_CRAFT_FALLBACK);
}

export function readBrandmarkSpec(): string {
  return readTemplateSpec("brandmark.spec.md", BRANDMARK_FALLBACK);
}

export function readVisualAssetsSpec(): string {
  return readTemplateSpec("visual-assets.spec.md", VISUAL_ASSETS_FALLBACK);
}

export function readAiAccessSpec(): string {
  return readTemplateSpec("ai-access.spec.md", AI_ACCESS_FALLBACK);
}

/**
 * DEPTH-01 / 3D-01 / LEVERAGE-01 (2026-10-03). Three contracts distilled from a forensic comparison
 * of our entries with prize-winning ones: our products were one-shot proofs of concept over synthetic
 * data; the winners owned a stateful domain with a truth engine, ran multi-round agent workflows over
 * a broad action surface, used most of the mandated technology, and showed it in real-time 3D.
 * Same best-effort discipline as every other spec reader.
 */
const PRODUCT_DEPTH_FALLBACK = `> **Note:** \`templates/product-depth.spec.md\` could not be read at generation time.
> Binding summary: real input (not synthetic); one stateful domain store shared by UI and agent;
> >= 15 typed actions; a call graph with >= 3 model roles (or >= 15 agent actions when the mandated
> technology supplies the agent), >= 1 verify -> repair round driven by a deterministic truth engine
> and >= 1 human checkpoint; every action visible in an activity feed; \`run-trace.json\` per run.
> Owners: DP-DOMAIN-ENGINE (store + truth engine), DP-AGENT-WORKFLOW (call graph, prompts, actions,
> approval gate, run trace).`;

const THREE_D_FALLBACK = `> **Note:** \`templates/3d-experience.spec.md\` could not be read at generation time.
> Binding summary: every entry ships one real-time 3D view of its own domain state (three.js /
> @react-three/fiber by default), live-bound to human and agent actions, interactive, in the hero
> frame, with ACES tone mapping, image-based light, soft shadows/AO, >= 50 fps at 1280x720, a WebGL
> fallback, \`[data-demo-3d]\` + \`window.__demo3d.play(shot)\` hooks, a /lab tuning route, and a
> Gemini-vision review loop. Owner: DP-3D, immediately after DP-UI.`;

const TECH_LEVERAGE_FALLBACK = `> **Note:** \`templates/tech-leverage.spec.md\` could not be read at generation time.
> Binding summary: map every capability of the mandated technology (core / advanced / frontier /
> open-question); use >= 80% of the product-relevant rows, >= 2 advanced and >= 1 frontier or
> open-question visibly; never stop at the organizer's sample; build for the technology's own
> architecture; measure its effect against a control when it changes what an agent can do.`;

export function readProductDepthSpec(): string {
  return readTemplateSpec("product-depth.spec.md", PRODUCT_DEPTH_FALLBACK);
}

export function readThreeDSpec(): string {
  return readTemplateSpec("3d-experience.spec.md", THREE_D_FALLBACK);
}

export function readTechLeverageSpec(): string {
  return readTemplateSpec("tech-leverage.spec.md", TECH_LEVERAGE_FALLBACK);
}

export function readHeeKitThreeSceneSpec(): string {
  return readTemplateSpec("hee-kit-three-scene.spec.md", HEE_FALLBACK("hee-kit-three-scene.spec.md"));
}
export function readHeeKitAgentWorkflowSpec(): string {
  return readTemplateSpec("hee-kit-agent-workflow.spec.md", HEE_FALLBACK("hee-kit-agent-workflow.spec.md"));
}
export function readHeeArtDirectionSpec(): string {
  return readTemplateSpec("hee-art-direction.spec.md", HEE_FALLBACK("hee-art-direction.spec.md"));
}
export function readHeeAgentEvalSpec(): string {
  return readTemplateSpec("hee-agent-eval.spec.md", HEE_FALLBACK("hee-agent-eval.spec.md"));
}
export function readHeeShowcaseSpec(): string {
  return readTemplateSpec("hee-showcase.spec.md", HEE_FALLBACK("hee-showcase.spec.md"));
}
const HEE_FALLBACK = (name: string): string =>
  `templates/${name} was unreadable when this prompt was generated; open ../../hackathons/templates/${name} and follow it.`;

/**
 * PATH ANCHORING (2026-09-23). The generated prompt is EXECUTED INSIDE THE ENTRY REPO
 * (`../hackathon-entries/<project>`), but the specs inlined into it are authored from the
 * chassis root and name chassis files by chassis-relative paths (`templates/banned-words.json`,
 * `_useful/scripts/...`, `hackathon-projects/<project>/...`, `scripts/lint-architecture.ts`).
 * Read from the entry root those paths do not exist, so the blueprint chat stalls or designs
 * against files it never opened — and whatever it copies into a design plan is then run by
 * low-intelligence implementors that have no fallback reasoning at all.
 *
 * Fix: the spec files stay authored for the chassis, and the RENDERED prompt anchors every
 * chassis-only path to `../../hackathons/` so it only ever names paths that resolve from the
 * entry root. Idempotent: the match must start at a token boundary, so a path that already
 * carries a prefix (`../../hackathons/templates/…`, `design_documents/…`) is never touched.
 */
export const CHASSIS_REL = "../../hackathons";

// Top-level chassis dirs that never exist in an assembled entry repo (or, for contracts/, only
// as a filtered copy whose source of truth is the chassis). Entry-local roots — `src/`,
// `engine/`, `e2e/`, `design_documents/`, `video/`, `pitch/` — are deliberately absent.
const CHASSIS_ONLY_DIRS = ["templates", "_useful", "hackathon-projects", "contracts", "docs/tutorials"] as const;
// `scripts/` exists in both repos: the assembler copies exactly these into the entry; every
// other chassis script (lint-architecture.ts, lint-cues.ts, run-advisor.py, …) is chassis-only.
const ENTRY_COPIED_SCRIPTS = new Set(["deploy.ts", "smoke-deploy.ts", "mock-publish.ts"]);
const CHASSIS_ONLY_FILES = ["src/pgm/engine-prompt.ts"] as const;
// Token boundary: not preceded by a path character, so already-prefixed paths are skipped.
const BOUNDARY = String.raw`(?<![\w./<>-])`;

export function anchorChassisPaths(text: string, projectName: string): string {
  // `<<<BEGIN … SPEC — templates/x.spec.md>>>` markers are provenance labels, not paths to open:
  // they stay byte-stable so tooling and tests can find the inlined blocks.
  return text
    .split("\n")
    .map((line) => (line.startsWith("<<<") ? line : anchorLine(line, projectName)))
    .join("\n");
}

function anchorLine(line: string, projectName: string): string {
  let out = line;
  // `<project>` in the specs is the chassis project folder — name it concretely.
  out = out.split("hackathon-projects/<project>").join(`hackathon-projects/${projectName}`);
  out = out.split("<project dir>").join(`${CHASSIS_REL}/hackathon-projects/${projectName}`);
  out = out.replace(new RegExp(`${BOUNDARY}<project>/`, "g"), `${CHASSIS_REL}/hackathon-projects/${projectName}/`);
  for (const dir of CHASSIS_ONLY_DIRS) {
    out = out.replace(new RegExp(`${BOUNDARY}${dir.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/`, "g"), `${CHASSIS_REL}/${dir}/`);
  }
  for (const file of CHASSIS_ONLY_FILES) {
    out = out.replace(new RegExp(`${BOUNDARY}${file.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "g"), `${CHASSIS_REL}/${file}`);
  }
  out = out.replace(new RegExp(`${BOUNDARY}scripts/([\\w.-]+)`, "g"), (whole, name: string) =>
    ENTRY_COPIED_SCRIPTS.has(name) ? whole : `${CHASSIS_REL}/scripts/${name}`,
  );
  return out;
}

/** Absolute chassis root at generation time (forward slashes), or undefined when unknown. */
export function chassisRootAbs(): string | undefined {
  const candidates: string[] = [];
  try {
    candidates.push(resolve(dirname(fileURLToPath(import.meta.url)), "..", ".."));
  } catch {
    // import.meta unavailable under some transpilers — cwd candidate still applies
  }
  candidates.push(process.cwd());
  const hit = candidates.find((c) => existsSync(join(c, "templates")) && existsSync(join(c, "src", "pgm")));
  return hit?.replace(/\\/g, "/");
}

/**
 * The PATH RESOLUTION section every generated prompt opens with. Rendered AFTER anchoring, so
 * its own examples of bare paths are not rewritten.
 */
export function renderPathResolution(projectName: string): string {
  const abs = chassisRootAbs();
  const absChassis = abs ?? "(unknown at generation time)";
  const absEntry = abs ? `${abs.replace(/\/[^/]+$/, "")}/hackathon-entries/${projectName}` : "(unknown)";
  const absProject = abs ? `${abs}/hackathon-projects/${projectName}` : "(unknown)";
  return `## PATH RESOLUTION — read this before opening any file

Execute this prompt with the ENTRY repository root as the working directory. It draws on files
that live only in the sibling CHASSIS repository, so three roots are in play:

| root | from the entry root | absolute (this machine, at generation time) |
|---|---|---|
| ENTRY (cwd) | \`.\` | \`${absEntry}\` |
| CHASSIS | \`${CHASSIS_REL}\` | \`${absChassis}\` |
| PROJECT_DIR (production aids) | \`${CHASSIS_REL}/hackathon-projects/${projectName}\` | \`${absProject}\` |

1. A path with no prefix — \`design_documents/…\`, \`src/…\`, \`engine/…\`, \`e2e/…\` — is ENTRY-local.
   \`design_documents/winning_project_plan.md\`, \`proposal.json\` and \`hackathon_brief.md\` were copied
   here at assembly time.
2. A path starting \`${CHASSIS_REL}/\` is in CHASSIS. If the relative form does not resolve (the repos
   were moved), read it through the absolute column instead — but never write an absolute path into
   a plan.
3. **Fallback:** if ANY file this prompt names is missing from ENTRY, look for the same relative path
   under CHASSIS (and then under PROJECT_DIR) before concluding it is missing. Report a file as missing
   only after every lookup fails, naming each path you tried. Never design against a file you could
   not open.
4. \`<project>\` or \`<project dir>\` anywhere below means PROJECT_DIR.
5. CHASSIS is read-only for you, except PROJECT_DIR, where production aids are written.
6. **Write every chassis path into the blueprint and the design plans in the \`${CHASSIS_REL}/…\`
   form, never bare.** The implementors run from the entry root with no fallback rule: a bare
   \`templates/…\` or \`_useful/…\` in a plan is a file they will not find.
7. If your tool sandbox refuses to read outside the entry root, STOP and ask the operator to grant
   access to CHASSIS (Claude Code: \`/add-dir ${absChassis}\`, or start it with
   \`claude --add-dir ${absChassis}\`). Do not continue without the files.

**Preflight — run it first; every line must print a path, not an error:**

\`\`\`bash
ls -d ${CHASSIS_REL}/contracts/component-catalog.json \\
      ${CHASSIS_REL}/templates/banned-words.json \\
      ${CHASSIS_REL}/design_documents/design_plans \\
      ${CHASSIS_REL}/_useful/scripts \\
      ${CHASSIS_REL}/hackathon-projects/${projectName} \\
      design_documents/winning_project_plan.md
\`\`\``;
}

function renderModuleDpTable(selectedIds?: string[], projectName?: string): string {
  const effective = selectedIds && selectedIds.length > 0 ? selectedIds : undefined;
  const rows = effective
    ? MODULE_DP_MAP.filter(([module]) => effective.includes(module))
    : MODULE_DP_MAP;
  const body = rows.map(([module, plans]) => `| ${module} | ${plans.join(", ")} |`).join("\n");
  const proj = projectName ?? "<Hackathon-project-name>";
  return `${body}
${
  effective
     ? `The table is pre-filtered to the modules marked included:true in design_documents/proposal.json (entry-local copy of hackathon-projects/${proj}/proposal.json; legacy private/pgm/proposal.json is deprecated).`
     : "No proposal was available at generation time, so ALL twelve rows are listed — filter them yourself."
 }
Read ONLY the rows whose module is included:true in \`design_documents/proposal.json\`;
skip excluded modules entirely — never design against a module the manifest excludes.
**Precedence rule: if this prompt's enumerations conflict with
\`design_documents/proposal.json\`, the manifest wins.**
Your plans must CALL INTO these modules, never re-implement them.`;
}

/**
 * Resolve the sibling entry repo's design_documents/ dir for a centralized
 * outDir (<chassis>/hackathon-projects/<project>). Returns undefined when the
 * layout is not recognized — callers treat the mirror as best-effort.
 */
export function entryDesignDocsDir(outDir: string, projectName?: string): string | undefined {
  try {
    const proj = projectName ?? projectNameFromOutDir(outDir);
    if (!proj || proj === "<Hackathon-project-name>") return undefined;
    const abs = resolve(outDir);
    // Centralized layout: <chassis>/hackathon-projects/<project>
    if (basename(dirname(abs)) !== "hackathon-projects") return undefined;
    const chassisRoot = dirname(dirname(abs));
    return join(chassisRoot, "..", "hackathon-entries", proj, "design_documents");
  } catch {
    return undefined;
  }
}

/**
 * Best-effort mirror of the engine-building prompt + its entry-local inputs
 * into the sibling entry repo's design_documents/ folder so the operator can
 * execute the prompt INSIDE the entry repo with all paths resolving locally.
 * Copies: engine-building-prompt.md (rendered text), proposal.json,
 * winning_project_plan.md, hackathon_brief.md. Never throws.
 */
export function mirrorEnginePromptToEntry(
  outDir: string,
  rendered: string,
  projectName?: string,
): boolean {
  try {
    const destDir = entryDesignDocsDir(outDir, projectName);
    if (!destDir) return false;
    mkdirSync(destDir, { recursive: true });
    writeFileSync(join(destDir, "engine-building-prompt.md"), rendered, "utf8");
    for (const fname of ["proposal.json", "winning_project_plan.md", "hackathon_brief.md"]) {
      try {
        const src = join(outDir, fname);
        if (existsSync(src)) copyFileSync(src, join(destDir, fname));
      } catch {
        // per-file best effort
      }
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * The design skills DP-UI works from (DP-V6). They are VENDORED in the chassis
 * at `.claude/skills/` — pinned and reviewed, never fetched at build time,
 * because an event-day network failure must not be able to change the look of
 * an entry — and copied into the entry repository so the building agent has
 * them in scope where it actually writes the front end.
 *
 * Best-effort like everything else here: a failed copy is a warning, and
 * DP-UI still has the UI CRAFT CONTRACT inlined in its own plan.
 */
export function copySkillsToEntry(outDir: string, projectName?: string): number {
  let copied = 0;
  try {
    const designDocs = entryDesignDocsDir(outDir, projectName);
    if (!designDocs) return 0;
    const entryRoot = dirname(designDocs);
    const roots: string[] = [];
    try {
      const here = dirname(fileURLToPath(import.meta.url));
      roots.push(resolve(here, "..", "..", ".claude", "skills"));
    } catch {
      // import.meta unavailable under some transpilers — cwd candidates still apply
    }
    roots.push(resolve(process.cwd(), ".claude", "skills"));
    roots.push(resolve(process.cwd(), "..", "..", "hackathons", ".claude", "skills"));
    const src = roots.find((r) => existsSync(r));
    if (!src) {
      console.warn("[pgm] warn: no .claude/skills/ found in the chassis — DP-UI runs without the "
        + "frontend-design skill (the UI CRAFT CONTRACT still binds it)");
      return 0;
    }
    const dest = join(entryRoot, ".claude", "skills");
    const copyTree = (from: string, to: string): void => {
      mkdirSync(to, { recursive: true });
      for (const name of readdirSync(from, { withFileTypes: true })) {
        const a = join(from, name.name);
        const b = join(to, name.name);
        if (name.isDirectory()) copyTree(a, b);
        else {
          copyFileSync(a, b);
          copied += 1;
        }
      }
    };
    copyTree(src, dest);
  } catch (e) {
    console.warn(`[pgm] warn: could not vendor design skills: ${String(e)}`);
  }
  return copied;
}

/**
 * The video-production tooling the generated DP-LIVE-RUN-AND-VIDEO plan calls:
 * Gemini TTS, the narration renderer that measures what it synthesized, the
 * Applio RVC re-voicing to the operator's voice that the renderer runs
 * automatically, the word-level alignment that recovers timings from the voice
 * that actually ships, the cue resolver that turns the script's cue phrases
 * into timestamps, the Lyria bed composer that scores the music to the
 * measured beats, and the ffmpeg finalizer that mixes, ducks and proves the
 * muxed file is submittable. They live in the chassis at `_useful/scripts/`, and a copy is
 * vendored into `<outDir>/video/tools/` so the recorder — which runs beside
 * its artefacts, outside the entry repo — can always reach them even when the
 * chassis checkout is not where the plan expects it.
 *
 * Best-effort like everything else in this module: a failed copy is a warning,
 * never an exception, and the plan's documented chassis path still works.
 */
const VIDEO_TOOL_SCRIPTS = [
  "tts_vertex.py",
  "render_narration.py",
  "apply_voice.py",
  "align_narration.py",
  "resolve_cues.py",
  "compose_bed.py",
  "compose_plates.py",
  "build_storyboard.py",
  // DP-V9: build_storyboard.py imports winner_arc.py; apply_voice.py imports tighten_gaps.py;
  // video_qa.py measures the finished file against the winning references.
  "winner_arc.py",
  "tighten_gaps.py",
  "video_qa.py",
  "video_gate.py",
  "video_build.py",
  "verify_video.py",
  "finalize_video.py",
] as const;

export function copyVideoTooling(outDir: string): string[] {
  const copied: string[] = [];
  try {
    const roots: string[] = [];
    try {
      const here = dirname(fileURLToPath(import.meta.url));
      roots.push(resolve(here, "..", "..", "_useful", "scripts"));
    } catch {
      // import.meta unavailable under some transpilers — cwd candidates still apply
    }
    roots.push(resolve(process.cwd(), "_useful", "scripts"));
    roots.push(resolve(process.cwd(), "..", "..", "hackathons", "_useful", "scripts"));
    const destDir = join(outDir, "video", "tools");
    let made = false;
    for (const name of VIDEO_TOOL_SCRIPTS) {
      const src = roots.map((r) => join(r, name)).find((c) => existsSync(c));
      if (!src) continue;
      if (!made) {
        mkdirSync(destDir, { recursive: true });
        made = true;
      }
      copyFileSync(src, join(destDir, name));
      copied.push(name);
    }
    if (copied.length < VIDEO_TOOL_SCRIPTS.length) {
      console.warn(
        `[pgm] warn: vendored ${copied.length}/${VIDEO_TOOL_SCRIPTS.length} video tools into ${destDir} — ` +
          "DP-LIVE-RUN-AND-VIDEO falls back to the chassis path _useful/scripts/",
      );
    }
  } catch (e) {
    console.warn(`[pgm] warn: could not vendor video tooling: ${String(e)}`);
  }
  return copied;
}

export function vendorHeeToEntry(outDir: string, projectName?: string): void {
  try {
    const designDocs = entryDesignDocsDir(outDir, projectName);
    const chassis = chassisRootAbs();
    if (!designDocs || !chassis) {
      console.warn("[pgm] warn: entry repo or chassis root not found — HEE tooling not vendored (re-run after assembly)");
      return;
    }
    const m = vendorHee({ chassisRoot: chassis, entryRoot: dirname(designDocs) });
    if (m.missing.length > 0) console.warn(`[pgm] warn: HEE vendoring missing ${m.missing.length} required source(s): ${m.missing.join(", ")}`);
  } catch (e) {
    console.warn(`[pgm] warn: could not vendor HEE tooling: ${String(e)}`);
  }
}

/**
 * Write the engine-building meta-prompt. Best-effort: logs a warning and
 * returns false on any filesystem error — the PGM pipeline itself must not
 * fail because of an auxiliary artifact.
 *
 * Always writes <outDir>/engine-building-prompt.md (centralized source of
 * truth) AND best-effort mirrors the same rendered text plus
 * proposal.json / winning_project_plan.md / hackathon_brief.md into the
 * sibling entry repo's design_documents/ folder
 * (../hackathon-entries/<project>/design_documents/) when the outDir follows
 * the centralized hackathon-projects/<project> layout.
 *
 * `selectedIds` overrides the included-component detection; when omitted the
 * included set is auto-read from <outDir>/proposal.json (or its sibling).
 */
export function writeEngineBuildingPrompt(outDir: string, selectedIds?: string[]): boolean {
  try {
    const ids = selectedIds ?? readSelectedComponentIds(outDir);
    const projectName = projectNameFromOutDir(outDir);
    const rendered = renderEngineBuildingPrompt(ids, projectName);
    mkdirSync(outDir, { recursive: true });
    writeFileSync(engineBuildingPromptPath(outDir), rendered, "utf8");
    // Vendor the TTS / narration / alignment / score / mux tooling beside the
    // video artefacts, and the design skills into the entry repo.
    copyVideoTooling(outDir);
    copySkillsToEntry(outDir, projectName);
    vendorHeeToEntry(outDir, projectName);
    // Mirror into the entry repo (best-effort, never fails the pipeline).
    try {
      mirrorEnginePromptToEntry(outDir, rendered, projectName);
    } catch (e) {
      console.warn(`[pgm] warn: could not mirror engine-building-prompt.md to entry repo: ${String(e)}`);
    }
    return true;
  } catch (e) {
    console.warn(`[pgm] warn: could not write engine-building-prompt.md: ${String(e)}`);
    return false;
  }
}

export function renderEngineBuildingPrompt(selectedIds?: string[], projectName?: string): string {
  const moduleDpTable = renderModuleDpTable(selectedIds, projectName);
  const proj = projectName ?? "<Hackathon-project-name>";
  // The specs are static text and carry the <Hackathon-project-name> placeholder in
  // their output-path rules; substitute it so the inlined copies name this entry's real folder.
  const scriptSpec = readDemoScriptSpec().split("<Hackathon-project-name>").join(proj);
  const videoSpec = readDemoVideoSpec().split("<Hackathon-project-name>").join(proj);
  const visualSpec = readVisualIdentitySpec().split("<Hackathon-project-name>").join(proj);
  const e2eSpec = readE2ESpec().split("<Hackathon-project-name>").join(proj);
  const visualAssetsSpec = readVisualAssetsSpec().split("<Hackathon-project-name>").join(proj);
  const brandmarkSpec = readBrandmarkSpec().split("<Hackathon-project-name>").join(proj);
  const uiCraftSpec = readUiCraftSpec().split("<Hackathon-project-name>").join(proj);
  const bannedWordsSpec = readBannedWordsSpec().split("<Hackathon-project-name>").join(proj);
  const bannedWordsList = readBannedWordsList();
  const aiAccessSpec = readAiAccessSpec().split("<Hackathon-project-name>").join(proj);
  const productDepthSpec = readProductDepthSpec().split("<Hackathon-project-name>").join(proj);
  const threeDSpec = readThreeDSpec().split("<Hackathon-project-name>").join(proj);
  const heeKitThreeSceneSpec = readHeeKitThreeSceneSpec().split("<Hackathon-project-name>").join(proj);
  const heeKitAgentWorkflowSpec = readHeeKitAgentWorkflowSpec().split("<Hackathon-project-name>").join(proj);
  const heeArtDirectionSpec = readHeeArtDirectionSpec().split("<Hackathon-project-name>").join(proj);
  const heeAgentEvalSpec = readHeeAgentEvalSpec().split("<Hackathon-project-name>").join(proj);
  const heeShowcaseSpec = readHeeShowcaseSpec().split("<Hackathon-project-name>").join(proj);
  const techLeverageSpec = readTechLeverageSpec().split("<Hackathon-project-name>").join(proj);
  const body = `# TASK — Generate the Master Blueprint + Design Plans for this hackathon entry

You are a principal engineer preparing a hackathon entry for implementation by
**low-intelligence AI models** driven by \`run_sweep.sh --planner\` and
\`run_sweep.sh --sequence\`. Your job: read the material below, then produce ONE
Master Blueprint plus a set of chassis-format design plans that those sweeps will
implement verbatim. The goal is simple and absolute: **maximize the probability
of winning the grand prize AND at least one side-track prize**.

%%PATH_RESOLUTION%%

## READ FIRST (in this order)

1. \`design_documents/winning_project_plan.md\` — the selected idea, architecture spec,
   and suggested module emphasis (entry-local copy of \`hackathon-projects/${proj}/winning_project_plan.md\`). This is the source of truth for WHAT we build.
2. \`design_documents/proposal.json\` — Component Advisor output: which chassis modules
   were selected/excluded and why (entry-local copy of \`hackathon-projects/${proj}/proposal.json\`). If it is absent, read
   \`../../hackathons/contracts/component-catalog.json\` and assume all twelve components with the
   advisor's minimal-viable defaults.
3. \`../../hackathons/contracts/component-catalog.json\` — what each selected chassis module
   already provides (do NOT redesign chassis behavior; compose it).
4. The chassis design plan for EACH selected module. Mapping (module → plans in
   \`../../hackathons/design_documents/design_plans/\`):

   | module | design plan(s) |
   |---|---|
${moduleDpTable
    .split("\n")
    .map((line) => `   ${line}`)
    .join("\n")}
5. \`../../hackathons/design_documents/lablab_hackathon_strategy_blueprint.md\` — §5 (rules
   confirmations) and §7 (the per-hackathon playbook you are automating).
  6. \`../../hackathons/hackathon-projects/${proj}/event_profile.json\` or the event profile wherever
     the Event Profile Extractor wrote it (legacy preparing/exercise-1/work/ is deprecated) — mandated platform, sponsor tracks,
     judging criteria, submission rules, deadlines. When absent, fall back to
     \`design_documents/hackathon_brief.md\` as the source for tracks, criteria, and deadlines.

## MANDATORY COMPLIANCE — DISQUALIFICATION-LEVEL (extract before any design)
Before drafting any blueprint section, scan \`design_documents/winning_project_plan.md\` + its
source \`design_documents/hackathon_brief.md\` (§4 Hackathon Rules - Requirements - Tracks) and the live *Hackathon-page* for verbatim:
- MANDATORY TECHNOLOGIES: whatever the brief's §4 lists as "Every project must use" / "Required developer tools" / "What to Build" — copy the exact SDK/API/platform/model names and call methods verbatim — never invent, never hardcode a stack not in the brief.
- PRIZE TRACKS: whatever the brief's Tracks/Prizes section lists — copy track names/table exactly + judging axes/weights if published.
- SUBMISSION GATE: whatever the brief's Submission Requirements lists — copy exact fields verbatim (hosted URL, public repo + spin-up guide, license file, architecture diagram, video length + proof requirements exactly as published).
- BONUS (if any): only if the brief explicitly lists bonus integrations/points (e.g. Gemma/Veo/Lyria, blog/social) — otherwise state "no bonus — not worth track dilution".
These are Stage-One pass/fail — a missing mandatory tech = disqualified regardless of idea quality. Therefore:
- §1 Requirements MUST trace each mandatory tech from the brief to a winning-plan section and to a Judging axis, using the winning plan's \`### Mandated Technology Leverage Map\` (TECHNOLOGY LEVERAGE CONTRACT below): every capability row the plan uses becomes a requirement traced to the axis it evidences.
- §2 Architecture MUST name the chosen mandatory stack per the brief (model name + call method if LLM, agent framework if any, infra/deploy service with deploy command and video capture plan as the brief requires) and diagram wiring. Do not hardcode any stack the brief does not mandate. Where the product embeds an LLM and the brief does not mandate one, it is Gemini via Vertex AI (AI MODEL ACCESS below); where the mandated technology lets the user's own agent drive the product, the product is built for that agent and ships no competing embedded assistant as its main path.
- §3 Design-plan map MUST allocate a work unit to each mandatory proof artifact (deploy, diagram, video GCP segment, spin-up).
- sponsor_tracks choice must be justified as the highest win-probability track for this idea — not "empty" when brief names tracks.
- Bonus integrations are opt-in only: include Gemma/Veo/Lyria only when Stage Three bonus outweighs dilution; otherwise explicitly state "no bonus integration".

## DELIVERABLES (exact paths) — exactly THREE kinds of artifact, nothing else

You write the Master Blueprint, the Visual Identity Plan **and every design plan** in THIS run. There are no
intermediate prompt files and no sequential-authoring config: the next thing that happens
after this chat is implementation.

1. \`design_documents/master_blueprint_entry.md\` — the entry's master
    blueprint:
    - §1 Requirements: functional + non-functional, each traced back to
      winning_project_plan.md sections and event judging criteria.
    - §2 Architecture: components, data flow, envelope/transport wiring from
      engine to the assembled UI (the EventEnvelope shape and useEventStream() only when the
      platform transport module is included; otherwise the domain store's subscription), plus
      an explicit inter-module contract table: every cross-module function/type/file
      is owned by exactly one module — with file path, export name, and
      input/output shape — so consumers know what to import and never re-implement
      or stub it.
    - §3 Design-plan map: EVERY design plan needed to build the entry — one row
      per plan with id (\`DP-<TOPIC>\`), title, scope boundaries, the interfaces
      it owns (inputs/outputs/paths), its consumers, its dependencies on other plans,
      and the requirements each of its work units must fulfill. This map together
      with §2 is the single binding contract between all the plans you then write.
    - §3a Inter-module boundary rule (why §2+§3 must be in-depth): §2+§3 are what
      keep the plans consistent with one another. If they are vague, one plan will
      expose foo() while another independently creates its own foo() or stub and
      neither is used — resulting in disconnected, duplicate implementations. So
      §2+§3 must be exhaustive: every provider-consumer pair is named once, with
      owning module, file, export, and shape, so plans import rather than duplicate.
    - §3b **DP-UI is mandatory, and it ships a professional visual identity on its FIRST
      implementation.** The §3 map MUST contain exactly one plan with the id \`DP-UI\` that owns the
      entry's entire user interface AND its visual identity — colours, typography, spacing, elevation,
      motion, component states, both themes. There is NO separate restyling, polishing or
      "visual pass" plan: a second plan touching the look of the product is forbidden, because the
      redesign-after-implementation loop it creates is exactly what this contract removes. The taste is
      applied HERE, by you, at plan time: you write \`design_documents/visual_identity_plan.md\`
      (deliverable 2 below) with literal values, and DP-UI reproduces that token set verbatim in its own
      §5, so the low-intelligence implementor only transcribes. Its requirements are fixed by the VISUAL
      IDENTITY CONTRACT section below — write the parts of that contract that bind the implementor into
      \`design_documents/design_plans/DP-UI.md\` itself. Single owner: no other plan defines a colour,
      a font, a radius, a shadow or an animation. Place DP-UI in the map where the UI naturally belongs
      (after the API/transport plan it consumes) — it is a normal build plan, not a late cosmetic one.
      **DP-UI's FIRST work unit is the DESIGN BRIEF** — \`design_documents/design_brief.md\`, written
      before a single token is chosen: the product in one sentence, the persona it is for (from
      \`personas.json\`, never invented), the ONE feeling the interface should produce, the
      subject-matter anchor outside software that the palette and typography descend from, three
      named references with the property borrowed from each, and three named anti-references. The
      vendored \`frontend-design\` skill in \`.claude/skills/\` is then worked in two passes — a compact
      design plan (palette hexes, typeface roles, layout concept, motion principles), then a review
      of that plan AGAINST the brief asking of every choice whether it is specific to this product
      or a default that arrived by habit — and only then is any component written. The review pass
      is recorded with what it changed; a review that changed nothing did not happen. This is what
      stops every entry converging on the same competent, anonymous dashboard. DP-UI also emits
      \`cinematic-tokens.json\` beside the token set: the one palette the app, the slides and the
      video's motion graphics all import.
      **DP-UI's SECOND work unit is the brandmark** (BRANDMARK CONTRACT below): an authored vector mark,
      the product name, and the slogan beneath it, all as live text with one designer's device, one \`currentColor\` file for both themes, in the app header on
      every page, as the favicon, and copied to \`hackathon-projects/${proj}/brand/\` so DP-SCRIPT's
      cover and slides can import it. You design it at plan time in
      \`visual_identity_plan.md\` §2A; no image model touches any part of it; and no other plan
      redraws it. **DP-UI is also bound by the UI CRAFT CONTRACT below**, which is what stops a
      token-compliant entry from shipping a debug harness: differentiated type within every group,
      containers that are objects rather than background colours, numbers that cannot wrap, status
      messages with a surface and a total template, an accent that actually appears, a labelled
      explainer beside the title and a \`?\` on every result region, no raw text, a real typeface — all
      asserted by a DOM measurement block that fails the work unit. **Its §13 binds the UI to the
      camera**: body text at least 18px, numerals at least 28px, a hero metric at least 64px,
      exactly one \`data-demo-focus="<beat-id>"\` per route (the recorder reads it to emit the real
      element rectangle, so the design and the camera cannot disagree), state changes animated in
      200-400ms, no hover-only meaning, a quiet frame per route, a three-step elevation scale, and
      ONE theme for the whole video — \`hackathon-projects/${proj}/video-config.json\` \u2192
      \`video_theme\`, default \`paper\` (DP-V9: light and warm like all three winning entries — and
      the app should be designed for a 1280×720 laptop viewport, with an on-page activity log of
      every agent/tool call, a visible validation/veto UI, observable DOM changes on its
      \`data-demo-focus\` elements, a human-readable deploy URL, and — when it shows a spatial
      artifact — a Three.js view carrying \`[data-demo-3d]\`).
    - §3f **\`architecture.json\` is a build deliverable.** The plan that owns the system's shape
      (usually the API/transport plan) MUST write \`../../hackathons/hackathon-projects/${proj}/architecture.json\`
      to the ARCHITECTURE CONTRACT (\`contracts/architecture.schema.json\`, example at
      \`templates/architecture.example.json\`): six to twelve nodes with short labels and lanes, the
      edges between them, **at least one node marked \`"sponsor": true\`**, and on an edge touching
      it a \`proof\` naming a real file, a real line and the text on it. The video's architecture
      beat is GENERATED from this file and animated by the voice, so a hand-drawn diagram is never
      needed and never allowed. **The proof lines are harvested from DP-E2E-BROWSER-TESTING's real
      run, never written from the plan** - a proof measured before the product runs is the same
      defect as a fact written from the plan, which the script spec exists to prevent.
      \`node scripts/lint-architecture.ts <project dir>\` reads every proof at its line and fails
      when it does not match; it runs in the video health gate before any voice is synthesized.
    - §3g **DP-DOMAIN-ENGINE is mandatory, and it comes first.** The §3 map MUST contain exactly one
      plan with the id \`DP-DOMAIN-ENGINE\` that owns the product's stateful domain model (one store, id-addressable
      entities, a revision number, undo history, ONE set of actions that both the UI and the agent call)
      and its deterministic **truth engine** (\`check(model) → Issue[]\`, rules with units, a seed
      scenario proven to produce zero errors), to the PRODUCT DEPTH CONTRACT below (§1–§4). It is the
      first build plan in the map; every other plan imports its store and never re-implements it.
    - §3h **DP-AGENT-WORKFLOW is mandatory.** The §3 map MUST contain exactly one plan with the id
      \`DP-AGENT-WORKFLOW\` that owns the winning plan's \`### Agentic Workflow & Call Graph\` and
      \`### Action Surface\`: the typed action registry (descriptors, schemas, results with \`ok\`,
      \`summary\`, \`revision\`, \`validNextActions\`), the full literal text of every model-role prompt,
      the multi-round orchestration (perceive → plan → act → verify with the truth engine → repair →
      human checkpoint), the approval gate, the manual action runner and \`run-trace.json\`, to the
      PRODUCT DEPTH CONTRACT below (§2, §3, §5, §9). It also owns the use of the mandated technology per
      the TECHNOLOGY LEVERAGE CONTRACT below: every capability row the plan claims is exercised in code.
      It comes immediately after DP-DOMAIN-ENGINE. **The core demo is never "one planner call → steps → one
      summary call".** Its floors (model roles, verify → repair, human checkpoint) are asserted from
      \`run-trace.json\` by DP-E2E-BROWSER-TESTING.
    - §3i **DP-3D is mandatory.** The §3 map MUST contain exactly one plan with the id \`DP-3D\`,
      placed immediately after DP-UI, that owns the entry's signature real-time 3D view to the
      3D EXPERIENCE CONTRACT below: the scene built from DP-DOMAIN-ENGINE's store and live-bound to every
      human and agent action, materials derived from DP-UI's token set (DP-3D defines no new brand
      colour), named camera shots, the \`[data-demo-3d]\` + \`window.__demo3d\` hooks the existing video
      recorder already reads, a \`/lab\` tuning route, a capability fallback, and its final work unit's
      Gemini-vision review loop via Vertex (score ≥ 8/10 or three rounds). DP-UI places the 3D view in
      the hero layout; DP-3D renders it.
    - §3j **DP-SHOWCASE is mandatory.** The §3 map MUST contain exactly one plan with the id
      \`DP-SHOWCASE\`, placed **immediately after the plan that deploys the product** and before the
      docs/submission plan (and therefore before DP-SCRIPT and DP-LIVE-RUN-AND-VIDEO). It owns the
      non-video showcase: the README written to the order of the HEE SHOWCASE SPEC, the stills generated
      from \`design_documents/demo-scenario.json\` against the deployed URL, \`JUDGES.md\`, the claim
      ledger \`claims.json\` with its lint, and the \`/watch\` replay route. Single owner: no other plan
      writes the README or the stills. Its last work unit writes
      \`design_documents/operator-final-checks.md\` with the exact commands the operator runs from the
      chassis before submission (the provenance check and the judge-panel final stage, each with this
      entry's real paths). DP-SHOWCASE does not touch the video plans or the video's own fact ledger.
    - §3c **DP-E2E-BROWSER-TESTING is mandatory.** The §3 map MUST contain a plan with the id
      \`DP-E2E-BROWSER-TESTING\` whose sole deliverable is a real-browser end-to-end proof of every
      use case, and it MUST be placed **immediately before the plan that deploys the product** (and
      therefore before DP-SCRIPT and DP-LIVE-RUN-AND-VIDEO). If the entry has no deploy plan, it is the
      plan immediately before DP-SCRIPT. It runs after the product is built, because it drives the built
      product with a browser; it runs before the deploy, because a defect found after a deploy costs the
      operator a redeploy. It owns one \`BASE_URL\`-parameterised smoke suite that the deploy plan's
      final work unit, DP-SCRIPT's first work unit and DP-LIVE-RUN-AND-VIDEO's health gate each re-run
      against the DEPLOYED url — so the cloud URL is proven green before any fact is measured and before
      any frame is recorded. Its requirements are fixed by the E2E BROWSER TESTING CONTRACT section
      below — write that contract into \`design_documents/design_plans/DP-E2E-BROWSER-TESTING.md\`
      itself, so the implementor has it without reading any other file. Single owner: no other plan
      writes a browser smoke test, and the plans named above CALL this one's suite rather than inventing
      their own. Besides the use-case proof, DP-E2E-BROWSER-TESTING owns the **depth acceptance**
      (PRODUCT DEPTH CONTRACT §9: floors read from \`run-trace.json\` of one core-demo run against the
      deployed URL) and the **3D acceptance** (3D EXPERIENCE CONTRACT §7), and exercises every
      mandated-technology capability the plan claims. The resulting map therefore starts
      \`DP-DOMAIN-ENGINE → DP-AGENT-WORKFLOW → …\` and ends:
      \`… → DP-UI → DP-3D → … → DP-E2E-BROWSER-TESTING → <deploy> → DP-SHOWCASE → <docs/submission> → DP-SCRIPT → DP-LIVE-RUN-AND-VIDEO\`.
    - §3d **DP-SCRIPT is mandatory.** The §3 map MUST contain a plan whose sole
      deliverable is the demo-video script, its machine-readable narration segments
      (\`narration-segments.json\`) and its two generated slides, and it MUST be the
      second-to-last plan in the map. Its work units run only after the product is built,
      because its first work unit executes the real product to harvest measured facts, and its
      later work units generate the slide graphics with Gemini via Vertex and assemble the
      slides per §9A of the contract. Its
      requirements are fixed by the DEMO-VIDEO SCRIPT CONTRACT section below —
      write that contract into \`design_documents/design_plans/DP-SCRIPT.md\`
      itself, so the implementor has it without reading any other file. Single
      owner: NO other plan may author the demo-video script or its slides. A demo/packaging plan
      may record, edit and upload the video, but the words and slides come from DP-SCRIPT — a
      plan that writes a script before the product runs is how every previous entry
      got an unusable one. Because the voiceover is SYNTHESIZED, not read by a human, DP-SCRIPT's
      spoken text must survive a text-to-speech engine unchanged (§4A of the contract) and must
      also be emitted as data (§8A) — the script's prose and that JSON carry the same words,
      character for character. It measures the running time with the estimator
      (\`tts_vertex.py --batch narration-segments.json --estimate\`) rather than a
      words-per-minute guess, and writes the script to the **WINNER ARC** (\`"arc": "winner-v1"\`) at
      **120–150 seconds** (never over min(cap − 5 s, 165 s)) — cutting the weakest section, never the
      demo, and never padding with filler. The arc: W1 a 3D cold open (≤ 16 words, no product
      name), W2 the problem as a mechanism, W3 the insight with the product name first spoken and a
      real code card, W4 a chaptered demo of ≥ 45% of the runtime, W5 a trust beat, W6 a 3D wow built
      from the demo's own data, W7 a held close. No self-introduction, no presenter phrases, ≤ 20 words
      a sentence, ≤ 3 numbers. It owns \`stage3d.json\` and its data — harvested from a real run, with a
      provenance pointer, by a harvest step after the E2E run — and the cover thumbnail, to the VISUAL
      ASSETS CONTRACT below: **every generated picture carries zero text, and every
      word the viewer reads is HTML with a real layout engine over it**, because image models
      misspell and hand-placed SVG text has no layout engine. The film is **ONE theme, default
      \`paper\`** (light, warm, high-contrast), because all three winning entries are light. And it leaves
      \`narration-review.md\` in the project folder so the operator can rewrite anything that
      reads machine-made BEFORE a voice is ever synthesized.
    - §3e **DP-LIVE-RUN-AND-VIDEO is mandatory.** The §3 map MUST contain a plan whose sole
      deliverable is the FINISHED, NARRATED, SUBTITLED, SUBMISSION-READY video —
      \`hackathon-projects/${proj}/video/final.mp4\`, 1920×1080 H.264 + AAC in one theme (default \`paper\`), with
      captions burned in and a soft subtitle track, 120–150 seconds long and never over the cap, a music bed level-matched 12 dB under the
      voice (audible throughout, never only in the pauses; reused from the music-bed catalog when a suitable clip exists), measured against the three winning videos (\`video_qa.py\` + a blind judge) — together with the silent master, the rendered narration track and the
      narration-timestamp sheet it was assembled from; and it MUST be the LAST plan in the
      map. It runs only after the product is deployed to the cloud AND after DP-SCRIPT, because
      its first work unit is a health gate against the deployed URL that declines loudly when the
      deployment is missing or unhealthy — it can never run in the same sweep as the build or
      DP-SCRIPT. **There is no manual voiceover step anywhere in this plan.** The voice is
      synthesized from DP-SCRIPT's \`narration-segments.json\` BEFORE any browser opens — and
      before THAT, the plan STOPS — **exactly once, at THE ONE PAUSE** (§3A.0). That single stop
      carries every decision a human owns: the path to \`narration-review.md\` (the exact words
      the voice will read), a per-segment duration estimate against the 120–150 s target window with
      how many words to add or cut, and an inventory of every graphic and 3D data file DP-SCRIPT generated
      so the operator can call for any of them to be regenerated. The plan then waits, and **never
      stops a second time** — after the gate it runs unattended to a finished file. Its
      measured per-segment durations then set every beat's hold, and the last work unit muxes audio and
      footage into \`final.mp4\` and asserts that file is submittable. A plan that stops at a
      silent master and hands the operator a script to read has failed this contract. Its requirements are fixed by the LIVE-RUN-AND-VIDEO CONTRACT section below —
      write that contract into \`design_documents/design_plans/DP-LIVE-RUN-AND-VIDEO.md\`
      itself, so the implementor has it without reading any other file. Single
      owner: NO other plan may record the submission video.
    - §4 Submission checklist mapping: deployed public URL, public repo,
      disclosure doc, deck/demo — which design plan produces which. The deployed URL is
      only claimed once DP-E2E-BROWSER-TESTING's smoke suite is green against it (§3c). The
      demonstration video's script, narration segments and slides are produced by DP-SCRIPT
      (§3d); the synthesized narration, the recorded master and the finished narrated
      \`video/final.mp4\` that the submission form actually receives are produced by
      DP-LIVE-RUN-AND-VIDEO (§3e).
    - §5 Risks + degraded-demo fallback ladder.
2. \`design_documents/visual_identity_plan.md\` — the entry's complete design system, written by
   YOU in this run, to the shape fixed by the VISUAL IDENTITY CONTRACT below: audience and visual
   register derived from the winning plan; the §2A brandmark (idea, geometry, wordmark, colours with
   contrast ratios, clear space, minimum sizes) to the BRANDMARK CONTRACT; literal light and dark colour tokens with contrast ratios;
   a literal type scale; literal spacing, radius and elevation ladders; a motion table with
   reduced-motion substitutes; a component spec per component the entry actually renders; the layout
   map; the pinned library stack; the empty/loading/error/degraded copy; and the screenshot acceptance
   list. Every value is literal — nothing in this file may be left to the implementor's judgement.
   DP-UI is its only consumer, and reproduces it verbatim.
3. \`design_documents/design_plans/DP-<TOPIC>.md\` — ONE file per plan listed in
   the §3 map, all of them written here, in §3 order. Each one is the COMPLETE,
   fully defined, chassis-format design plan: the implementor opens exactly this
   one file and the code it names — never the blueprint, never another plan.

   Required shape, in this order:

   - \`# DP-<TOPIC> — <title>\`
   - **§0 Context & blockers** — what must already exist before WU-01 runs.
   - **§1 Purpose & requirement IDs** — traced to blueprint §1.
   - **§2 Scope boundaries** — an IN list (exactly the files this plan creates,
     no others) and an OUT list (files owned elsewhere, each naming its owner).
   - **§3 Interfaces owned** — literal skeletons: full file path, exact export
     names, complete signatures with types, and the literal docstring/header
     comment of each.
   - **§4 Interfaces consumed** — the exact import lines to copy verbatim, each
     naming the plan that owns it.
   - **§5…§N Algorithms** — numbered steps or pseudocode for every non-trivial
     behaviour, plus the literal full text of any prompt / schema / config file
     this plan owns.
   - **§N+1 Failure modes** — what degrades, how, and what the user sees.
   - **§N+2 Work units** — \`WU-<TOPIC>-01\`, \`-02\`, … in execution order.
     Each has: Goal, numbered Steps, Files created/modified, ONE runnable
     verification command, its EXACT expected output, and one sentence saying
     what that output proves.
   - **§N+3 Verification summary** — every verification command in order.
   - **§N+4 Risks.**

   Write the plans in dependency order, so that when a plan's §4 names an import,
   the plan that owns it is already written and the names match character for
   character.

**All three artifacts must be finished in this run.** A design plan that says "to be
detailed later", leaves a signature unspecified, or tells the implementor to go read
the blueprint has failed the HARD QUALITY BAR below. If you are running short, cut
scope in §3 — fewer plans, each complete — never detail.

## ENTRY REPOSITORY CONTENTS + SUBMISSION DOCS — binding policy

### What may live in the entry repository

The entry repo is what the organizers clone and judge. It contains **the application and
nothing else**: source code the product needs to run, its tests, its build/deploy config, and
the few documents the rules require.

Allowed at the entry root, and nothing more:

- application source, tests, build and deploy configuration
- \`README.md\`, \`LICENSE\`, \`disclosure.md\`, the hygiene report
- \`design_documents/\`
- \`hee/\` — vendored measurement and showcase tooling with its licence notices, so that judges can reproduce the evaluation
- the evaluation and showcase artefacts: \`evals/\`, \`claims.json\`, \`JUDGES.md\`, \`shots/showcase/\`, \`actions.manifest.json\`, \`run-trace.json\`

**Every production aid goes to \`../../hackathons/hackathon-projects/${proj}/\` instead** —
the pitch deck, the demo-video script, the judge Q&A sheet, capture artifacts, and the
assembly manifest. They help the operator make the submission; they are not part of the
product, and a judge opening the repo should not have to wade through them. When a plan runs
a chassis tool that defaults to writing into the repo root, it MUST pass an explicit output
path into that folder.

### README.md — never mention the shared infrastructure

The README is a product README: what it does, who it is for, how to run it, the track, the
stack, the hosted URL, the licence. It must **not** contain a "prior work"/"scaffolded from"
paragraph, must not name or link any chassis/starter/boilerplate repository, and must not list
which shared directories were copied in. Originality disclosure belongs in
\`disclosure.md\` — that is the file the rules ask for, and duplicating it in the README
oversells shared plumbing as the substance of the entry. The only place the README may name \`hee/\` is the reproduce command inside the generated measured-proof block; it never describes where that tooling came from.

### disclosure.md — capabilities, not a catalogue

\`disclosure.md\` is generated; a plan may APPEND event-specific sections (AI usage, data
provenance, runtime proofs) but must not rewrite the generated part or reintroduce what it
deliberately removes. The generated part states, in plain English:

- which pre-existing blocks of code are present, one bullet each, describing **what the code
  does** — never a repository name, never a module id, never a requirement code;
- that all application-level code and most lower-level code was written for this hackathon;
- how the entry was built (design plans authored with Claude AI, implemented with cheaper
  models, tested with Claude).

Any section a plan appends follows the same rule: describe capabilities and state what is new
work. Do not name the shared repository anywhere, and do not enumerate its directories.
Accuracy still wins over brevity — if pre-existing code ships, it is disclosed; the rule
governs *how* it is described, never *whether* it is.

## AI MODEL ACCESS — Gemini is available via Vertex; never report "no AI configured"

This applies to EVERY plan you write, not to one of them. Reproduce §1 and §2 of the spec below inside
the \`§0 Context & blockers\` of every design plan whose work units make a live model call — the
AI/agent plans, DP-E2E-BROWSER-TESTING and DP-SCRIPT at minimum — so no implementor ever stalls on a
missing API key that was never supposed to exist.

<<<BEGIN AI ACCESS SPEC — templates/ai-access.spec.md>>>

${aiAccessSpec}

<<<END AI ACCESS SPEC>>>

## PRODUCT DEPTH CONTRACT — binding on DP-DOMAIN-ENGINE, DP-AGENT-WORKFLOW and DP-E2E-BROWSER-TESTING

Our previous entries were one-shot proofs of concept: a bundled synthetic dataset, one planner call,
three to five deterministic steps, one summary call. The entries that won prizes owned a rich,
stateful, checkable domain that an agent works over many verify-and-repair rounds through a broad
action surface, with the human as co-author. The contract below is how that depth is built. Reproduce
§1–§5 inside \`DP-DOMAIN-ENGINE.md\` and \`DP-AGENT-WORKFLOW.md\` (each the parts it owns), §9's
depth acceptance inside \`DP-E2E-BROWSER-TESTING.md\`, and write every model-role prompt out in full in
DP-AGENT-WORKFLOW. That is where a low-intelligence implementor cannot fill a gap.

<<<BEGIN PRODUCT DEPTH SPEC — templates/product-depth.spec.md>>>

${productDepthSpec}

<<<END PRODUCT DEPTH SPEC>>>

## TECHNOLOGY LEVERAGE CONTRACT — binding on the blueprint §1, DP-AGENT-WORKFLOW and DP-E2E-BROWSER-TESTING

Judges of a sponsored technology reward entries that use most of it, including its newest corners,
and that prove its effect. The winning plan's \`### Mandated Technology Leverage Map\` lists the
capabilities this entry claims. Trace each one into blueprint §1, implement it in the plan that owns
it, and exercise it in DP-E2E-BROWSER-TESTING. When the technology changes what an agent can do,
DP-E2E-BROWSER-TESTING also owns the §4 with/without measurement.

<<<BEGIN TECHNOLOGY LEVERAGE SPEC — templates/tech-leverage.spec.md>>>

${techLeverageSpec}

<<<END TECHNOLOGY LEVERAGE SPEC>>>

## 3D EXPERIENCE CONTRACT — binding on DP-3D, DP-UI (hero placement) and DP-E2E-BROWSER-TESTING

Every entry ships a signature real-time 3D view of its own domain state. Reproduce the spec below
inside \`design_documents/design_plans/DP-3D.md\` verbatim (§1–§5 and §7), take the stack from its §3
list only, and allocate its §7 visual review to DP-3D's final work unit. The video pipeline is not
changed: DP-3D only provides the hooks the existing recorder already reads.

<<<BEGIN 3D EXPERIENCE SPEC — templates/3d-experience.spec.md>>>

${threeDSpec}

<<<END 3D EXPERIENCE SPEC>>>

## HEE ENHANCEMENT CONTRACTS — binding on the plans named in each block

These contracts add measured depth, craft and a showcase to every entry. Each block below is
inlined verbatim; reproduce its binding parts inside the plan it names. The tooling is vendored in
this repository under \`hee/\` (see \`hee/VENDOR.json\` and \`hee/DEPENDENCIES.md\`; install the listed
dependencies once, first). Nothing in this section changes the demo-video pipeline.

**Composition root.** DP-DOMAIN-ENGINE builds all application state in one function
\`createSession()\` (domain store, truth engine, action registry, approval gate, trace writer). The live
app calls it once; the replay route of DP-SHOWCASE calls it again for a second, isolated session.

### Kit: 3D scene — binding on DP-3D
<<<BEGIN HEE KIT THREE-SCENE SPEC — templates/hee-kit-three-scene.spec.md>>>

${heeKitThreeSceneSpec}

<<<END HEE KIT THREE-SCENE SPEC>>>

### Kit: agent workflow — binding on DP-DOMAIN-ENGINE (store, truth engine, registry, gate, trace) and DP-AGENT-WORKFLOW (agent loop, prompts, transport)
<<<BEGIN HEE KIT AGENT-WORKFLOW SPEC — templates/hee-kit-agent-workflow.spec.md>>>

${heeKitAgentWorkflowSpec}

<<<END HEE KIT AGENT-WORKFLOW SPEC>>>

### Art direction and visual review — binding on DP-UI (its first work unit, Part A) and on the last work unit of DP-UI and DP-3D (Part B)
<<<BEGIN HEE ART DIRECTION SPEC — templates/hee-art-direction.spec.md>>>

${heeArtDirectionSpec}

<<<END HEE ART DIRECTION SPEC>>>

### Agent-surface evaluation — binding on DP-E2E-BROWSER-TESTING (extra work units after the depth and 3D acceptance)
When the entry exposes actions to an agent, this evaluation replaces the ad-hoc with/without measurement of the technology leverage contract §4; the numbers published are the evaluation's.
<<<BEGIN HEE AGENT EVAL SPEC — templates/hee-agent-eval.spec.md>>>

${heeAgentEvalSpec}

<<<END HEE AGENT EVAL SPEC>>>

### Showcase — binding on DP-SHOWCASE
<<<BEGIN HEE SHOWCASE SPEC — templates/hee-showcase.spec.md>>>

${heeShowcaseSpec}

<<<END HEE SHOWCASE SPEC>>>

**Operator checks from the chassis (listed by DP-SHOWCASE in \`design_documents/operator-final-checks.md\`):**
\`npx vite-node src/harvest/cli.ts provenance --entry ../hackathon-entries/${proj} --reference-root ../hackathon-entries/_reference/<event-slug>\` must print \`provenance: pass\`; and
\`npx vite-node src/judge-sim/cli.ts final --project hackathon-projects/${proj} --entry ../hackathon-entries/${proj}\` produces the judge-panel report whose weakest axis is fixed or explained before submission.

## VISUAL IDENTITY CONTRACT — binding requirements for \`visual_identity_plan.md\` and DP-UI

Judges score the product they can see, and the chassis has repeatedly shipped a plain UI from the sweep
that then had to be redesigned and re-implemented in a separate pass. That rework is removed by moving
the taste upstream: YOU design the system now, in literal values, and the implementor transcribes it.
Write \`design_documents/visual_identity_plan.md\` to the shape in §3 of the spec below, then write
\`design_documents/design_plans/DP-UI.md\` with the §4 additions — its §5 reproducing the whole token
set verbatim, and its final work unit producing the §5 screenshot set and contrast check.

<<<BEGIN VISUAL IDENTITY SPEC — templates/visual-identity.spec.md>>>

${visualSpec}

<<<END VISUAL IDENTITY SPEC>>>

## BRANDMARK CONTRACT — binding requirements for DP-UI's brandmark work unit (its SECOND, after the design brief)

Entries have shipped as nameless applications: a header with a text string in the default font, two
slides each treating the name differently, and a cover treating it a third way. A judge moving between
the video and the repository has nothing to recognise. A brandmark fixes that for one work unit.

**This is not a new design plan.** It is the first artefact of the visual identity, and DP-UI already
single-owns that identity — a separate brand plan would split the ownership the VISUAL IDENTITY SPEC
forbids. So you design it at plan time into \`design_documents/visual_identity_plan.md\` §2A with
literal values, and DP-UI builds it in its **first** work unit, before any screen is styled, because
the header consumes it and so does everything downstream.

The lockup is **authored vector geometry plus live text**: the mark carries no \`<text>\` element and
one \`currentColor\`-driven file serves both themes; the app name is rendered by a real layout engine so
it cannot be misspelled or mis-set. **No part of it is ever produced by an image model.** DP-SCRIPT
imports it for the cover and both slides rather than redrawing it, and because those artefacts live
outside the entry repo, DP-UI writes a portable copy into
\`hackathon-projects/${proj}/brand/\` in the same work unit that authors the original.

Reproduce this contract's binding parts inside \`design_documents/design_plans/DP-UI.md\` verbatim.

<<<BEGIN BRANDMARK SPEC — templates/brandmark.spec.md>>>

${brandmarkSpec}

<<<END BRANDMARK SPEC>>>

## UI CRAFT CONTRACT — binding requirements for DP-UI, alongside the visual identity

**Tokens are vocabulary. This is grammar.** A shipped entry satisfied every rule in the VISUAL
IDENTITY CONTRACT — literal hexes, a type scale, a spacing ladder, both themes — and still produced a
screen that read as a debug harness: degraded-mode text printed over the layout as two bare bullets
touching the viewport edge; the copy itself broken (\`"Step draft-1 degraded via none: ."\` — an empty
interpolation slot shipped as prose); cards that were nothing but a slightly different background;
a token counter wrapping onto two lines at a size borrowed from a heading; ten status rows in one
identical treatment; a full palette of which one chip was visible; no way for a judge to find out what
anything did; retrieved text dumped raw with its markdown fences showing; and the default system font
throughout.

Every one of those is cheap to prevent and none of them were forbidden. The contract below forbids
them and asserts the fix in the rendered page. Reproduce its §2–§7 rules and its §11 assertion block
inside \`design_documents/design_plans/DP-UI.md\` verbatim, the same way DP-UI reproduces the token
table, and order DP-UI's work units so the app bar, the system-message set and the metric component
are built **before** the feature panels that consume them.

<<<BEGIN UI CRAFT SPEC — templates/ui-craft.spec.md>>>

${uiCraftSpec}

<<<END UI CRAFT SPEC>>>

## BANNED VOCABULARY CONTRACT — binding on DP-SCRIPT, DP-UI and DP-LIVE-RUN-AND-VIDEO

A handful of words are so characteristic of generated text that their presence is a tell. A sentence
that announces its own honesty does not sound more honest, it sounds machine-written. A judge who has
already watched six AI-built submissions that morning recognises the vocabulary before the first slide
ends, and discounts everything after it.

**The list is data, it is maintained by the operator, and it GROWS.** Read
\`../../hackathons/templates/banned-words.json\` at the start of the run. Do not hardcode today's entries
into a plan, and do not assume the words quoted below are still the whole list.

${bannedWordsList}

Banned from every judge-visible surface: the spoken narration and therefore the subtitles; the cover
and both slide text layers; and every string the application renders — labels, buttons, navigation,
column headers, empty and error copy, message templates, \`helpContent\`, tooltips and \`aria-label\`s.
**No plan may specify a banned word as literal user-visible copy** — a plan naming a button
\`"Run triage"\` has shipped the word whatever the implementor does next. Source identifiers are out
of scope: the ban is on what is READ, not on what is compiled. Verbatim quotations are never edited.

Reproduce the check into the work units named in §3 of the spec below — DP-SCRIPT after it writes the
script and the segments, **DP-LIVE-RUN-AND-VIDEO at its health gate so a violation is caught before a
voice is synthesized and before a take is recorded**, and DP-UI in its craft audit.

<<<BEGIN BANNED WORDS SPEC — templates/banned-words.spec.md>>>

${bannedWordsSpec}

<<<END BANNED WORDS SPEC>>>

## E2E BROWSER TESTING CONTRACT — binding requirements for DP-E2E-BROWSER-TESTING

An entry whose modules each pass their own verification can still be a product no human can use. The
contract below fixes that; reproduce it inside
\`design_documents/design_plans/DP-E2E-BROWSER-TESTING.md\` verbatim, place that plan immediately
before the deploy plan, and wire its \`e2e/smoke.spec.ts\` into the three downstream gates named in
§5 of the spec (deploy, DP-SCRIPT, DP-LIVE-RUN-AND-VIDEO) — each with a different \`BASE_URL\`, never
with a second smoke test.

<<<BEGIN E2E BROWSER TESTING SPEC — templates/e2e-browser-testing.spec.md>>>

${e2eSpec}

<<<END E2E BROWSER TESTING SPEC>>>

## DEMO-VIDEO SCRIPT CONTRACT — binding requirements for DP-SCRIPT

Nearly every submission is judged from its video before its code. The chassis has repeatedly
produced scripts that could not be recorded, because they were written from the plan before the
product existed. The contract below fixes that; reproduce it inside
\`design_documents/design_plans/DP-SCRIPT.md\` verbatim, and allocate its §5 fact-harvest
to that plan's FIRST work unit.

DP-SCRIPT's work units must, in order: (1) harvest measured facts by executing the built product
twice with the exact demo parameters the video will use; (2) write
\`../../hackathons/hackathon-projects/${proj}/demo-video-script.md\` to the shape in §8 — OUTSIDE
this entry repo, which ships only the application — with spoken text that obeys §4A, because a
text-to-speech engine and not a human reads it aloud; (3) emit
\`../../hackathons/hackathon-projects/${proj}/narration-segments.json\` to the shape in §8A, and
machine-check that its concatenated \`text\` fields match the markdown's spoken blocks after
whitespace normalization; (4) generate both slide graphics with Gemini
via Vertex and assemble both HTML slides per the §9A runbook, into the \`pitch/\` subfolder
beside the script; (5) verify the acceptance checks in
§10, with the word-count check, the narration-segments schema/parity check and the
slide-artefact existence check as its runnable verification commands.

DP-SCRIPT's graphical work (step 4 above) is governed by the VISUAL ASSETS CONTRACT below and ships
**three** assets, not two: \`pitch/cover.png\` (the platform thumbnail), \`pitch/slide1.png\` (the
problem) and \`pitch/slide2.png\` (the outcome). Each is a GENERATED picture carrying zero text plus
an HTML text layer over it. Slide 1 must prove the problem is real with sourced evidence — prefer a
dated, attributed practitioner quote from
\`hackathon-projects/${proj}/mined_frustrations.json\` with its community, month and score, and the
persona it belongs to from \`personas.json\` — because whether the problem is real or invented is
most of the score, and the problem-grounding pipeline already mined the proof. Slide 2 must quantify
the change in units from the Fact Ledger. Verification is measured in the DOM, then looked at.

<<<BEGIN DEMO-VIDEO SCRIPT SPEC — templates/demo-video-script.spec.md>>>

${scriptSpec}

<<<END DEMO-VIDEO SCRIPT SPEC>>>

## VISUAL ASSETS CONTRACT — binding requirements for DP-SCRIPT's three graphical assets

A judge decides whether to open the repository in the first fifteen seconds of the video, and those
seconds are a slide. The chassis has twice shipped slides that lost that decision: the image was
never generated at all, a hand-authored SVG of rectangles and \`<text>\` labels was shipped in its
place, its labels overflowed their boxes because SVG has no layout engine, and the check that should
have caught it was "look at the screenshot and confirm it is fine."

The contract below fixes that. Reproduce its binding parts inside
\`design_documents/design_plans/DP-SCRIPT.md\` verbatim, and allocate the generation runbook and the
measured verification to DP-SCRIPT's own work units.

**The one rule everything else rests on: the picture layer is generated and carries ZERO text; every
word the viewer reads is HTML with a real layout engine over it.** Image models misspell; hand-placed
SVG text cannot centre, wrap or measure itself; HTML text can be asserted on and fixed in a second.

<<<BEGIN VISUAL ASSETS SPEC — templates/visual-assets.spec.md>>>

${visualAssetsSpec}

<<<END VISUAL ASSETS SPEC>>>

## LIVE-RUN-AND-VIDEO CONTRACT — binding requirements for DP-LIVE-RUN-AND-VIDEO

A script nobody records is a sunk cost, footage of an undeployed product is a submission failure,
and a silent master that still needs a human to read a voiceover over it is the step that gets
skipped when the deadline arrives. The contract below fixes all three; reproduce it inside
\`design_documents/design_plans/DP-LIVE-RUN-AND-VIDEO.md\` verbatim, and allocate its §3 health
gate to that plan's FIRST work unit.

**This plan's deliverable is a finished, narrated video file — not footage plus homework.**
Its work units must, in order: (0) STOP at the §3A.0 operator review gate, THE ONE PAUSE — write
\`narration-review.md\` with the exact spoken words, print the per-segment duration estimate
against the 120–150 s target window with the words-to-add-or-cut figure, list every graphic and 3D data file
by path for inspection, ask the operator in ONE message to edit the speech, adjust its length and
say which artefacts to regenerate, and wait; regenerate whatever they reject and re-present; resume
with \`--apply-review\` and do not stop again; (1) run the §3 health gate against the
deployed cloud URL — two green probes plus the deploy build marker — and decline loudly
(named failure, named deploy owner, re-run path, non-zero exit) when the deployment is missing
or unhealthy, recording nothing, and in the same unit verify \`ffmpeg\`/\`ffprobe\` and the
operator's Vertex credentials; (2) synthesize the entire voiceover per §3A — one pinned voice and
style pair, \`--voice Iapetus --style "Confident documentary narrator."\` — by running the chassis
renderer \`../../hackathons/_useful/scripts/render_narration.py\` over DP-SCRIPT's
\`narration-segments.json\` — one voice, one style direction, cached per segment — producing
\`video/narration/narration.wav\` and \`video/narration/narration-manifest.json\` with a MEASURED
duration per segment, and failing loudly rather than speeding up audio when the track overruns
the cap; (3) translate that manifest into a capture plan of beats whose minimum holds ARE the
measured audio seconds — never word-count estimates; (4) record one
continuous Playwright take at a 1280×720 CSS viewport and DPR 2 (CDP screencast, delivered at
1920×1080) in the video's one theme — the live demo against the deployed URL, its state changes
logged as events — with the §5 fake pointer parked on each beat's focus target;
(5) write the silent master, the §6B subtitles cued from the measured audio, and the
narration-timestamp sheet derived from the narration manifest; (6) mux
footage, narration and captions per §6A with \`../../hackathons/_useful/scripts/finalize_video.py\` into
\`hackathon-projects/${proj}/video/final.mp4\` (re-encoded H.264 + AAC, last frame held when the
footage is short of the voice, captions burned in plus a soft track, audio and subtitle streams
and the cap all asserted), and verify the acceptance checks
in §7 — with that finalizer's exit code as the plan's runnable verification command, and a final
printed line giving \`final.mp4\`'s path, duration, percentage of cap, size and sidecar
\`.srt\` beside the deployed URL.

<<<BEGIN LIVE-RUN-AND-VIDEO SPEC — templates/demo-live-run-video.spec.md>>>

${videoSpec}

<<<END LIVE-RUN-AND-VIDEO SPEC>>>

## HARD QUALITY BAR — the implementor is a LOW-INTELLIGENCE model

Encode this bar into §2+§3 of the blueprint AND into every design plan you write, so
that the implementor cannot infer anything and no two plans duplicate the same
cross-module contract:

- fully define every contract: exact file paths, exported names, function
  signatures, input/output JSON shapes — and for cross-module contracts,
  state owning module, file, export, and all consuming modules (single owner,
  N consumers; consumers MUST import, never re-define or stub);
- spell out every algorithm as numbered steps or pseudocode — no "use judgment",
  no "as appropriate", no unstated defaults;
- every work unit ends with one runnable verification command and its expected
  output (for cross-module work units, the command must exercise the actual
  provider→consumer import);
- if a task genuinely requires higher intelligence, split it until it does not,
  or move that part into a prompt template the runtime LLM call receives.

## CONSTRAINTS

- Engine code lives ONLY inside this repository (the assembled working copy):
  \`engine/\` stubs marked TODO(ENGINE) plus
  new files under \`src/\`. NEVER modify the sibling chassis repo's \`src/\`
  (\`../../hackathons/src/\`).
- Compose chassis modules via their documented CLIs/APIs, and only the modules the proposal
  includes. When \`resilience\` is included, wrap every outbound LLM call with \`withResilience\`;
  when the platform transport is included, emit progress as EventEnvelopes. Never add runtime
  plumbing a judge cannot see at the cost of domain depth.
- Depth over thrift: deterministic code decides validity (the truth engine, the store actions);
  models perceive, plan, generate, critique and explain, as many rounds as the PRODUCT DEPTH
  CONTRACT's call graph requires — never padding, never one-shot. Every model call returns
  schema-validated JSON, retries once with the validation errors, and degrades visibly
  (DegradedResult) instead of crashing mid-demo.

## FINISH

Print the list of generated files (the blueprint + \`design_documents/visual_identity_plan.md\` +
every \`design_documents/design_plans/DP-*.md\`), then print the §3 plan order as a single line and
confirm on it that \`DP-DOMAIN-ENGINE\` and \`DP-AGENT-WORKFLOW\` are the first two build plans, that
\`DP-3D\` sits immediately after \`DP-UI\`, that \`DP-UI\` is present exactly once, that \`DP-E2E-BROWSER-TESTING\` sits
immediately before the deploy plan, that \`DP-SCRIPT\` is second-to-last and
\`DP-LIVE-RUN-AND-VIDEO\` is last, and that DP-LIVE-RUN-AND-VIDEO's final work unit produces a
narrated, subtitled, paper-theme \`video/final.mp4\` of 120–150 s (inside the event cap),
with exactly ONE operator pause and no manual voiceover step anywhere in the plan, and that DP-SCRIPT
ships three GENERATED graphical assets (cover + two slides) whose pictures carry no text. Then stop. Do NOT implement anything
yourself — no application source, no engine code; the plans are the product of this run.
`;
  // Anchor chassis-relative paths first, THEN insert the resolution section (whose own
  // examples of bare paths must survive as written).
  return anchorChassisPaths(body, proj).replace("%%PATH_RESOLUTION%%", renderPathResolution(proj));
}
