// scripts/gen-tokens-ts.ts — generates src/ui/tokens/tokens.ts from tokens.css (DP-UI WU-UI-03).
import { readFileSync, writeFileSync } from "node:fs";

const SRC = "src/ui/tokens/tokens.css";
const OUT = "src/ui/tokens/tokens.ts";

function parseBlocks(text: string): { light: Record<string, string>; dark: Record<string, string> } {
  const blocks = [...text.matchAll(/^(?::root|\[data-theme="dark"\])\s*\{([\s\S]*?)^\}/gm)].map((m) => ({
    head: m[0].startsWith(":root") ? "root" : "dark",
    body: m[1] as string,
  }));
  const roots = blocks.filter((b) => b.head === "root");
  // The second top-level :root block is the light theme (the first holds type/space/motion).
  const lightSrc = roots[1]?.body ?? "";
  const darkSrc = blocks.find((b) => b.head === "dark")?.body ?? "";
  const decls = (src: string): Record<string, string> => {
    const out: Record<string, string> = {};
    for (const m of src.matchAll(/--([a-z0-9-]+)\s*:\s*([^;]+);/g)) {
      out[m[1] as string] = (m[2] as string).trim();
    }
    return out;
  };
  return { light: decls(lightSrc), dark: decls(darkSrc) };
}

const css = readFileSync(SRC, "utf8");
const { light, dark } = parseBlocks(css);
const sceneTokenNames = Object.keys(light).filter((k) => k.startsWith("scene-")).sort();
const lightSorted: Record<string, string> = {};
for (const k of Object.keys(light).sort()) lightSorted[k] = light[k] as string;
const darkSorted: Record<string, string> = {};
for (const k of Object.keys(dark).sort()) darkSorted[k] = dark[k] as string;

const out = `// GENERATED — do not edit. Written by scripts/gen-tokens-ts.ts from tokens.css.
// Requirement IDs: FR-19, NFR-05
import css from "./tokens.css?raw";

export type ThemeName = "light" | "dark";
export const tokens: { light: Record<string, string>; dark: Record<string, string> } = ${JSON.stringify({ light: lightSorted, dark: darkSorted }, null, 2)};
export const sceneTokenNames: string[] = ${JSON.stringify(sceneTokenNames)};
export function cssVar(name: string): string {
  return \`var(--\${name})\`;
}
export function tokenCssText(): string {
  return css;
}
`;
writeFileSync(OUT, out);
console.log(`wrote ${OUT} (${Object.keys(lightSorted).length} light, ${Object.keys(darkSorted).length} dark tokens)`);
