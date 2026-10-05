// Requirement IDs: NFR-08
// Generates config/banned-patterns.json from the chassis banned-words list,
// keeping only entries with no `presets` field or with "ui" among presets.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

interface ChassisEntry {
  id: string;
  pattern: string;
  examples?: string[];
  presets?: string[];
}

function main(): void {
  const root = process.cwd();
  const chassisPath = join(root, "..", "..", "hackathons", "templates", "banned-words.json");
  const raw = JSON.parse(readFileSync(chassisPath, "utf8")) as { version: string; entries: ChassisEntry[] };
  const patterns = raw.entries
    .filter((e) => !e.presets || e.presets.includes("ui"))
    .map((e) => ({ id: e.id, pattern: e.pattern, flags: "i" }));
  const out = { version: raw.version, syncedFrom: "banned-words.json", patterns };
  mkdirSync(join(root, "config"), { recursive: true });
  writeFileSync(join(root, "config", "banned-patterns.json"), JSON.stringify(out, null, 2) + "\n", "utf8");
  console.log(`banned-patterns: ${patterns.length} patterns, version ${raw.version}`);
}

main();
