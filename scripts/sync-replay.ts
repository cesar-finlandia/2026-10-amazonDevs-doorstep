// scripts/sync-replay.ts — DP-SHOWCASE WU-03 (§3.4).
// Copies data/replay/run-trace.json unchanged to public/replay/run-trace.json.
import { copyFileSync, mkdirSync, readFileSync } from "node:fs";

const src = "data/replay/run-trace.json";
const dst = "public/replay/run-trace.json";
const raw = readFileSync(src, "utf8");
const parsed = JSON.parse(raw) as { entries?: unknown[] };
mkdirSync("public/replay", { recursive: true });
copyFileSync(src, dst);
console.log(`replay: synced ${(parsed.entries ?? []).length} entries`);
