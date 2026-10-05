// Requirement IDs: FR-06, FR-18
// WU-AGENT-WORKFLOW-03: schemas, literal prompts, generated JSON Schemas (offline).
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ExtractorOutputSchema, NarrationSchema, ReviewPlanSchema } from "src/agent/schemas.js";
import { bannedHits } from "src/llm/guard.js";
import { ACT_GOAL, ACTOR_PROCEDURES, ACTOR_PROMPT, CHECKPOINT_GOAL, REPAIR_GOAL } from "src/prompts/actor.js";
import { EXTRACTOR_PROMPT } from "src/prompts/extractor.js";
import { PROMPT_VERSION } from "src/prompts/index.js";
import { NARRATOR_PROMPT } from "src/prompts/narrator.js";
import { PLANNER_PROMPT } from "src/prompts/planner.js";

function assert(cond: unknown, message: string): void {
  if (!cond) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

const goodEvent = {
  rawId: "evt:req-1",
  deviceId: "dev-door",
  componentId: 0,
  type: "motion_detected",
  subType: null,
  tsMs: 1791000000000,
  requestId: "req-1",
};
assert(
  ExtractorOutputSchema.safeParse({ events: [goodEvent], skipped: [] }).success,
  "extractor accepts one valid event with subType null",
);
assert(
  !ExtractorOutputSchema.safeParse({ events: [{ ...goodEvent, type: "doorbell" }], skipped: [] }).success,
  "extractor rejects type doorbell",
);
assert(
  !ExtractorOutputSchema.safeParse({ events: [{ ...goodEvent, componentId: -1 }], skipped: [] }).success,
  "extractor rejects componentId -1",
);

const step = (order: number) => ({
  order,
  goal: "Read the record and reconcile every device cleanly.",
  actions: ["list_week_events"],
  why: "The household counts need a fresh read before any change.",
});
assert(
  ReviewPlanSchema.safeParse({ steps: [step(1), step(2), step(3), step(4)], focusDays: [8], watchFor: ["late visits"] }).success,
  "planner accepts a 4-step plan",
);
assert(
  !ReviewPlanSchema.safeParse({ steps: [step(1), step(2)], focusDays: [], watchFor: [] }).success,
  "planner rejects a 2-step plan",
);
assert(
  !ReviewPlanSchema.safeParse({ steps: [step(1), step(2), step(3)], focusDays: [6], watchFor: [] }).success,
  "planner rejects focusDays [6]",
);

const goodNarration = {
  incidentId: "inc-1",
  title: "Door activity late at night",
  explanation: "There was door activity at 02:14 on Tue 13 Oct, during quiet hours.",
  tone: "calm",
  suggestedNudge: null,
};
assert(
  !NarrationSchema.safeParse({ ...goodNarration, explanation: "x".repeat(321) }).success,
  "narrator rejects a 321-character explanation",
);
assert(
  !NarrationSchema.safeParse({ ...goodNarration, tone: "alarm" }).success,
  "narrator rejects tone alarm",
);

const check = spawnSync("npx", ["vite-node", "scripts/gen-schemas.ts", "--check"], {
  cwd: process.cwd(),
  shell: true,
  encoding: "utf8",
});
assert(check.status === 0, "gen-schemas --check exits 0");
for (const f of ["extractor-output.schema.json", "review-plan.schema.json", "narration.schema.json"]) {
  const parsed = JSON.parse(readFileSync(join(process.cwd(), "engine", "schema", f), "utf8")) as {
    $schema?: string;
    type?: string;
  };
  assert(parsed.$schema !== undefined && parsed.$schema.includes("2020-12") && parsed.type === "object", `${f} is a 2020-12 object schema`);
}

assert(PROMPT_VERSION === "doorstep-prompts-1", "prompt version matches");
for (const [name, p] of [["extractor", EXTRACTOR_PROMPT], ["planner", PLANNER_PROMPT], ["narrator", NARRATOR_PROMPT], ["actor", ACTOR_PROMPT]] as const) {
  assert(p.length > 0 && bannedHits(p).length === 0, `prompt ${name} is non-empty and banned-word free`);
}
assert(
  ACTOR_PROCEDURES.length === 3 &&
    ACTOR_PROCEDURES[0]?.name === "review_week" && (ACTOR_PROCEDURES[0]?.steps.length ?? 0) === 6 &&
    ACTOR_PROCEDURES[1]?.name === "repair_errors" && (ACTOR_PROCEDURES[1]?.steps.length ?? 0) === 3 &&
    ACTOR_PROCEDURES[2]?.name === "prepare_family_update" && (ACTOR_PROCEDURES[2]?.steps.length ?? 0) === 4,
  "actor procedures have 6, 3 and 4 steps",
);
assert(
  ACT_GOAL("PLAN").includes("PLAN") && REPAIR_GOAL.includes("check_week_model") && CHECKPOINT_GOAL("Dana").includes("Dana"),
  "goal builders interpolate their arguments",
);

console.log("aw-03-schemas: 14 checks OK");
