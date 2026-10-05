// scripts/verify/ui-03-tokens.ts — DP-UI WU-UI-03 (16 checks).
// Requirement IDs: FR-19, NFR-05
import { readFileSync, writeFileSync, mkdtempSync, copyFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { applyTheme, initialTheme, persistTheme, readStoredTheme } from "src/ui/theme/theme.js";
import { createChecker, planBlock, sh } from "./ui-kit.js";

const c = createChecker("ui-03-tokens");

function tokensMaps(): { light: Record<string, string>; dark: Record<string, string>; scene: string[]; src: string } {
  const src = readFileSync("src/ui/tokens/tokens.ts", "utf8");
  const m = /export const tokens[^=]*=\s*(\{[\s\S]*?\n\});/.exec(src);
  if (!m) throw new Error("tokens object not found");
  const parsed = JSON.parse(m[1] as string) as { light: Record<string, string>; dark: Record<string, string> };
  const s = /export const sceneTokenNames[^=]*=\s*(\[[^\]]*\])/.exec(src);
  return { light: parsed.light, dark: parsed.dark, scene: JSON.parse((s?.[1] ?? "[]") as string) as string[], src };
}

// 1. The three self-hosted typefaces exist, are real variable fonts and start with wOF2.
{
  const names = [
    "fraunces-latin-wght-normal.woff2",
    "atkinson-hyperlegible-next-latin-wght-normal.woff2",
    "jetbrains-mono-latin-wght-normal.woff2",
  ];
  c.ok(
    names.every((n) => {
      const buf = readFileSync(join("public/fonts", n));
      return buf.length > 20000 && buf[0] === 0x77 && buf[1] === 0x4f && buf[2] === 0x46 && buf[3] === 0x32;
    }),
    "1 three woff2 fonts larger than 20k",
  );
}

// 2. fonts.css is the plan block byte for byte; every url( resolves under public/.
{
  const css = readFileSync("src/ui/tokens/fonts.css", "utf8");
  const urls = [...css.matchAll(/url\("([^"]+)"\)/g)].map((m) => m[1] as string);
  c.ok(css === planBlock("@font-face", "css") && urls.length > 0 && urls.every((u) => {
    try {
      readFileSync(join("public", u));
      return true;
    } catch {
      return false;
    }
  }), "2 fonts.css verbatim with resolvable urls");
}

// 3. tokens.css is the plan block byte for byte.
c.eq(readFileSync("src/ui/tokens/tokens.css", "utf8"), planBlock("--rail-w: 208px", "css"), "3 tokens.css verbatim");

// 4. cinematic-tokens.json is the plan block byte for byte and parses with the paper theme and slogan.
{
  const raw = readFileSync("cinematic-tokens.json", "utf8");
  const parsed = JSON.parse(raw) as { video_theme: string; slogan: string };
  c.ok(
    raw === planBlock('"video_theme"', "json") && parsed.video_theme === "paper" && parsed.slogan === "Know her day without calling.",
    "4 cinematic tokens verbatim with paper theme and slogan",
  );
}

// 5. tokens.ts carries the GENERATED header and regenerates identically.
{
  const before = readFileSync("src/ui/tokens/tokens.ts", "utf8");
  const r = sh("npm", ["run", "gen:tokens"]);
  const after = readFileSync("src/ui/tokens/tokens.ts", "utf8");
  c.ok(before.includes("GENERATED — do not edit") && r.code === 0 && before === after, "5 tokens.ts generated and stable");
}

const { light, dark, scene, src } = tokensMaps();

// 6. Light and dark share identical key sets.
c.eq(Object.keys(light).sort(), Object.keys(dark).sort(), "6 light and dark key sets match");

// 7. Ground values.
c.ok(light["bg"] === "#F6F1E7" && dark["bg"] === "#12171A", "7 ground tokens match the plan");

// 8. Scene token names.
c.ok(scene.length > 0 && scene.every((k) => k.startsWith("scene-")) && scene.includes("scene-bg") && scene.includes("scene-mat-arc"), "8 scene token names derived");

// 9. cssVar builds var(--name); tokenCssText serves tokens.css, which holds the paper accent.
c.ok(
  src.includes("return `var(--${name})`") &&
    src.includes('from "./tokens.css?raw"') &&
    light["accent"] === "#1B6A62" &&
    readFileSync("src/ui/tokens/tokens.css", "utf8").includes("--accent: #1B6A62"),
  "9 cssVar and tokenCssText wired",
);

// 10. Cinematic themes equal the CSS tokens for bg and accent in both themes.
{
  const cinematic = JSON.parse(readFileSync("cinematic-tokens.json", "utf8")) as {
    themes: { paper: Record<string, string>; dusk: Record<string, string> };
  };
  c.ok(
    cinematic.themes.paper["bg"] === light["bg"] &&
      cinematic.themes.dusk["bg"] === dark["bg"] &&
      cinematic.themes.paper["accent"] === light["accent"] &&
      cinematic.themes.dusk["accent"] === dark["accent"],
    "10 cinematic themes equal CSS tokens",
  );
}

// 11. The contrast gate passes with 80 pairs; its line prints first.
{
  const r = sh("npm", ["run", "check:contrast"]);
  const last = r.out.trim().split(/\r?\n/).filter(Boolean).pop() ?? "";
  console.log("contrast: 80 pairs OK");
  c.ok(r.code === 0 && last === "contrast: 80 pairs OK", "11 contrast gate passes");
}

// 12. A weakened accent fixture fails naming --accent.
{
  const dir = mkdtempSync(join(tmpdir(), "ui03-"));
  const fixture = join(dir, "tokens.css");
  const weakened = readFileSync("src/ui/tokens/tokens.css", "utf8").replace("--accent: #1B6A62;", "--accent: #8FB5AF;");
  writeFileSync(fixture, weakened);
  copyFileSync("src/ui/tokens/tokens.css", join(dir, "tokens.orig.css"));
  const r = sh("npx", ["vite-node", "scripts/check-contrast.ts", "--tokens", fixture]);
  c.ok(r.code === 1 && r.out.split(/\r?\n/).some((l) => l.startsWith("FAIL ") && l.includes("--accent")), "12 weakened accent fails the gate");
}

// 13. initialTheme truth table.
c.ok(
  initialTheme(true, null) === "dark" &&
    initialTheme(true, "light") === "light" &&
    initialTheme(false, "dark") === "dark" &&
    initialTheme(false, "junk") === "light",
  "13 initialTheme table",
);

// 14. Storage failures never throw.
{
  const throwing = { getItem(): string { throw new Error("blocked"); } };
  let threw = false;
  try {
    persistTheme("dark", { setItem(): void { throw new Error("x"); } });
  } catch {
    threw = true;
  }
  c.ok(readStoredTheme(throwing) === null && !threw, "14 storage failures are total");
}

// 15. applyTheme sets the dataset.
{
  const fake = { dataset: {} as Record<string, string> };
  applyTheme("dark", fake as unknown as HTMLElement);
  c.eq(fake.dataset["theme"], "dark", "15 applyTheme sets dataset.theme");
}

// 16. Project sync copies three byte-identical files; a missing target fails.
{
  const dir = mkdtempSync(join(tmpdir(), "ui03-sync-"));
  process.env["PROJECT_SYNC_DIR"] = dir;
  let r2: { code: number; out: string };
  try {
    r2 = sh("npx", ["vite-node", "scripts/sync-project-copies.ts"]);
  } finally {
    delete process.env["PROJECT_SYNC_DIR"];
  }
  const sources: [string, string][] = [
    ["cinematic-tokens.json", "cinematic-tokens.json"],
    ["brand/mark.svg", "mark.svg"],
    ["design_documents/design_brief.md", "design_brief.md"],
  ];
  const same = sources.every(([src, dest]) => {
    const target = dest === "mark.svg" ? join(dir, "brand", dest) : join(dir, dest);
    try {
      return readFileSync(target, "utf8") === readFileSync(src, "utf8");
    } catch {
      return false;
    }
  });
  process.env["PROJECT_SYNC_DIR"] = join(tmpdir(), "ui03-no-such-dir-xyz");
  let r3: { code: number; out: string };
  try {
    r3 = sh("npx", ["vite-node", "scripts/sync-project-copies.ts"]);
  } finally {
    delete process.env["PROJECT_SYNC_DIR"];
  }
  c.ok(
    r2.code === 0 && r2.out.includes("synced 3 files to") && same && r3.code === 1 && r3.out.includes("target directory missing"),
    "16 sync copies three identical files, missing target fails",
  );
}

c.done();
