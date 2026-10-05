// Writes data/bundle/doorstep-14d.json (committed): the deterministic demo bundle.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { buildBundle } from "src/domain/generator.js";

const out = new URL("../data/bundle/doorstep-14d.json", import.meta.url);
mkdirSync(dirname(fileURLToPath(out)), { recursive: true });
writeFileSync(out, `${JSON.stringify(buildBundle(), null, 2)}\n`, "utf8");
console.log(`wrote ${fileURLToPath(out)}`);
