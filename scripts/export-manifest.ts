// Requirement IDs: FR-05
// Exports actions.manifest.json from a demo-seed session. --check fails when
// the committed file differs (ignoring the generated_at timestamp).
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { stableStringify } from "src/kits/agent-workflow/src/registry/manifest.js";
import { createBundleRingPort } from "src/domain/bundle-ring-port.js";
import { demoSeed } from "src/domain/seed.js";
import { createAppSession } from "src/agent/app-session.js";

function build(): Record<string, unknown> {
  const session = createAppSession({ initial: demoSeed(), ring: createBundleRingPort() });
  const base = session.registry.exportManifest() as unknown as Record<string, unknown>;
  const actions = session.registry.list().map((d) => ({
    name: d.name,
    title: d.title,
    group: d.group,
    description: d.description,
    input_schema: d.inputSchema,
    annotations: { ...d.annotations },
    dynamic: d.dynamicWhile !== undefined,
  }));
  return { ...base, actions };
}

function main(): void {
  const check = process.argv.includes("--check");
  const manifest = build();
  const actions = manifest["actions"] as unknown[];
  const hash = String((manifest as { contract_hash: string }).contract_hash);
  const line = `manifest: ${actions.length} actions, hash ${hash.slice(0, 12)}`;
  const path = join(process.cwd(), "actions.manifest.json");
  if (check) {
    let committed = "";
    try {
      committed = readFileSync(path, "utf8");
    } catch {
      console.error("manifest: no committed actions.manifest.json; run scripts/export-manifest.ts");
      process.exit(1);
    }
    const strip = (m: Record<string, unknown>): string => {
      const copy = { ...(JSON.parse(JSON.stringify(m)) as Record<string, unknown>) };
      delete copy["generated_at"];
      return stableStringify(copy);
    };
    if (strip(JSON.parse(committed) as Record<string, unknown>) !== strip(manifest)) {
      console.error("manifest: committed actions.manifest.json differs; run scripts/export-manifest.ts");
      process.exit(1);
    }
    console.log(line);
    return;
  }
  writeFileSync(path, JSON.stringify(manifest, null, 2) + "\n", "utf8");
  console.log(line);
}

main();
