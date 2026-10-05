// scripts/verify/3d-02-tokens.ts — DP-3D WU-3D-02 (12 checks).
// Pure Node: reads src/ui/tokens/tokens.ts, src/ui/tokens/tokens.css and the
// src/3d sources. No browser.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tokens as uiTokens, sceneTokenNames } from "src/ui/tokens/tokens.js";
import { MATERIAL_TOKENS } from "src/3d/adapter.js";
import { LOOK } from "src/3d/look.js";
import { __resetTokenWarningsForTests, tokensFromRecord } from "src/3d/tokens.js";
import { demoSeed } from "src/domain/seed.js";
import { toSceneDescription } from "src/3d/adapter.js";
import { contrast } from "../lib/color.js";
import { createChecker } from "./ui-kit.js";

const c = createChecker("3d-02-tokens");

// 1. The material token table.
{
  c.eq([...MATERIAL_TOKENS], [
    "wall", "door", "stoop", "frustum", "pillar", "pillar-warn",
    "pillar-danger", "pillar-dup", "gap", "resolved", "arc",
  ], "1 MATERIAL_TOKENS in order");
}

// 2. Both themes carry the four scene keys and the eleven material keys.
{
  const names = ["scene-bg", "scene-ground", "scene-accent", "scene-text",
    ...MATERIAL_TOKENS.map((t) => `scene-mat-${t}`)];
  c.ok(
    (["light", "dark"] as const).every((theme) =>
      names.every((k) => typeof uiTokens[theme][k] === "string" && sceneTokenNames.includes(k)),
    ),
    "2 scene keys exist in both themes and are listed in sceneTokenNames",
  );
}

// 3. The scene palette lives in the same CSS block as the brand tokens.
{
  const css = readFileSync("src/ui/tokens/tokens.css", "utf8");
  const rootBlocks: string[] = [];
  const re = /(^|\n):root\s*\{([^}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(css)) !== null) rootBlocks.push(m[2] as string);
  const dark = /\[data-theme="dark"\]\s*\{([^}]*)\}/.exec(css)?.[1] ?? "";
  c.ok(
    rootBlocks.length >= 2 &&
      (rootBlocks[1] as string).includes("--scene-bg") &&
      (rootBlocks[1] as string).includes("--accent") &&
      dark.includes("--scene-bg") &&
      dark.includes("--accent"),
    "3 second :root and dark blocks carry the scene palette with the brand tokens",
  );
}

// 4. The four base colours, both themes.
{
  const light = tokensFromRecord(uiTokens.light);
  const dark = tokensFromRecord(uiTokens.dark);
  c.ok(
    light.background === "#EBE4D3" && light.ground === "#D8CDB6" &&
      light.accent === "#1B6A62" && light.text === "#221D16" &&
      dark.background === "#0C1012" && dark.ground === "#2A343A" &&
      dark.accent === "#5CC0B3" && dark.text === "#EFE9DC",
    "4 base colours match the specified values in both themes",
  );
}

// 5. Eleven materials straight from the record, both themes.
{
  c.ok(
    (["light", "dark"] as const).every((theme) => {
      const t = tokensFromRecord(uiTokens[theme]);
      return MATERIAL_TOKENS.every((k) => Object.keys(t.materials).length === 11 && t.materials[k] === uiTokens[theme][`scene-mat-${k}`]);
    }),
    "5 materials map one to one from the record",
  );
}

// 6. A missing key falls back to accent and warns exactly once.
{
  const record = { ...uiTokens.light };
  delete record["scene-mat-arc"];
  const seen: string[] = [];
  const orig = console.warn;
  console.warn = (msg: string): void => {
    seen.push(String(msg));
  };
  try {
    __resetTokenWarningsForTests();
    const first = tokensFromRecord(record);
    const second = tokensFromRecord(record);
    c.ok(first.materials["arc"] === record["accent"] && second.materials["arc"] === record["accent"] && seen.length === 1, "6 missing key falls back to accent with one warning");
  } finally {
    console.warn = orig;
  }
}

// 7. LOOK equals §5.2 value for value, every number in [0, 1].
{
  const want: Record<string, { roughness: number; metalness: number }> = {
    wall: { roughness: 0.9, metalness: 0.0 },
    door: { roughness: 0.55, metalness: 0.1 },
    stoop: { roughness: 0.85, metalness: 0.0 },
    frustum: { roughness: 0.2, metalness: 0.0 },
    pillar: { roughness: 0.7, metalness: 0.05 },
    "pillar-warn": { roughness: 0.5, metalness: 0.05 },
    "pillar-danger": { roughness: 0.5, metalness: 0.05 },
    "pillar-dup": { roughness: 0.6, metalness: 0.05 },
    gap: { roughness: 0.9, metalness: 0.0 },
    resolved: { roughness: 0.5, metalness: 0.05 },
    arc: { roughness: 0.35, metalness: 0.1 },
  };
  c.ok(
    JSON.stringify(LOOK) === JSON.stringify(want) &&
      Object.values(LOOK).every((v) => v.roughness >= 0 && v.roughness <= 1 && v.metalness >= 0 && v.metalness <= 1),
    "7 LOOK matches the specified table within range",
  );
}

// 8. Every demo entity carries its token's roughness and metalness.
{
  c.ok(
    toSceneDescription(demoSeed()).entities.every((e) => {
      const token = (e.material as { token: keyof typeof LOOK }).token;
      const mat = e.material as { roughness?: number; metalness?: number };
      return mat.roughness === LOOK[token].roughness && mat.metalness === LOOK[token].metalness;
    }),
    "8 entities carry their token roughness and metalness",
  );
}

// 9. The six signal colours are pairwise different, per theme.
{
  const keys = ["pillar", "pillar-warn", "pillar-danger", "pillar-dup", "resolved", "arc"];
  c.ok(
    (["light", "dark"] as const).every((theme) => {
      const vals = keys.map((k) => tokensFromRecord(uiTokens[theme]).materials[k]);
      return new Set(vals).size === vals.length;
    }),
    "9 signal colours pairwise different in both themes",
  );
}

// 10. Those six keep contrast >= 3 against the ground, per theme.
{
  const keys = ["pillar", "pillar-warn", "pillar-danger", "pillar-dup", "resolved", "arc"];
  const worst = (["light", "dark"] as const).map((theme) => {
    const t = tokensFromRecord(uiTokens[theme]);
    return Math.min(...keys.map((k) => contrast(t.materials[k] as string, t.ground)));
  });
  c.ok(worst.every((v) => v >= 3), `10 signal colours contrast >= 3 vs ground (worst ${worst.map((v) => v.toFixed(2)).join(", ")})`);
}

// 11. No colour literal anywhere under src/3d/ (comments removed).
{
  const files: string[] = [];
  const walk = (dir: string): void => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.(ts|tsx)$/.test(e.name)) files.push(p);
    }
  };
  walk("src/3d");
  const offenders = files.filter((f) => {
    const text = readFileSync(f, "utf8").replace(/\/\/[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
    return /#[0-9a-fA-F]{8}(?![0-9a-fA-F])|#[0-9a-fA-F]{6}(?![0-9a-fA-F])|#[0-9a-fA-F]{4}(?![0-9a-fA-F])|#[0-9a-fA-F]{3}(?![0-9a-fA-F])/.test(text);
  });
  c.ok(offenders.length === 0, `11 no colour literals under src/3d (${offenders.join(", ")})`);
}

// 12. src/3d imports from src/ui/ only for the token record.
{
  const files: string[] = [];
  const walk = (dir: string): void => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.(ts|tsx)$/.test(e.name)) files.push(p);
    }
  };
  walk("src/3d");
  const offenders = files.filter((f) => {
    const text = readFileSync(f, "utf8");
    const imports = [...text.matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1] as string);
    return imports.some((i) => i.startsWith("src/ui/") && i !== "src/ui/tokens/tokens.js");
  });
  c.ok(offenders.length === 0, `12 src/3d reads only the token record from src/ui (${offenders.join(", ")})`);
}

c.done();
