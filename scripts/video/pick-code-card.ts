// scripts/video/pick-code-card.ts — DP-SCRIPT WU-05 step 1.
// Usage: npx vite-node scripts/video/pick-code-card.ts "<regex>" <file>
// Finds the lines of <file> matching <regex> and prints the card window:
// `code: <file> <from>-<to>`. The window is the span covering every match,
// expanded forward to at most 12 lines from the first match; when the matches
// span more than 12 lines it exits 1 (narrow the regex). All printed lines
// are real lines of the file.
import { readFileSync } from "node:fs";

const [regexSrc, file] = process.argv.slice(2);
if (!regexSrc || !file) {
  console.error("usage: pick-code-card.ts \"<regex>\" <file>");
  process.exit(2);
}
const lines = readFileSync(file, "utf8").split("\n");
const re = new RegExp(regexSrc);
const hits: number[] = [];
lines.forEach((ln, i) => { if (re.test(ln)) hits.push(i + 1); });
if (hits.length === 0) {
  console.error(`code: no lines of ${file} match ${regexSrc}`);
  process.exit(1);
}
const from = hits[0] as number;
const last = hits[hits.length - 1] as number;
if (last - from + 1 > 12) {
  console.error(`code: matches span ${last - from + 1} lines (over the 12-line card); narrow the regex`);
  process.exit(1);
}
const to = Math.min(from + 11, lines.length);
console.log(`code: ${file} ${from}-${to}`);
