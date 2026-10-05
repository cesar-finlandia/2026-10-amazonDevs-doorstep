// Requirement IDs: FR-06, FR-18
// Renders engine/schema/*.json from the zod sources. --check exits non-zero
// when a committed file differs from a fresh render.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { ExtractorOutputSchema, NarrationSchema, ReviewPlanSchema } from "src/agent/schemas.js";

const TARGETS: { name: string; file: string; schema: z.ZodTypeAny }[] = [
  { name: "extractor-output", file: "extractor-output.schema.json", schema: ExtractorOutputSchema },
  { name: "review-plan", file: "review-plan.schema.json", schema: ReviewPlanSchema },
  { name: "narration", file: "narration.schema.json", schema: NarrationSchema },
];

function render(schema: z.ZodTypeAny): string {
  return JSON.stringify(z.toJSONSchema(schema), null, 2) + "\n";
}

function main(): void {
  const check = process.argv.includes("--check");
  const dir = join(process.cwd(), "engine", "schema");
  let failed = false;
  for (const t of TARGETS) {
    const fresh = render(t.schema);
    const path = join(dir, t.file);
    if (check) {
      let committed = "";
      try {
        committed = readFileSync(path, "utf8");
      } catch {
        committed = "";
      }
      if (committed !== fresh) {
        console.error(`schema drift: ${t.file} differs from src/agent/schemas.ts; run scripts/gen-schemas.ts`);
        failed = true;
      }
    } else {
      mkdirSync(dir, { recursive: true });
      writeFileSync(path, fresh, "utf8");
      console.log(`schema: wrote ${t.file}`);
    }
  }
  if (check) {
    if (failed) process.exit(1);
    console.log("schemas: all 3 match the zod source");
  }
}

main();
