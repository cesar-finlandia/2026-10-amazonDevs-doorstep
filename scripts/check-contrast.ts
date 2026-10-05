// scripts/check-contrast.ts — asserts the §5.2 contrast table against a tokens file (DP-UI WU-UI-03).
// Usage: npx vite-node scripts/check-contrast.ts [--tokens <file.css>]
import { readFileSync } from "node:fs";
import { contrast } from "./lib/color.js";
import { planTable } from "./verify/ui-kit.js";

function tokensOf(path: string): { light: Record<string, string>; dark: Record<string, string> } {
  const text = readFileSync(path, "utf8");
  const blocks = [...text.matchAll(/^(?::root|\[data-theme="dark"\])\s*\{([\s\S]*?)^\}/gm)].map((m) => ({
    head: m[0].startsWith(":root") ? "root" : "dark",
    body: m[1] as string,
  }));
  const roots = blocks.filter((b) => b.head === "root");
  const decls = (src: string): Record<string, string> => {
    const out: Record<string, string> = {};
    for (const m of src.matchAll(/--([a-z0-9-]+)\s*:\s*([^;]+);/g)) out[m[1] as string] = (m[2] as string).trim();
    return out;
  };
  return { light: decls(roots[1]?.body ?? ""), dark: decls(blocks.find((b) => b.head === "dark")?.body ?? "") };
}

const flagAt = process.argv.indexOf("--tokens");
const file = flagAt >= 0 ? (process.argv[flagAt + 1] as string) : "src/ui/tokens/tokens.css";
const { light, dark } = tokensOf(file);
const rows = planTable("Pair (text on surface)");
let problems = 0;
let n = 0;
for (const row of rows) {
  const pair = row[0] as string;
  const need = parseFloat((row[1] as string).split(":")[0] as string);
  const want = { light: parseFloat(row[2] as string), dark: parseFloat(row[3] as string) };
  const m = /--([a-z0-9-]+)\s+on\s+--([a-z0-9-]+)/.exec(pair);
  if (!m) {
    console.log(`FAIL ${pair} light unparseable`);
    problems += 1;
    continue;
  }
  const fg = m[1] as string;
  const bg = m[2] as string;
  for (const theme of ["light", "dark"] as const) {
    n += 1;
    const map = theme === "light" ? light : dark;
    const a = map[fg];
    const b = map[bg];
    if (a === undefined || b === undefined) {
      console.log(`FAIL ${pair} ${theme} missing token`);
      problems += 1;
      continue;
    }
    const ratio = Math.round(contrast(a, b) * 100) / 100;
    const expected = want[theme];
    if (!(ratio >= need) || Math.abs(ratio - expected) > 0.010001) {
      console.log(`FAIL ${pair} ${theme} ${ratio} (needs ${need}, table ${expected})`);
      problems += 1;
    }
  }
}
if (problems > 0) {
  console.log(`contrast: ${problems} of ${n} pairs FAILED`);
  process.exit(1);
}
console.log(`contrast: ${n} pairs OK`);
