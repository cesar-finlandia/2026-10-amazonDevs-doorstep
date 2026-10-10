// scripts/chassis-tool.ts — DP-SUBMISSION runner for chassis tools (§3.6).
// Usage: npx vite-node scripts/chassis-tool.ts <provo|submit|deckgen> -- <args>
import { chassisToolPath, runChassisTool } from "./lib/submission.js";
import { existsSync } from "node:fs";

const tool = process.argv[2] as "provo" | "submit" | "deckgen" | undefined;
// NOTE: Windows PowerShell strips a bare `--` before it reaches node, so the
// separator may or may not be present. Take everything after the tool name.
const raw = process.argv.slice(2);
const ti = raw.findIndex((a) => a === "provo" || a === "submit" || a === "deckgen");
const rest = ti === -1 ? [] : raw.slice(ti + 1);
const args = rest[0] === "--" ? rest.slice(1) : rest;
if (tool !== "provo" && tool !== "submit" && tool !== "deckgen") {
  console.error("usage: npx vite-node scripts/chassis-tool.ts <provo|submit|deckgen> -- <args>");
  process.exit(1);
}
const path = chassisToolPath(tool);
if (!existsSync(path)) {
  console.log(`BLOCKED (chassis tool not found: ${path})`);
  process.exit(3);
}
const r = runChassisTool(tool, args);
process.stdout.write(r.stdout);
process.stderr.write(r.stderr);
process.exit(r.status);
