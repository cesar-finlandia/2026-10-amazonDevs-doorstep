// scripts/sync-project-copies.ts — copies the brandmark, cinematic tokens and brief
// into the chassis project directory (DP-UI WU-UI-03).
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";

const files: [string, string][] = [
  ["cinematic-tokens.json", "cinematic-tokens.json"],
  ["brand/mark.svg", "mark.svg"],
  ["design_documents/design_brief.md", "design_brief.md"],
];

const target = process.env["PROJECT_SYNC_DIR"] ?? join(process.cwd(), "..", "..", "hackathons", "hackathon-projects", "2026-10-amazonDevs");
const resolved = resolve(target);
const forbidden = resolve(join(process.cwd(), "..", "..", "hackathons", "src"));
if (resolved === forbidden || resolved.startsWith(forbidden + "/")) {
  console.error("target directory missing");
  process.exit(1);
}
if (!existsSync(resolved)) {
  console.error("target directory missing");
  process.exit(1);
}
mkdirSync(join(resolved, "brand"), { recursive: true });
let n = 0;
for (const [src, dest] of files) {
  const out = dest === "mark.svg" ? join(resolved, "brand", dest) : join(resolved, dest);
  copyFileSync(join(process.cwd(), src), out);
  n += 1;
}
console.log(`synced ${n} files to ${resolved}`);
