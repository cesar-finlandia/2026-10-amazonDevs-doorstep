# DP-AGENT-WORKFLOW — Bedrock roles, prompts, 20-action registry, orchestrator and transports

> Plan 2 of 12. Owner of: model discovery, the Bedrock client, the cost and guard wrappers, the four model roles with their literal prompts and schemas, the 20 registered agent actions, the week-review orchestrator, the agent transports (in-process, golden replay), `createAppSession`, the golden cache recording and the trace-floor validator.
> Chassis paths are written `../../hackathons/…`. All imports use the `src/…` alias; every verification command runs under `vite-node`. Node ≥ 22 is required (the Strands SDK's engine range).

## §0 Context & blockers

**Must already exist before WU-01 runs** (all produced by DP-DOMAIN-ENGINE): `src/domain/{types,time,ring-port,parse,generator,bundle-ring-port,derive,gaps,actions,store,seed,rules,session}.ts`, `data/bundle/doorstep-14d.json`, `src/kits/agent-workflow/**`, `scripts/verify/ring-port-contract.ts`. Proof that they exist and work:

```bash
npx vite-node scripts/verify/de-09-session.ts
```
Expected: `de-09-session: 12 checks OK`. If it does not print that line, stop: the domain plan is not finished.

**Preflight (each line must print a path):**
```bash
ls -d src/resilience src/context src/cost scripts/verify/ring-port-contract.ts ../../hackathons/templates/banned-words.json config
node --version
python3 --version
```
`node --version` must print v22 or newer.

**AWS access for the live units (WU-01 probe, WU-09 recording).** The product runtime is Amazon Bedrock (blueprint FR-18). Credentials are read from the environment only: `AWS_BEARER_TOKEN_BEDROCK`, or the AWS default credential chain; the region from `AWS_REGION`. Values are never written to any file or plan. Units that need no credentials are marked **[offline]** (they inject a stub for the Bedrock `send` function). Units marked **[live]** need Bedrock; when Bedrock is unreachable, quote the named error from the probe and run the same unit against the labelled Vertex fallback below, and record `provider: "vertex-fallback"` in the golden cache metadata. A recording made through the fallback is shown to viewers with that label; it is never presented as Bedrock.

**Vendor-name guard check (AI ACCESS SPEC §2A).** The brief carries no list of forbidden vendor names, so §2A does not apply and the full AI ACCESS rule below stands.

> **Verbatim contract — AI ACCESS SPEC (§1,§2).** Reproduced unchanged from the engine-building prompt; where it names a path, the path is as written there.

##### §1 The rule

Any plan, work unit or test that needs a live model call MUST attempt the Vertex path before declaring
AI unavailable. A plan may only report "AI unavailable" after §2 has been run and has failed with a
named error, and it must then quote that error.

##### §2 How to reach Gemini — run these, do not describe them

1. Confirm Application Default Credentials:
   `gcloud auth application-default print-access-token`
   A token means you are authenticated. If it fails, run
   `gcloud auth application-default login`.
2. Use the default project unless the operator names another:
   `GOOGLE_CLOUD_PROJECT=2026-09-agentic-cinema1`.
   Set the environment for the call (these three, not an API key):
   - `GOOGLE_GENAI_USE_VERTEXAI=true`
   - `GOOGLE_CLOUD_PROJECT=2026-09-agentic-cinema1`
   - `GOOGLE_CLOUD_LOCATION=<region, e.g. us-central1>` — and `GOOGLE_VERTEX_LOCATION=global` for
     models published in the global endpoint.
   Only ask the operator for a project id when this default fails with permission or
   not-found. Never invent a project id.
3. Confirm the API is enabled:
   `gcloud services list --enabled --filter="name:aiplatform.googleapis.com"`
4. **Discover the model, do not hardcode a version.** List the models visible to the project and pick a
   current Gemini model of the needed capability (text, or image-capable for slide graphics). Record the
   exact model name and region wherever the plan records reproducibility facts.
5. In deployed environments there is still no API key: the Cloud Run (or equivalent) service account
   carries `roles/aiplatform.user` and the same `GOOGLE_GENAI_USE_VERTEXAI=true` env var.
**How this plan uses the rule above.** Bedrock is the product runtime. Gemini via Vertex is used (a) as the labelled fallback rung of the degraded ladder (`AGENT_PROVIDER=vertex` with `AGENT_ALLOW_FALLBACK=1`), through the kit's `createVertexClient`, and (b) for build/test tooling elsewhere. The model id of either provider is discovered at runtime (`discoverModels` here; the kit's `pickModel` for Vertex) and never typed into a file.

## §1 Purpose & requirement IDs

Make the product an agent, not a chat box. Requirements (blueprint §1): **FR-05** (20 typed actions plus `get_capabilities`, each passing `lintDescriptor`), **FR-06** (multi-round workflow: extractor ×2 → planner ×1 → actor act → verify → repair → narrator ×3 → checkpoint; ≥ 4 roles, ≥ 15 model entries, ≥ 1 verify→repair round to zero errors, ≥ 1 human checkpoint), **FR-07** (consent and approval boundaries), **FR-08** (manual runner field helper), **FR-09** (trace, `window.__runTrace`), **FR-12** (`reconcile_webhook_gap`), **FR-15** (chime preflight), **FR-18** (Bedrock + Strands + Converse, discovery, `withResilience`, `fit`, cost), **FR-21** (degraded ladder), **NFR-03, NFR-08, NFR-14**.

> **Verbatim contract — PRODUCT DEPTH SPEC (§2,§3,§5).** Reproduced unchanged from the engine-building prompt; where it names a path, the path is as written there.

##### §2 The agent call graph (where model calls come from)

The plan's `### Agentic Workflow & Call Graph` (inside `## AI Solution`) is a table with one row per
stage:

| Column | Meaning |
|---|---|
| Stage | e.g. Perceive, Plan, Act, Verify, Repair, Explain, Critique |
| Role | Which model role runs it (planner, extractor, actor, critic, narrator), or "deterministic" |
| Model / source | The mandated model when the brief mandates one. Otherwise the default LLM per the AI ACCESS SPEC (Gemini via Vertex). Or "external agent" when the mandated technology lets the user's own agent drive the app (§2B). |
| Input → Output | Typed, naming the domain-model entities read and written |
| Rounds / fan-out | How many times it runs in the core demo and why (per item, per round, parallel batch) |
| Stop condition | When the loop ends (truth engine reports 0 errors; human approves; budget hit) |
| Visible as | What the judge sees on screen while it runs |

Rules:

- **Floors for the core demo run (one judge-visible session):** ≥ 3 distinct model roles; ≥ 1
  verify → repair round; ≥ 1 human checkpoint; ≥ 1 multimodal step (vision, audio or document
  understanding) when the mandated model supports it and the input is not plain text. Typical
  totals are **15–80 model calls per core run**. Calls may be parallel. The plan states the expected
  total with its arithmetic, e.g. "1 perceive + 1 plan + 12 act + 2 verify + 1 repair × 2 + 1 explain =
  19".
- **No padding.** Every call must change state or a decision, and that change must be recorded in the run trace (§9).
  A call that only rephrases another call's output is padding.
- **Forbidden shape:** *one planner call → deterministic steps → one summary call* as the whole
  product. If the plan reduces to that shape, the idea is too shallow. Return to idea selection, do
  not decorate it.
- **Models interpret, code decides.** Models perceive, plan, generate, critique and explain. Validity,
  arithmetic, rules and permissions belong to deterministic code (the truth engine and the store
  actions). The prompt for each model role is written out in full in the design plan.
- **Structured outputs.** Every model call returns JSON validated against a schema. On failure it
  retries once with the validation errors, then degrades visibly. It never fails silently.

###### §2B When the mandated technology supplies the agent

Some events mandate a technology through which **the user's own external agent** drives the product
(a browser-agent protocol, an MCP server, a plugin surface, an assistant platform). Then:

- The product does **not** embed a competing assistant as its primary path. An embedded assistant
  may exist only as a clearly labelled fallback for judges without the runtime.
- The call graph is written as the **expected agent session**: the sequence of actions a capable agent
  takes for the core demo, with its rounds and verify/repair loops, e.g. "~85 actions: 12 structure +
  14 openings + 10 regions + 34 placements + 3 verify + repairs".
- Depth is then carried by the action surface (§3), the procedures embedded in the action descriptions
  (§3.5) and the truth engine. The floors in §2 apply to the session (≥ 15 actions, ≥ 1 verify →
  repair round, ≥ 1 human checkpoint).

##### §3 Action surface standard (tools, functions, endpoints the agent uses)

1. **Derived from the domain model, not from the demo script.** Group actions as Read, Create/Change,
   Verify, Navigate/View, Collaborate (notes, handoffs), Cross-boundary (another service or origin).
   Every group the domain supports is present.
2. **Descriptor:** `name` as verb_noun; a human `title`; a description of at least two sentences
   stating when to use the action, units, preconditions and one example call. The JSON Schema uses
   `additionalProperties: false`, enums where values are closed, and explicit units. Arguments accept
   human names as well as ids where natural ("the bedroom" as well as `room-3`).
3. **Result:** every result returns `ok`, a one-sentence human `summary`, the structured data, the
   model's `revision` and, for stateful products, `validNextActions` derived from the current state.
4. **Errors are recoverable and actionable.** They say what went wrong and what to call next. An
   invalid, stale, out-of-turn or unconfirmed call never mutates state.
5. **Procedures ride with actions.** A multi-step procedure (onboarding a document, tracing an
   image, playing a turn, reconciling records) is written as a numbered protocol. It lives in the
   description of the action the agent will call first, and a `get_capabilities`-style read action
   also returns it.
6. **Annotations.** Mark read-only actions, actions that handle untrusted content, and destructive
   actions. Destructive actions are enforced by the page or service itself through the approval gate
   in §1.6, never only by a hint.
7. **Dynamic actions** (registered only while a state holds, e.g. "act on the selected item") are used
   when the mandated technology supports registration changes. They show human-points / agent-acts
   collaboration.

##### §5 Human checkpoints standard

- An approval bar shows "AGENT WANTS TO <plain-language action>" with Approve and Reject. The
  agent's call stays pending until a human decides, and abort or timeout releases it.
- A toggle (default ON) controls the gate. The manual runner goes through the same gate.
- Rejection returns `ok:false` and a sentence the agent can act on, and the activity feed logs it.
> **Verbatim contract — HEE KIT AGENT-WORKFLOW SPEC.** Reproduced unchanged from the engine-building prompt; where it names a path, the path is as written there.


<!-- Requirement IDs: HEE-KIT-02 -->

#### SPEC — agent-workflow kit use in entries (DP-DOMAIN-ENGINE and DP-AGENT-WORKFLOW)

> Binding on the entry's `DP-DOMAIN-ENGINE` and `DP-AGENT-WORKFLOW`. The kit
> is vendored read-only under `hee/`; the entry never edits installed kit
> files.

1. Install the kit with `npx vite-node hee/scripts/install-kit.ts agent-workflow --to .`, then run `npm install`.
2. The domain store of `DP-DOMAIN-ENGINE` is built with `createDomainStore`,
   its rules with `createTruthEngine`; UI and agent both call
   `store.dispatch` — the UI buttons and the agent's tools call the same
   functions.
3. Every action of the plan's `### Action Surface` is a registered
   `ActionDescriptor` that passes `lintDescriptor`; the plan's total equals
   `registry.list().length` minus `get_capabilities`.
4. The entry exports `actions.manifest.json` with `registry.exportManifest()`
   in its build and records the `contract_hash`.
5. Destructive actions use the gate: they pause as a visible request with
   Approve / Reject, and a rejection returns a sentence the agent can act on.
6. The activity feed, approval bar and manual runner are mounted in the
   layout and mount at most one of them with the route's single
   `demoFocus` beat id (the others get none).
7. `window.__runTrace` is installed and DP-E2E-BROWSER-TESTING saves
   `run-trace.json` with `saveTraceFromPage`, then runs
   `npx vite-node hee/scripts/hee-validate-run-trace.ts` (vendored in
   `hee/scripts/`) with the floors of `../../hackathons/templates/product-depth.spec.md` §2.
8. When the mandated technology supplies the agent
   (`product-depth.spec.md` §2B) implement `ExternalAgentTransport` for it
   and call `bindRegistryToTransport`; the in-app loop is only the labelled
   fallback.
9. The server route that calls the model uses `handleAgentStep` and
   `createVertexClient` (no key; ADC via `google-auth-library`).
10. Domain prompts are written verbatim in the plan and stored under
    `src/prompts/` of the entry; the kit's `agent-system.md` is the base,
    never edited in place.

## §2 Scope boundaries

**IN — files this plan creates (exactly):**

| Path | What |
|---|---|
| `src/llm/model-discovery.ts` | `discoverModels` |
| `src/llm/bedrock-client.ts` | `createBedrockClient` (Converse mapping, kit `GenerateRequest/Result`) |
| `src/llm/strands-adapter.ts` | `createStrandsAdapter` (lazy Strands `Agent` + `BedrockModel` + `structuredOutputSchema`) |
| `src/llm/vertex-fallback.ts` | `createVertexFallback` (labelled fallback clients over the kit's `createVertexClient`) |
| `src/llm/cost.ts` | `createCostClient` (JSON-lines sidecar client + degraded counter) |
| `scripts/cost_sidecar.py`, `config/cost.json` | sidecar over `src/cost`, budget config |
| `src/llm/guard.ts` | `bannedHits`, `guardCopy` |
| `config/banned-patterns.json`, `scripts/sync-banned-words.ts` | generated list and its generator |
| `src/llm/context.ts` | `fitTurns` (`fit` wrapper for actor turns) |
| `src/llm/roles.ts` | `createRoleRunners` |
| `src/agent/schemas.ts`, `scripts/gen-schemas.ts`, `engine/schema/*.json` | zod schemas and the generated JSON Schemas |
| `src/prompts/{extractor,planner,actor,narrator,index}.ts` | literal prompts and procedures |
| `src/agent/actions.ts`, `src/agent/brief.ts` | the 20 descriptors, preflights, weekly brief text |
| `src/agent/transport.ts` | `AgentTransport`, in-process and golden implementations |
| `src/agent/orchestrator.ts`, `src/agent/floors.ts` | `runWeekReview`, `checkFloors` |
| `src/agent/app-session.ts` | `createAppSession` |
| `scripts/probe-bedrock.ts`, `scripts/probe-strands.ts` | live probes |
| `scripts/run-review.ts`, `scripts/record-golden.ts`, `scripts/export-manifest.ts` | headless run, golden recording, manifest export |
| `data/golden-cache/**`, `actions.manifest.json` | committed golden entries, manifest |
| `scripts/verify/aw-01-bedrock.ts` … `aw-10-floors.ts` | the ten verification scripts |
| `scripts/verify/scripted-transport.ts` | verification-only scripted transport (§5.13), reused by later plans' offline checks |

**Also modified (configuration only):** `package.json` (dependencies), `.gitignore`.

**OUT — owned elsewhere:** the domain model, store, rules, `RingPort`, bundle, session (DP-DOMAIN-ENGINE); Ring HTTP, OAuth, webhooks (DP-RING-INTEGRATION); the Express server, `HttpAgentTransport`, `HttpRingPort`, per-session wiring (DP-API-TRANSPORT); every UI component (DP-UI); the trace save in the browser (`saveTraceFromPage` is exercised by DP-E2E-BROWSER-TESTING).

## §3 Interfaces owned (literal skeletons)

### §3.1 `src/llm/model-discovery.ts`

```ts
// Requirement IDs: FR-18
// Runtime model discovery for Amazon Bedrock. NEVER returns a hardcoded id.
export interface ModelCandidate {
  id: string;                    // invocable id or inference-profile id
  provider: string;              // "Anthropic" | "Amazon" | ...
  name: string;                  // human model name, e.g. "Claude Sonnet 4.5"
  inputModalities: string[]; outputModalities: string[];
  active: boolean;
}
export interface DiscoveredModels { fast: string; balanced: string; source: "discovery" | "env"; region: string }
export interface DiscoveryDeps {
  listCandidates?: () => Promise<ModelCandidate[]>;   // default: Bedrock control plane (see §5.1)
  env?: Record<string, string | undefined>;           // default process.env
}
/** Highest version first within a tier; tier "fast" prefers names containing "Haiku" then "Lite"; "balanced" prefers "Sonnet" then "Pro". */
export function rankCandidates(c: ModelCandidate[], tier: "fast" | "balanced"): string | null;
/** BEDROCK_MODEL_ID (when set) wins for both tiers with source "env". Otherwise lists candidates, ranks, returns
 *  source "discovery". Throws Error("No invocable text model is visible in <region>. Run scripts/probe-bedrock.ts.") when none. */
export function discoverModels(deps?: DiscoveryDeps): Promise<DiscoveredModels>;
```

### §3.2 `src/llm/bedrock-client.ts`

```ts
// Requirement IDs: FR-18
import type { GenerateRequest, GenerateResult } from "src/kits/agent-workflow/src/llm/types.js";
export interface BedrockClientOptions {
  modelId: string; region?: string;                  // region default process.env.AWS_REGION
  maxTokens?: number;                                // default 2048
  send?: (command: unknown) => Promise<unknown>;     // test seam; default BedrockRuntimeClient#send
  now?: () => number;
}
export interface BedrockClient { readonly modelId: string; readonly region: string; generate(req: GenerateRequest): Promise<GenerateResult> }
/** Pure mapping, exported for tests (see §5.2). */
export function toConverseInput(req: GenerateRequest, modelId: string, maxTokens: number): Record<string, unknown>;
export function fromConverseOutput(out: unknown, model: string, region: string, latencyMs: number): GenerateResult;
export function createBedrockClient(opts: BedrockClientOptions): BedrockClient;
```

### §3.3 `src/llm/strands-adapter.ts`

```ts
// Requirement IDs: FR-18
import type { ZodType } from "zod";
export interface StructuredRun {
  system: string; user: string; schema: ZodType; modelId: string; region?: string; maxTokens?: number; signal?: AbortSignal;
}
export interface StructuredOk { ok: true; output: unknown; usage: { promptTokens: number; outputTokens: number; totalTokens: number } }
export interface StructuredFail { ok: false; reason: string; detail: string }
export interface StrandsAdapter { run(r: StructuredRun): Promise<StructuredOk | StructuredFail> }
/** Lazy: `import("@strands-agents/sdk")` happens on first run(), so importing this module never needs credentials.
 *  new Agent({ model: new BedrockModel({ modelId, region, maxTokens }), systemPrompt: system, structuredOutputSchema: schema, printer: false }),
 *  then result = await agent.invoke(user); output = result.structuredOutput. StructuredOutputError → { ok:false, reason:"structured_output_error" }. */
export function createStrandsAdapter(): StrandsAdapter;
```

### §3.4 `src/llm/vertex-fallback.ts`

```ts
// Requirement IDs: FR-21
import type { GenerateRequest, GenerateResult } from "src/kits/agent-workflow/src/llm/types.js";
export const FALLBACK_LABEL = "Fallback model (not Bedrock)";
export interface VertexFallback { readonly label: string; readonly modelId: string; generate(req: GenerateRequest): Promise<GenerateResult> }
/** Wraps the kit's createVertexClient; picks the model with the kit's pickModel at first use; label is FALLBACK_LABEL. */
export function createVertexFallback(opts?: { generate?: (req: GenerateRequest) => Promise<GenerateResult> }): VertexFallback;
```

### §3.5 `src/llm/cost.ts`

```ts
// Requirement IDs: FR-18, NFR-14
export interface Usage3 { promptTokens: number; outputTokens: number; totalTokens: number }
export interface CostSummary { usedPct: number; totalTokens: number; requests: number; warning: "none" | "warning" | "critical"; degraded: boolean; text: string }
export interface CostClient {
  /** Runs `call`, records its usage under (provider, label, model), returns the result plus the post-call summary. Never throws because of metering. */
  guard<T>(meta: { provider: string; label: string; model: string }, call: () => Promise<{ result: T; usage: Usage3 }>): Promise<{ result: T; summary: CostSummary }>;
  summary(): CostSummary;
  reset(): void;
  close(): void;
}
export interface CostClientOptions { sidecarPath?: string /* default scripts/cost_sidecar.py */; configPath?: string /* default config/cost.json */; spawnSidecar?: boolean /* default true */ }
export function createCostClient(opts?: CostClientOptions): CostClient;
```

### §3.6 `src/llm/guard.ts`

```ts
// Requirement IDs: NFR-08
export function bannedHits(text: string): string[];                                  // matched banned terms, lower-case, de-duplicated
/** Returns text unchanged when clean. Otherwise calls rewrite(text, hits) ONCE; if the rewrite is still dirty or throws, returns `template`. */
export function guardCopy(text: string, rewrite: (text: string, hits: string[]) => Promise<string>, template: string): Promise<{ text: string; rewritten: boolean; usedTemplate: boolean }>;
```

### §3.7 `src/llm/context.ts`

```ts
// Requirement IDs: FR-18
import type { Content } from "src/kits/agent-workflow/src/llm/types.js";
/** Fits the actor's `contents` into the budget with the chassis `fit` (pinned first user turn, sliding window of the rest),
 *  never splitting a model functionCall turn from its functionResponse turn. Returns the same array when nothing is evicted. */
export function fitTurns(contents: Content[], opts?: { contextWindow?: number; reservedOutput?: number }): { contents: Content[]; evicted: number };
```

### §3.8 `src/agent/schemas.ts`

```ts
// Requirement IDs: FR-06, FR-18
import { z } from "zod";
export const ExtractedEventSchema: z.ZodObject<any>;
export const ExtractorOutputSchema: z.ZodObject<any>;   // { events: ExtractedEvent[], skipped: {rawId, reason}[] }
export const ReviewPlanSchema: z.ZodObject<any>;        // { steps[3..8], focusDays: int[], watchFor: string[] }
export const NarrationSchema: z.ZodObject<any>;         // { incidentId, title, explanation, tone, suggestedNudge }
export type RoleName = "extractor" | "planner" | "narrator";
export interface ExtractorInput { kind: "webhook_inbox" | "history_page"; deviceId: string; records: { rawId: string; record: unknown }[] }
export interface PlannerInput { goal: string; household: { name: string; age: number; caretaker: string; quietHours: string }; baseline: { dwellP90Min: number; visitsPerDay: number }; dayCounts: { day: number; label: string; events: number }[]; actions: { name: string; purpose: string }[] }
export interface NarratorInput { incident: { id: string; kind: string; title: string; whenLocal: string; durationMin?: number; facts: string[] }; household: { name: string; caretaker: string }; baseline: { dwellP90Min: number } }
export interface RoleInput { extractor: ExtractorInput; planner: PlannerInput; narrator: NarratorInput }
export type ExtractorOutput = z.infer<typeof ExtractorOutputSchema>;
export type ReviewPlan = z.infer<typeof ReviewPlanSchema>;
export type Narration = z.infer<typeof NarrationSchema>;
export interface RoleOutput { extractor: ExtractorOutput; planner: ReviewPlan; narrator: Narration }
export const ROLE_SCHEMAS: { [R in RoleName]: z.ZodTypeAny };
export const ROLE_MODEL_TIER: { [R in RoleName]: "fast" | "balanced" };   // extractor fast, planner balanced, narrator fast
```

### §3.9 `src/prompts/*`

```ts
// src/prompts/index.ts
export const PROMPT_VERSION = "doorstep-prompts-1";
export { EXTRACTOR_PROMPT } from "src/prompts/extractor.js";
export { PLANNER_PROMPT } from "src/prompts/planner.js";
export { NARRATOR_PROMPT } from "src/prompts/narrator.js";
export { ACTOR_PROMPT, ACTOR_PROCEDURES, ACT_GOAL, REPAIR_GOAL, CHECKPOINT_GOAL } from "src/prompts/actor.js";
// ACTOR_PROMPT: string (the procedure text appended to the kit's base system prompt via runAgentLoop's procedureText)
// ACTOR_PROCEDURES: { name: string; steps: string[] }[]   (handed to createSession → registry → get_capabilities)
// ACT_GOAL(planText: string): string;  REPAIR_GOAL: string;  CHECKPOINT_GOAL(caretaker: string): string
```

### §3.10 `src/llm/roles.ts`

```ts
// Requirement IDs: FR-18, FR-21, NFR-03
import type { DegradedResult } from "src/resilience";
import type { RoleName, RoleInput, RoleOutput } from "src/agent/schemas.js";
export type TransportKind = "bedrock" | "vertex-fallback" | "golden" | "manual";
export interface RoleCtx { round: number; key: string /* unique per call, e.g. "extractor-1"; the golden-cache key suffix */; signal?: AbortSignal }
export type RoleOutcome<R extends RoleName> =
  | { ok: true; output: RoleOutput[R]; model: string; kind: TransportKind; usage: { promptTokens: number; outputTokens: number; totalTokens: number }; latencyMs: number }
  | { ok: false; degraded: DegradedResult; kind: TransportKind };
export type RoleRunners = { [R in RoleName]: (input: RoleInput[R], ctx: RoleCtx) => Promise<RoleOutcome<R>> };
export interface RoleDeps {
  models: { fast: string; balanced: string };
  region?: string;
  strands?: import("src/llm/strands-adapter.js").StrandsAdapter;
  bedrock: import("src/llm/bedrock-client.js").BedrockClient;          // the Converse forced-tool fallback runner uses it
  vertex?: import("src/llm/vertex-fallback.js").VertexFallback;        // labelled secondary provider, used only when allowFallback
  allowFallback: boolean;
  cost: import("src/llm/cost.js").CostClient;
  cache?: import("src/resilience").GoldenCache;
  recordGolden?: boolean;                                              // write each successful output to the cache (WU-09)
  resilience?: import("src/resilience").ResilienceConfig;
}
export function createRoleRunners(deps: RoleDeps): RoleRunners;
```

### §3.11 `src/agent/actions.ts` and `src/agent/brief.ts`

```ts
// src/agent/actions.ts — Requirement IDs: FR-05, FR-07, FR-12, FR-15
import type { SessionCore } from "src/domain/session.js";
export const ACTION_NAMES: readonly [
  "list_week_events", "get_incident", "get_rhythm_baseline", "list_devices", "get_device_status", "get_device_capabilities",
  "ingest_ring_events", "merge_duplicate_events", "reconcile_webhook_gap", "open_incident", "set_incident_status",
  "check_week_model", "compare_to_baseline",
  "focus_day", "focus_incident", "set_camera_shot",
  "add_incident_note", "propose_family_nudge",
  "play_chime_announcement", "export_weekly_brief"
];
export interface ActionDeps { now?: () => number }
/** Registers the 20 descriptors on core.registry and the three preflights on core (see §5.4). */
export function registerDoorstepActions(core: SessionCore, deps?: ActionDeps): void;

// src/agent/brief.ts — Requirement IDs: FR-15
import type { WeekModel } from "src/domain/types.js";
/** Deterministic plain-language brief for the review week: counts, kept routines, incidents with their explanations. Banned-vocabulary free. */
export function buildWeeklyBrief(model: WeekModel): { title: string; body: string; lines: string[] };
```

### §3.12 `src/agent/transport.ts`

```ts
// Requirement IDs: FR-21
import type { StepFn } from "src/kits/agent-workflow/src/adapters/inApp.js";
import type { GoldenCache } from "src/resilience";
import type { RoleName, RoleInput } from "src/agent/schemas.js";
import type { RoleCtx, RoleOutcome, RoleRunners, TransportKind } from "src/llm/roles.js";
export interface AgentTransport {
  readonly kind: TransportKind;
  readonly label: string;                 // "Amazon Bedrock · <model id>" | FALLBACK_LABEL | "Recorded run" | "Manual"
  model(): string;
  role<R extends RoleName>(role: R, input: RoleInput[R], ctx: RoleCtx): Promise<RoleOutcome<R>>;
  step: StepFn;                           // the actor's tool-use turn: kit handleAgentStep semantics
}
export interface InProcessDeps {
  roles: RoleRunners; bedrock: import("src/llm/bedrock-client.js").BedrockClient;
  vertex?: import("src/llm/vertex-fallback.js").VertexFallback; allowFallback: boolean;
  cost: import("src/llm/cost.js").CostClient; cache?: GoldenCache; recordGolden?: boolean;
  resilience?: import("src/resilience").ResilienceConfig;
}
/** Rung 1/2. step = handleAgentStep(body, client) wrapped by withResilience + fitTurns + cost; client = Bedrock, or the labelled Vertex fallback
 *  once Bedrock returned a DegradedResult and allowFallback is true. kind switches from "bedrock" to "vertex-fallback" at that moment. */
export function createInProcessTransport(deps: InProcessDeps): AgentTransport & { onRungChange(fn: (kind: TransportKind, label: string) => void): void };
/** Rung 3. Replays data/golden-cache entries in recorded order; kind "golden", label "Recorded run". */
export function createGoldenTransport(opts?: { cache?: GoldenCache; dir?: string }): AgentTransport & { remaining(): number; drift(): number };
/** Rung 4. role() returns { ok:false, degraded:{reason:"manual_mode"} }; step returns { ok:false, status:503, message:"The AI path is off. Use the action runner." }. */
export function createManualTransport(): AgentTransport;
```

### §3.13 `src/agent/orchestrator.ts`, `src/agent/floors.ts`, `src/agent/app-session.ts`

```ts
// src/agent/orchestrator.ts — Requirement IDs: FR-06, FR-12, FR-21
import type { Session } from "src/domain/session.js";
import type { RunTrace } from "src/kits/agent-workflow/src/trace/types.js";
import type { DegradedResult } from "src/resilience";
import type { AgentTransport } from "src/agent/transport.js";
import type { TransportKind } from "src/llm/roles.js";
export const PHASES: readonly ["load", "perceive", "plan", "act", "verify", "repair", "explain", "checkpoint", "finish"];
export type Phase = (typeof PHASES)[number];
export interface ReviewDeps {
  session: Session; transport: AgentTransport;
  onPhase?: (phase: Phase, info: { round: number; detail: string }) => void;   // UI mirrors this to data-run-phase
  signal?: AbortSignal;
  limits?: { act: number; repair: number; checkpoint: number };               // default 16 / 8 / 8
  autoDecide?: "approve" | "reject-first-then-approve" | null;                 // scripts only; UI passes null so a person decides
  decisionDelayMs?: number;                                                     // default 40 (autoDecide only)
}
export interface ReviewSummary {
  ok: boolean; stoppedAt: Phase | null; rung: TransportKind; label: string;
  counts: { eventsIngested: number; incidentsOpened: number; errorsAfterPerceive: number; errorsAfterAct: number; errorsAfterRepair: number; warningsAfterRepair: number; modelCalls: number; roles: string[] };
  degraded: DegradedResult[]; trace: RunTrace; floors: import("src/agent/floors.js").FloorReport;
}
export function runWeekReview(deps: ReviewDeps): Promise<ReviewSummary>;
/** Raw (unparsed) history items since a time, newest page first, at most maxPages pages. Exported for tests. */
export function fetchRawHistorySince(ring: import("src/domain/ring-port.js").RingPort, deviceId: string, sinceMs: number, maxPages?: number): Promise<{ rawId: string; record: unknown }[]>;

// src/agent/floors.ts
export interface FloorReport { ok: boolean; modelEntries: number; roles: string[]; verifyRepairRounds: number; humanCheckpoints: number; finalErrors: number | null; problems: string[] }
export const FLOORS: { minModelEntries: 15; minRoles: 4; minVerifyRepairRounds: 1; minHumanCheckpoints: 1; finalErrors: 0 };
export function checkFloors(trace: RunTrace): FloorReport;

// src/agent/app-session.ts — Requirement IDs: FR-02, FR-05, FR-08, FR-09
import type { Session, SessionOptions } from "src/domain/session.js";
export interface AppSessionOptions extends Omit<SessionOptions, "registrar" | "procedures"> {}
/** createSession({ ...opts, procedures: ACTOR_PROCEDURES, registrar: core => registerDoorstepActions(core) }).
 *  The composition root used by `/`, `/watch`, scripts and the evals. */
export function createAppSession(opts: AppSessionOptions): Session;
/** Manual-runner helper: JSON-Schema property list of an action (name, type, enum, description, required) for DP-UI's form. */
export function actionFields(session: Session, name: string): { name: string; type: string; enum?: string[]; description: string; required: boolean }[];
```

## §4 Interfaces consumed (copy verbatim)

From DP-DOMAIN-ENGINE:

```ts
import type { WeekModel, DoorEvent, RawDoorEvent, Incident, IncidentKind, IncidentStatus, ScopeName, Visit } from "src/domain/types.js";
import { localMinutes, localDayNumber, fmtClock, fmtDay, fmtDuration, DAY_MS, MIN_MS } from "src/domain/time.js";
import type { RingPort, RingHistoryItem, RingHistoryPage } from "src/domain/ring-port.js";
import { RingError } from "src/domain/ring-port.js";
import { parseRingPayload, parseHistoryPage } from "src/domain/parse.js";
import { createBundleRingPort } from "src/domain/bundle-ring-port.js";
import { deriveVisits, computeBaseline, findDuplicateClusters, deviceOutages, dayIndexOf, DUP_WINDOW_MS } from "src/domain/derive.js";
import { findWebhookGaps, pollHistory, lastWebhookMs, HISTORY_OVERLAP_MS } from "src/domain/gaps.js";
import { demoSeed, cleanSeed, DEMO_NOW_MS, REVIEW_START_MS, REVIEW_END_MS } from "src/domain/seed.js";
import { truthRules, RULE_IDS, EFFECTIVE_QUIET_HOURS, candidateIncidents } from "src/domain/rules.js";
import type { Candidate } from "src/domain/rules.js";
import { createSession } from "src/domain/session.js";
import type { Session, SessionCore, SessionOptions, Preflight } from "src/domain/session.js";
```

From the installed kit (owner: hee kit, vendored):

```ts
import type { ActionDescriptor, ActionResult, HandlerOutcome, Registry } from "src/kits/agent-workflow/src/registry/types.js";
import { lintDescriptor } from "src/kits/agent-workflow/src/registry/lint.js";
import { toToolDecl } from "src/kits/agent-workflow/src/registry/capabilities.js";
import { runAgentLoop } from "src/kits/agent-workflow/src/adapters/inApp.js";
import type { StepFn } from "src/kits/agent-workflow/src/adapters/inApp.js";
import { handleAgentStep } from "src/kits/agent-workflow/src/server/stepHandler.js";
import type { StepBody, StepResult } from "src/kits/agent-workflow/src/server/stepHandler.js";
import type { Content, Part, GenerateRequest, GenerateResult, GenerateOk, GenerateFail, ToolDecl, Usage } from "src/kits/agent-workflow/src/llm/types.js";
import { createVertexClient } from "src/kits/agent-workflow/src/llm/client.js";
import { pickModel } from "src/kits/agent-workflow/src/llm/models.js";
import { summarizeTrace } from "src/kits/agent-workflow/src/trace/summarize.js";
import type { RunTrace, TraceEntry, TraceWriter } from "src/kits/agent-workflow/src/trace/types.js";
```

From the chassis (curated indexes only):

```ts
import { withResilience, isDegradedResult, makeDegradedResult, createGoldenCache } from "src/resilience";
import type { DegradedResult, GoldenCache, ResilienceConfig } from "src/resilience";
import { fit } from "src/context";
import type { Buffer as ContextBuffer, ContextBudgetConfig } from "src/context";
```
`withResilience(fn, config?, deps?)` returns `() => Promise<T | DegradedResult<T>>`; narrow every result with `isDegradedResult`. `fit(buffer, config?)` returns `{ buffer, status }` where a buffer entry is `{ role: "system" | "user" | "assistant" | "tool", content: string, metadata?: { pinned?: boolean } }`.

From npm (pinned in WU-01): `@strands-agents/sdk` 1.19.0, `@aws-sdk/client-bedrock-runtime` 3.1146.0, `@aws-sdk/client-bedrock` 3.1146.0, `zod` 4.6.5.

## §5 Algorithms and literal configuration

### §5.1 Model discovery (`discoverModels`)
1. `env.BEDROCK_MODEL_ID` set and non-empty → return `{ fast: id, balanced: id, source: "env", region }`.
2. `region = env.AWS_REGION ?? "us-east-1"`.
3. Default `listCandidates` (control plane, `@aws-sdk/client-bedrock`): run `ListInferenceProfilesCommand` (`typeEquals: "SYSTEM_DEFINED"`, paged on `nextToken`) and `ListFoundationModelsCommand({ byOutputModality: "TEXT" })`. Map each inference profile (id such as a region-prefixed profile id) and each foundation model with `modelLifecycle.status === "ACTIVE"` and `inferenceTypesSupported` containing `ON_DEMAND` to a `ModelCandidate`. Prefer the profile entry when both exist for the same model (some models are only invocable through a profile). Credentials come from the SDK's default chain, which honours `AWS_BEARER_TOKEN_BEDROCK`.
4. `rankCandidates(c, tier)`: keep candidates with `active`, `outputModalities` including `TEXT`, `inputModalities` including `TEXT`, and provider in {Anthropic, Amazon}. Score = `tierRank * 1000 + version`, where for `balanced` `tierRank` is 3 for names containing `Sonnet`, 2 for `Pro`, 1 otherwise, for `fast` 3 for `Haiku`, 2 for `Lite`, 1 otherwise; `version` is the first `\d+(\.\d+)?` in the name (0 when absent). Highest score wins; ties broken by the lexicographically smaller id. Candidates whose name contains `Opus` or `Mythos` or `Fable` are excluded from both tiers (cost).
5. No candidate → throw the error text in §3.1. The result is memoised per process for 10 minutes.

### §5.2 Converse mapping (`toConverseInput`, `fromConverseOutput`)
1. `system` → `system: [{ text }]` when present.
2. Each kit `Content` becomes one Converse message: role `model` → `assistant`, `user` → `user`. Part mapping: `{text}` → `{ text }`; `{functionCall}` → `{ toolUse: { toolUseId, name, input: args } }`; `{functionResponse}` → `{ toolResult: { toolUseId, content: [{ json: response }], status: "success" } }`.
3. **Tool-use ids.** The kit's parts carry none. Assign them deterministically: the k-th `functionCall` of the assistant message at index m gets `tu-<m>-<k>`; each `functionResponse` in the next user message takes the oldest unclaimed id from that assistant message with the same `name` (first unclaimed when no name matches). Converse requires every `toolUse` to be answered in the next user message; since `runAgentLoop` always answers every call, the pairing holds.
4. `tools` → `toolConfig: { tools: [{ toolSpec: { name, description, inputSchema: { json: parameters } } }] }`. No `tools` and no `responseSchema` → no `toolConfig`.
5. `responseSchema` (structured roles' fallback runner): add one tool `emit_result` with `inputSchema: { json: responseSchema }` and `toolConfig.toolChoice = { tool: { name: "emit_result" } }`. The output's `emit_result` `toolUse.input` becomes `GenerateOk.json`, and `text` is its JSON string.
6. `inferenceConfig: { maxTokens, temperature: req.temperature ?? 0 }`. Consecutive messages of the same role are merged into one message with the parts concatenated (Converse requires alternation). The first message must be `user`; when the first kit content is a `model` turn, prepend `{ role: "user", content: [{ text: "Continue." }] }`.
7. `fromConverseOutput`: collect `output.message.content` → `text` (joined) and `functionCalls` from `toolUse` (excluding `emit_result`); `usage` ← `{ promptTokens: usage.inputTokens, outputTokens: usage.outputTokens, totalTokens: usage.totalTokens }`; `stopReason === "max_tokens"` with no usable content → `{ ok:false, reason:"max_tokens", detail:"The reply was cut off.", retryable:false }`.
8. `generate` = `toConverseInput` → `send(new ConverseCommand(input))` → `fromConverseOutput`. A thrown AWS error becomes `{ ok:false, reason: err.name, detail: err.message, retryable }` with `retryable` true for `ThrottlingException`, `ModelTimeoutException`, `ServiceUnavailableException`, `InternalServerException`. The client does not retry; `withResilience` does.

### §5.3 Role runner (`createRoleRunners`)
For role `R` with input `x` and `ctx`:
1. `tier = ROLE_MODEL_TIER[R]`; `modelId = deps.models[tier === "fast" ? "fast" : "balanced"]`; `system = PROMPT[R]` plus, for the narrator, the line `Never use words that match any of these patterns: <patterns from config/banned-patterns.json, comma separated>.`; `user = JSON.stringify(x)`; `maxTokens` = extractor 8192, planner 1500, narrator 600.
2. `primary` (async): `cost.guard({ provider: "bedrock", label: R, model: modelId }, …)` around:
   a. `strands.run({ system, user, schema: ROLE_SCHEMAS[R], modelId, region, maxTokens, signal })`; on `ok` → `schema.parse(output)`.
   b. On `ok:false` (any reason) → **Converse forced-tool fallback runner**: `bedrock.generate({ system, contents: [user turn], responseSchema: z.toJSONSchema(schema), temperature: 0 })`; `safeParse(json)`; when invalid, ONE repair round: a second `generate` whose user turn is `user` plus `\n\nYour previous JSON failed validation: <issues joined>. Return corrected JSON only.`; still invalid → throw `Error("structured output failed validation: <issues>")`.
   c. Returns `Tagged = { via: "primary", value, model: modelId, usage, latencyMs }`.
3. `secondary` (only when `allowFallback && vertex`): same call through `vertex.generate` with the same `system/user/responseSchema`, cost provider `"vertex"`, returns `{ via: "secondary", … }`.
4. `wrapped = withResilience(primary, { timeout_ms: 45000, retries: 1, backoff: { base_ms: 500 }, cache_key_strategy: "explicit", cache_key_explicit: "doorstep-role-" + ctx.key, fallback_chain: { order: ["secondary_provider", "cache", "none"], secondary_provider: { enabled: allowFallback && !!vertex }, cache: { enabled: true } }, ...deps.resilience }, { secondaryProvider: secondary, cache: deps.cache })`; `const r = await wrapped()`.
5. `isDegradedResult(r)` → `{ ok: false, degraded: r, kind: "bedrock" }`. Otherwise validate `r.value` with `schema.safeParse` once more (a cache entry may be stale: invalid → degraded `reason: "golden_entry_invalid"`). `kind` = `via === "primary" ? "bedrock" : via === "secondary" ? "vertex-fallback" : "golden"`.
6. When `deps.recordGolden` and `via === "primary" | "secondary"`: `cache.put("doorstep-role-" + ctx.key, { via: "recorded", value, model, usage, latencyMs, provider: via === "primary" ? "bedrock" : "vertex-fallback", promptVersion: PROMPT_VERSION }, { provider, model, source: "recorded", explicit_key: "doorstep-role-" + ctx.key })`.
7. **Raw-id guard for the extractor** (in the orchestrator, §5.12): the model's output is never trusted for ids or timestamps.

### §5.4 Cost client and sidecar
`config/cost.json` (literal):
```json
{ "global": { "budget": 600000, "unit": "tokens", "threshold": 0.8 } }
```
Sidecar protocol (one JSON object per line, both directions; the sidecar reads the config path from `argv[1]`, adds the repo root to `sys.path`, and builds `create_cost_store({"budget_config": cfg})` from `src.cost`):
| Request | Response |
|---|---|
| `{"op":"record","provider":"bedrock","label":"actor","model":"<id>","input_tokens":123,"output_tokens":45}` | `{"ok":true,"usedPct":1.2,"totalTokens":168,"requests":1,"warning":"none"}` |
| `{"op":"summary"}` | `{"ok":true,"usedPct":1.2,"totalTokens":168,"requests":1,"warning":"none","text":"<render_summary table>"}` |
| `{"op":"reset"}` | `{"ok":true}` |
Record handler: builds a `UsageRecord` (`id` uuid4, `timestamp` UTC ISO-8601, `provider` lower-cased, `label`, `model_profile: "generic-heuristic"`, `input_tokens`, `output_tokens`, `total_tokens` = sum, `request_count: 1`, `estimated_cost_usd: None`, `unmetered: False`, `unmetered_reason: ""`, `raw_usage_ref: None`) and calls `store.append(record)`; `usedPct = round(store.global_totals()["total_tokens"] / budget * 100, 1)`; `warning` = `"critical"` at ≥ 95, `"warning"` at ≥ `threshold·100`, else `"none"`. Any exception → `{"ok":false,"error":"<message>"}` and the sidecar keeps running.
`createCostClient`: spawns `python3 <sidecarPath> <configPath>` once (lazily, on first use), writes one line per request and resolves responses in FIFO order with a 2 s timeout. **Degraded counter:** when `python3` is missing, the child exits, a response times out or `ok` is false, the client switches permanently to an in-process counter (budget read from the same JSON file) and every summary carries `degraded: true`; the UI chip then reads "approximate". `guard` always returns `call`'s result — metering never blocks or fails a model call (GOV-RES-04). `summary().text` is the sidecar's table, or `Approximate usage: <n> tokens (<p>% of budget)` when degraded.

### §5.5 Banned-vocabulary guard
`scripts/sync-banned-words.ts` reads `../../hackathons/templates/banned-words.json` and writes `config/banned-patterns.json` = `{ "version": <list version>, "syncedFrom": "banned-words.json", "patterns": [{ "id", "pattern", "flags": "i" }] }` including only entries that have no `presets` field or whose `presets` include `"ui"`. `bannedHits(text)` compiles each pattern and returns the matched substrings, lower-cased and de-duplicated, in pattern order. `guardCopy(text, rewrite, template)`: `hits = bannedHits(text)`; none → `{ text, rewritten:false, usedTemplate:false }`; otherwise call `rewrite(text, hits)` once; clean → `{ text: rewritten, rewritten:true, usedTemplate:false }`; dirty or throwing → `{ text: template, rewritten:true, usedTemplate:true }`. (The narrator's template per incident kind is in §5.10.)

### §5.6 Context fitting (`fitTurns`)
Group `contents` into **units**: unit 0 is the first user turn (pinned); thereafter each model turn plus the user turn that answers it forms one unit (so a `functionCall` is never separated from its `functionResponse`). Convert each unit to one chassis `Message` `{ role: "user", content: JSON.stringify(unit), metadata: { pinned: unit0 } }`, call `fit(buffer, { model_profile: "generic-heuristic", context_window: opts.contextWindow ?? 150000, reserved_output: opts.reservedOutput ?? 4096, strategy: "sliding-window-pinned" })`, and rebuild `contents` from the surviving units in order. `evicted = original units − surviving units`. When `evicted > 0` the transport records a system trace entry `context_fit` with the count. In a normal 16-turn run nothing is evicted; the unit test (WU-02) forces eviction with a tiny window.

### §5.7 Schemas (literal)
```ts
import { z } from "zod";
export const ExtractedEventSchema = z.object({
  rawId: z.string().describe("The id of the input record this event came from, copied exactly."),
  deviceId: z.string(),
  componentId: z.number().int().min(0).max(8),
  type: z.enum(["motion_detected", "button_press", "device_online", "device_offline"]),
  subType: z.enum(["human"]).nullable(),
  tsMs: z.number().int().positive().describe("UTC milliseconds since 1970."),
  requestId: z.string(),
});
export const ExtractorOutputSchema = z.object({
  events: z.array(ExtractedEventSchema),
  skipped: z.array(z.object({ rawId: z.string(), reason: z.string().max(120) })),
});
export const ReviewPlanSchema = z.object({
  steps: z.array(z.object({
    order: z.number().int().min(1).max(8),
    goal: z.string().min(8).max(160),
    actions: z.array(z.string()).min(1).max(6),
    why: z.string().min(8).max(200),
  })).min(3).max(8),
  focusDays: z.array(z.number().int().min(7).max(13)).max(7),
  watchFor: z.array(z.string().max(120)).max(6),
});
export const NarrationSchema = z.object({
  incidentId: z.string(),
  title: z.string().min(4).max(80),
  explanation: z.string().min(20).max(320),
  tone: z.enum(["calm", "check_in"]),
  suggestedNudge: z.string().max(200).nullable(),
});
export const ROLE_SCHEMAS = { extractor: ExtractorOutputSchema, planner: ReviewPlanSchema, narrator: NarrationSchema } as const;
export const ROLE_MODEL_TIER = { extractor: "fast", planner: "balanced", narrator: "fast" } as const;
```
`scripts/gen-schemas.ts` writes `engine/schema/extractor-output.schema.json`, `engine/schema/review-plan.schema.json`, `engine/schema/narration.schema.json` from `z.toJSONSchema(schema)` (JSON Schema 2020-12, 2-space indent, trailing newline) and exits non-zero when a committed file differs from a fresh render (`--check`).

### §5.8 Prompts (literal)

`src/prompts/extractor.ts` — `EXTRACTOR_PROMPT`:
```text
You read raw records from Ring doorbell and camera devices and turn each record into one clean door event.

Input: a JSON object with "kind" ("webhook_inbox" or "history_page"), "deviceId", and "records", a list of { "rawId", "record" }. A webhook record has fields such as event_id, timestamp, type, device_id, attributes { sub_type, component_ids } and meta { request_id, time }. A history record has fields such as id, eventType, timestamp, subType and componentIds. Field names can vary slightly: read the meaning, not the exact spelling.

Output: one JSON object { "events": [...], "skipped": [...] } and nothing else.

Rules:
1. Produce exactly one entry, in "events" or in "skipped", for every input record. Copy "rawId" exactly as given. Never invent a record and never merge two records.
2. "type" must be one of motion_detected, button_press, device_online, device_offline. Map doorbell presses and dings to button_press, any motion alert to motion_detected, and connectivity changes to device_online or device_offline. A record that is none of these goes in "skipped" with a short reason.
3. "subType" is "human" only when the record says the motion was a person; otherwise null.
4. "componentId" is the first component id in the record, or 0 when there is none.
5. "tsMs" is the record's timestamp as UTC milliseconds since 1970. Convert ISO-8601 text exactly; a timestamp in seconds is multiplied by 1000. Do not round or shift it.
6. "deviceId" is the device the record belongs to. "requestId" is meta.request_id for webhook records, or "hist:" followed by the record id for history records.
7. Never guess a value you cannot read. An unreadable record is skipped with the reason.
```

`src/prompts/planner.ts` — `PLANNER_PROMPT`:
```text
You plan the weekly review of a doorstep activity record for a family member who lives far from an older parent. You have not seen any check results or issues. You decide what is worth looking at, not what was found.

Input: a JSON object with "goal", "household" (name, age, caretaker, quietHours), "baseline" (the usual longest stay in minutes and visits per day), "dayCounts" (events per day for the review week; days are numbered 7 to 13 with 7 = Monday), and "actions" (the names you may use, each with its purpose).

Output: one JSON object { "steps", "focusDays", "watchFor" } and nothing else.

Rules:
1. "steps" has 4 to 7 entries in the order they should run. Each has "order" (1, 2, 3 …), "goal" (one sentence: what to learn or change), "actions" (names taken only from the input list) and "why" (one sentence tied to the household's own numbers).
2. Start with reading and reconciling the record, then looking at the focus days, then recording what was found, then one step that verifies the record with check_week_model, then one step that prepares what the family will see (a family message and the weekly brief).
3. "focusDays" lists the review days that deserve a closer look, chosen from the event counts (unusually many, unusually few, or none). Use the numbers 7 to 13 only.
4. "watchFor" lists up to 5 short plain phrases, for example "a visit after quiet hours begin" or "a device that stopped reporting".
5. Do not claim that anything was found.
6. A chime or any message that reaches a person needs the family member's consent and approval; never describe it as certain.
```

`src/prompts/narrator.ts` — `NARRATOR_PROMPT`:
```text
You write one short note for a family member about one thing that stood out in a parent's doorstep record. The reader is the adult child, at work or travelling, with a few seconds.

Input: a JSON object with "incident" (id, kind, title, whenLocal, durationMin, facts), "household" (name, caretaker) and "baseline" (dwellP90Min).

Output: one JSON object { "incidentId", "title", "explanation", "tone", "suggestedNudge" } and nothing else.

Rules:
1. "incidentId" is copied from the input.
2. "title" is a plain label of 4 to 10 words.
3. "explanation" is two or three sentences, at most 320 characters. Say what happened, when, and how it compares with the usual rhythm. Use only the facts and numbers in the input: every number you write must appear in the input.
4. "tone" is "calm" when the pattern was only slightly different from usual, or "check_in" when a gentle call or message would be sensible. Never use alarm words.
5. "suggestedNudge" is one short, kind message the caretaker could send (under 200 characters), or null when none is needed.
6. Do not diagnose, do not guess a reason, do not mention anyone being recorded, and do not name a medical condition.
7. Do not use words from the banned list appended below this prompt, and do not announce your own sincerity.
```

`src/prompts/actor.ts` — `ACTOR_PROMPT` (the text passed as `procedureText`):
```text
Doorstep Rhythm shows one household's week of front-door activity (a Ring doorbell and a hall camera). Review days are numbered 7 to 13 (7 = Monday 12 October, 13 = Sunday 18 October). Quiet hours are 22:00 to 07:00 with 30 minutes of tolerance on each side. Times in results are local to the household.

Rules that always apply:
- Change the record only through the functions you are given. Read results before you decide, and never invent an id.
- Use only ids and numbers that appeared in function results.
- Consent belongs to the family member. You cannot turn it on. When a function says consent is off, say so in your final message and move on.
- A message or a chime that reaches a person is a cross-boundary action. The family member may decline it. When it is declined, do not retry it.

PROCEDURE A — Review the week (after the review plan is given)
1. Call get_rhythm_baseline once.
2. For each device returned by list_devices, call reconcile_webhook_gap with overlapMinutes 0. A device whose webhooks went quiet has its missing events filled in from the event history.
3. For each focus day in the plan (all of days 7 to 13 when none are given), call compare_to_baseline with that day. Several calls may go out in the same turn.
4. For each finding that is a real change from the household's rhythm (a visit during quiet hours, a stay well above the usual, a device offline for over 30 minutes, a routine that did not happen), call open_incident with the finding's kind, title, eventIds, startMs, endMs, routineId and dayIndex exactly as returned, then call add_incident_note with one plain sentence about what you saw.
5. Call check_week_model and read its issues.
6. Reply in two or three sentences: what you opened, and the counts check_week_model returned.

PROCEDURE B — Repair errors
1. For each issue with severity error, call the action named in the issue's fix with the arguments given. Do not change the arguments.
2. Call check_week_model again. Repeat until it reports zero errors or your turns run out.
3. Reply in two sentences: what you changed and the final counts.

PROCEDURE C — Prepare the family update
1. Call propose_family_nudge once, for the most important open incident, with one short kind sentence. The family member decides on it.
2. Call export_weekly_brief once. It waits for the family member's approval.
3. If a chime on the front door would reassure and list_devices shows the device can play audio, call play_chime_announcement once with audioRef "gentle_hello".
4. When any call is refused or declined, do not retry it. Reply in two sentences: what was done, and what the family member could switch on.
```
`ACTOR_PROCEDURES` (literal): `[{ name: "review_week", steps: [<the six steps of A, one string each>] }, { name: "repair_errors", steps: [<three steps of B>] }, { name: "prepare_family_update", steps: [<four steps of C>] }]`.
Goals (literal):
```ts
export const ACT_GOAL = (planText: string) =>
  `Review the household's week (Monday 12 to Sunday 18 October) by following Procedure A and the review plan below. Open an incident for each real change you find, reconcile any device whose webhooks went quiet, and run check_week_model when you have finished reading and recording.\n\nREVIEW PLAN\n${planText}`;
export const REPAIR_GOAL =
  "check_week_model reported errors. Follow Procedure B: apply the suggested fix for each error, run check_week_model again, and stop when it reports zero errors.";
export const CHECKPOINT_GOAL = (caretaker: string) =>
  `The review is done. Follow Procedure C to prepare the family update for ${caretaker}: one gentle family message, the weekly brief, and a front-door chime only if it is allowed. Do not retry anything that is refused or declined.`;
```

### §5.9 The 20 actions (literal descriptors)

Helper used by `src/agent/actions.ts` (literal):
```ts
const P = {
  str: (description: string, extra: Record<string, unknown> = {}) => ({ type: "string", description, ...extra }),
  int: (description: string, minimum?: number, maximum?: number) => ({ type: "integer", description, ...(minimum !== undefined ? { minimum } : {}), ...(maximum !== undefined ? { maximum } : {}) }),
  bool: (description: string) => ({ type: "boolean", description }),
  enm: (description: string, values: string[]) => ({ type: "string", enum: values, description }),
  arr: (description: string, items: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({ type: "array", description, items, ...extra }),
};
const schema = (properties: Record<string, unknown>, required: string[] = []) =>
  ({ type: "object", additionalProperties: false, properties, ...(required.length ? { required } : {}) });
```
No property is named `target`, `entity`, `room` or `item` (the kit's lint would demand extra wording). Flags: **RO** readOnly, **D** destructive, **U** untrustedContent (the handler reads content that came from outside).

| # | name | group | flags | `inputSchema` properties (`*` = required) | `description` (literal) |
|---|---|---|---|---|---|
| 1 | `list_week_events` | read | RO U | `day` int 0–13 "Absolute day index: 0 = Mon 5 Oct, 7 = Mon 12 Oct, 13 = Sun 18 Oct."; `deviceId` str "Device id such as dev-door, or its name such as Front door."; `type` enum motion_detected\|button_press\|device_online\|device_offline; `limit` int 1–100 "Maximum events returned, default 40." | `Lists door events and the visits built from them for one day or the whole record, oldest first. Use it to read a day before deciding what to open; it never changes anything, and all times are local to the household. Example: list_week_events({"day": 8, "limit": 20}).` |
| 2 | `get_incident` | read | RO | `incidentId`* str "Incident id such as inc-1." | `Returns one incident with its notes and attached evidence (labels only, not image data). Use it before changing an incident's status. Example: get_incident({"incidentId": "inc-1"}).` |
| 3 | `get_rhythm_baseline` | read | RO | — | `Returns the household's usual rhythm from the baseline week: the longest-stay figure (90th percentile, in minutes), the median stay, the number of visits it is based on, the busiest hours and the daily routines. Call it once before comparing days. Example: get_rhythm_baseline({}).` |
| 4 | `list_devices` | read | RO | — | `Lists the household's Ring devices with their components and whether each can play audio, show live video or take a snapshot. Use it to find device ids and to check a capability before proposing an action that needs it. Example: list_devices({}).` |
| 5 | `get_device_status` | read | RO | `deviceId`* str "Device id or name." | `Reads a device's current status from Ring: online or offline, power source and battery level. Use it when a device looks silent in the record. Example: get_device_status({"deviceId": "dev-elite"}).` |
| 6 | `get_device_capabilities` | read | RO | `deviceId`* str "Device id or name."; `componentId` int ≥ 0 "Camera component, 0 or 1 on the hall camera." | `Reads what a device, or one of its components, can do: motion detection, live video, snapshot and chime audio. Use it before relying on a capability. Example: get_device_capabilities({"deviceId": "dev-elite", "componentId": 1}).` |
| 7 | `ingest_ring_events` | change | U | `source`* enum webhook_inbox\|history; `deviceId` str "Device id or name; required when source is history."; `sinceMs` int "Only events at or after this UTC millisecond time; default the start of the record." | `Brings new events into the record, either the webhooks waiting in the inbox or a device's event history. Events are added by id only, so the same moment seen on both channels stays as two events until merge_duplicate_events folds them. Example: ingest_ring_events({"source": "history", "deviceId": "dev-door"}).` |
| 8 | `merge_duplicate_events` | change | — | `eventIds`* array of str, minItems 2 "Ids of events that are the same moment seen twice." | `Folds events that are the same moment seen twice into the earliest one. Use it on the ids named by a duplicate issue from check_week_model, and only on ids that belong to one duplicate group. Example: merge_duplicate_events({"eventIds": ["evt:req-a", "hist:b"]}).` |
| 9 | `reconcile_webhook_gap` | change | U | `deviceId`* str "Device id or name."; `overlapMinutes` int 0–60 "Minutes before the last webhook to start reading, default 10." | `Fills the gap left when a device's webhooks went quiet by reading its event history from the last webhook onward, skipping events already in the record. Use it for each device before comparing days; with overlapMinutes 0 nothing already known is read again. Example: reconcile_webhook_gap({"deviceId": "dev-elite", "overlapMinutes": 0}).` |
| 10 | `open_incident` | change | — | `kind`* enum quiet_hours_activity\|long_dwell\|device_outage\|missed_routine\|duplicate_burst; `title`* str 4–80; `eventIds`* array of str "Event ids behind the incident; empty only for missed_routine."; `routineId` str; `dayIndex` int 0–13; `startMs`* int; `endMs`* int; `withSnapshot` bool "Attach a snapshot from the device as evidence, default true." | `Opens an incident for something that stood out and, by default, attaches a snapshot from the device as evidence. Use the kind, title, eventIds, startMs, endMs, routineId and dayIndex exactly as a finding or an issue fix gives them. Example: open_incident({"kind": "quiet_hours_activity", "title": "Door activity at 02:14 during quiet hours", "eventIds": ["evt:req-9"], "startMs": 1791000000000, "endMs": 1791001000000, "dayIndex": 8}).` |
| 11 | `set_incident_status` | change | — | `incidentId`* str; `status`* enum open\|explained\|resolved\|dismissed; `summary` str ≤ 320 "Plain-language explanation shown to the family." | `Moves an incident to a new status and, when given, stores the explanation the family will read. Use explained once a note has been written, resolved when the family member has dealt with it, and dismissed when it was not a concern. Example: set_incident_status({"incidentId": "inc-1", "status": "explained", "summary": "A visit at 02:14 lasted 22 min."}).` |
| 12 | `check_week_model` | verify | RO | — | `Runs every rule over the record and returns the issues with a suggested fix for each, plus the error and warning counts. Call it after reading and recording, and again after every repair until it reports zero errors. Example: check_week_model({}).` |
| 13 | `compare_to_baseline` | verify | RO | `day`* int 0–13 "Absolute day index; review days are 7 to 13." | `Compares one day with the household's baseline and returns the visit count, the longest stay against the usual figure, quiet-hours visits, routines kept and missed, and a list of findings that could become incidents. Use the findings' fields as they are when opening an incident. Example: compare_to_baseline({"day": 8}).` |
| 14 | `focus_day` | navigate | — | `day` int 0–13 or null "Day to show, or null to show the whole week." (`type: ["integer","null"]`) | `Moves the view to one day so the person watching sees what you are reading. It changes nothing in the record. Example: focus_day({"day": 8}).` |
| 15 | `focus_incident` | navigate | — | `incidentId`* str | `Selects an incident in the view, moves to its day and frames it in the 3D scene. Use it when you start working on an incident. Example: focus_incident({"incidentId": "inc-1"}).` |
| 16 | `set_camera_shot` | navigate | — | `shot`* enum overview\|walk\|focus; `incidentId` str "Required when shot is focus." | `Chooses the camera shot of the 3D doorway view: the whole week, a walk along a visitor's path, or a close frame on one incident. It changes only the view. Example: set_camera_shot({"shot": "overview"}).` |
| 17 | `add_incident_note` | collaborate | — | `incidentId`* str; `text`* str 8–280 "One plain sentence about what was seen." | `Adds a short note to an incident so the family can see what you saw. Write one plain sentence using only facts from function results. Example: add_incident_note({"incidentId": "inc-1", "text": "The front door saw activity at 02:14, inside quiet hours."}).` |
| 18 | `propose_family_nudge` | collaborate | — | `text`* str 8–200 "One short, kind message for the family member to approve."; `incidentId` str; `scope` enum family_message "Message channel, default family_message." | `Prepares one gentle message for the family member to send, shown as a decision card. It is only a proposal: the family member approves or rejects it, and it needs the Family message consent to be on. Example: propose_family_nudge({"incidentId": "inc-1", "text": "Maybe a quick call this evening?"}).` |
| 19 | `play_chime_announcement` | cross_boundary | D | `deviceId`* str "Device id or name; must support chime audio."; `audioRef`* enum gentle_hello\|check_in_chime; `incidentId` str | `Plays a short chime on the front-door device so someone at home hears a gentle sound. It reaches a person, so it needs the Chime announcement consent and the family member's approval each time, and it works only on a device that can play audio. Example: play_chime_announcement({"deviceId": "dev-door", "audioRef": "gentle_hello"}).` |
| 20 | `export_weekly_brief` | cross_boundary | D | `includeNotes`* bool "Include the incident notes in the brief." | `Builds the weekly brief from the record and shares it with the family. It leaves the product, so it needs the Weekly brief consent and the family member's approval each time. Example: export_weekly_brief({"includeNotes": true}).` |

`title` of each descriptor is the name with underscores replaced by spaces and the first letter capitalised ("List week events"). `summarize` (the approval-bar sentence, literal): `play_chime_announcement` → `play a gentle chime on the {device description}`; `export_weekly_brief` → `share the weekly brief with {caretaker}`; where `{device description}` and `{caretaker}` are read from the model at call time.

**Preconditions (for `validNextActions`):** `merge_duplicate_events` → `findDuplicateClusters(model.events).length > 0`; `set_incident_status`, `add_incident_note`, `get_incident`, `focus_incident` → `model.incidents.length > 0`; `play_chime_announcement` → the `chime_announcement` consent is granted and some device has `chimeAudio`; `propose_family_nudge` → `family_message` granted; `export_weekly_brief` → `weekly_brief` granted. All others: none.

**Preflights** (registered with `core.registerPreflight`; each returns `null` to proceed or `{ message, next }`, which the session wrapper returns as `{ ok:false }` before the gate is touched):
| Action | Condition | `message` | `next` |
|---|---|---|---|
| `propose_family_nudge` | `family_message` not granted | `Family messages are off. {caretaker} can turn on "Family message" in the Consent panel.` | `Say in your reply that consent is off, and continue.` |
| `play_chime_announcement` | `chime_announcement` not granted | `Chime announcements are off. {caretaker} can turn on "Chime announcement" in the Consent panel.` | `Say in your reply that consent is off, and continue.` |
| `play_chime_announcement` | device unknown or `chimeAudio` false | `{device} cannot play audio, so no chime was sent.` | `Call list_devices to see which device can play audio.` |
| `export_weekly_brief` | `weekly_brief` not granted | `The weekly brief is off. {caretaker} can turn on "Weekly brief" in the Consent panel.` | `Say in your reply that consent is off, and continue.` |

**Handlers (what each does; every handler returns the kit's `HandlerOutcome`; a store refusal is passed through as `{ ok:false, error, next }`).**
1. *Device and incident resolution.* `resolveDevice(model, text)` matches `id` exactly, then a case-insensitive match on `description`, else `null`; an unknown device returns `{ ok:false, error: "No device \"<text>\". Call list_devices to see valid ids.", next: "list_devices" }`.
2. `list_week_events`: filters `model.events` (`day` via `dayIndexOf(model, ts)`), sorts by `tsMs`, marks `duplicate` for ids that appear in `findDuplicateClusters`; `visits` = visits starting that day.
3. `get_rhythm_baseline`: `dwellP90Min = round(baseline.dwellP90Sec / 60)`; `busiestHours` = the three hours with the largest `rhythm` column sums, as `"08:00"` strings.
4. `get_device_status` / `get_device_capabilities`: `await core.ring.getStatus(id)` / `getCapabilities(id, componentId)`; a `RingError` becomes `{ ok:false, error: "<RingError.message>", next: "Call list_devices, then retry." }`.
5. `ingest_ring_events` — `webhook_inbox`: `payloads = await ring.drainWebhookInbox()`; `events = parseRingPayload(payloads)`; dispatch `ingest_events`, then `record_webhook` per payload. `history`: requires a device (error `Pass deviceId when source is history.`); `events = await pollHistory(ring, deviceId, sinceMs ?? model.window.startMs)`; dispatch `ingest_events`. Summary `Added {n} events from {source} ({m} already known).`
6. `merge_duplicate_events`: dispatch the store action; summary `Merged {k} events into {keeperId}.`
7. `reconcile_webhook_gap`: `overlapMs = overlapMinutes·MIN_MS` (default 10); `gaps = findWebhookGaps(model, deviceId, model.clockMs, overlapMs)`; none → `{ ok:true, summary: "No webhook gap for {device}: its last webhook is recent.", data: { gaps: [] } }`; else `events = await pollHistory(ring, deviceId, gaps[0].fromMs)`, drop those already in the model by id **or** matching an existing event on (device, type, component) within `DUP_WINDOW_MS`, dispatch `ingest_events` with the rest; summary `Recovered {n} events for {device} from the event history ({k} already known).`
8. `open_incident`: dispatch; when `withSnapshot` (default true) and the first event's device has `snapshot` capability, `await ring.getSnapshot(deviceId, componentId)` then dispatch `attach_media` with `label` `Snapshot · {device description} · {fmtDay} {fmtClock}`; a `RingError` leaves the incident without media and appends ` (no snapshot: {message})` to the summary. Summary `Opened {id}: {title}.` `entityIds` = the incident id plus media ids.
9. `check_week_model`: `issues = truth.check(model)`; `data = { issues: issues.map(i => ({ id, severity, message, entityIds, fix })) }`; summary `{e} errors, {w} warnings.` (the registry adds `data.truth`).
10. `compare_to_baseline`: `candidates = candidateIncidents(model).filter(c => c.dayIndex === day)`; `data = { day, label, visits, longestStayMin, usualLongestStayMin, quietHourVisits, routinesKept, routinesMissed, findings: candidates.map(c => ({ kind, title, eventIds, startMs, endMs, routineId, dayIndex })) }`; `findings` carries every candidate whether or not an incident exists (`covered: boolean` added per finding). Summary `{label}: {n} visits, {f} findings.`
11. Navigate actions dispatch `set_ui` (`focus_incident` also sets `selectedDay` to the incident's `dayIndex` and `shotId` to `focus:<incidentId>`; `set_camera_shot` with `focus` requires `incidentId`, error `Pass incidentId when shot is focus.`).
12. `add_incident_note`: `add_note` with `author: "agent"`.
13. `propose_family_nudge`: `propose_nudge`; summary `Proposed a family message for approval ({id}).`
14. `play_chime_announcement` (runs only after approval): `await ring.playChime(deviceId, audioRef)`, then dispatch `propose_nudge` (scope `chime_announcement`, text `Played "{audioRef}" on {device description}`), `decide_nudge` approved, `record_nudge_result` sent; a `RingError` records `failed` with the message and returns `{ ok:false, error }`.
15. `export_weekly_brief` (runs only after approval): `brief = buildWeeklyBrief(model)`, `includeNotes` appends each note as an extra line; dispatch `propose_nudge` (scope `weekly_brief`, text = body), `decide_nudge` approved, `record_nudge_result` sent; returns `data: { brief }` so the UI can show or download it.

### §5.10 Weekly brief and narrator templates
`buildWeeklyBrief(model)` (pure; no banned vocabulary): `title = "Week of " + fmtDay(REVIEW_START_MS)`; `lines` =
1. `{v} visits at the front door, {r} of them part of the usual routines.`
2. `Routines kept: {k} of {t}.` (`t` = routine-days expected in the review week that had events; `k` = those with a matched visit)
3. one line per incident (at most 5, oldest first): `{title}: {summary or "needs a look"}`
4. `Quiet hours: {fmtClock(start)} to {fmtClock(end)}.`
`body = lines.join("\n")`. Narrator templates (used when the model's text fails the guard or the narrator is degraded), keyed by incident kind: `quiet_hours_activity` → `There was door activity at {clock} on {day}, during quiet hours. A gentle check-in could be worth it.`; `long_dwell` → `Someone stayed at the door for {mins} min on {day}, longer than the usual {p90} min.`; `device_outage` → `{device} stopped reporting for {mins} min on {day}, so activity in that time may be missing.`; `missed_routine` → `The {routine} did not happen on {day}. It usually does.`; `duplicate_burst` → `Several events were the same moment seen twice.` Narrator `facts` (input) are built from the model: `Day: {fmtDay}`, `Time: {clock}`, `Duration: {mins} min`, `Usual longest stay: {p90} min`, `Events: {n}`, plus the kind-specific device or routine name. `numbersGrounded(text, factsText)`: every digit run in `text` must occur in `factsText`.

### §5.11 Transports
1. **In-process (rungs 1–2).** `step(body)`: `n = ++stepCounter` (zero-padded to 3 digits); `fitted = fitTurns(body.contents)`; `primary`: `cost.guard({provider:"bedrock",label:"actor",model}, …)` around `handleAgentStep({ system: body.system, contents: fitted.contents, tools: body.tools }, bedrock)`; a `{ ok:false }` result throws `Error(message)` so `withResilience` retries (timeout 60 s, retries 1). Returns `Tagged = { via: "primary", value: StepResult, inputHash, model }`. `secondary` (when `allowFallback` and `vertex`): the same through `createVertexClient`'s generate wrapped as `{ generate }`, `via: "secondary"`. Config as in §5.3 with `cache_key_explicit: "doorstep-step-" + pad3(n)`. Degraded → `{ ok:false, status:502, message:"The model is not reachable right now." }`, and `kind` stays. When a tagged value comes back with `via` other than `primary`, `kind` changes (`secondary` → `"vertex-fallback"`, `recorded` → `"golden"`) and `onRungChange` fires once per change. With `recordGolden`, successful primary/secondary steps are put into the cache as `{ via:"recorded", value, inputHash, model, provider, promptVersion }`.
2. **Golden (rung 3).** Keys: `doorstep-role-<ctx.key>`, `doorstep-step-<nnn>`, and `doorstep-meta`. `role()` returns the stored `value` after `safeParse`; a miss → `{ ok:false, degraded: makeDegradedResult({ reason: "golden_cache_miss", fallback_source: "none" }) }`. `step()` serves entries in order; if `inputHash` of the last content turn differs from the recorded one it still serves the entry and `drift()` increments (the trace decision records `drift`); when no entry remains → `{ ok:false, status:502, message:"The recorded run has no further steps." }`. `remaining()` = recorded steps − served steps.
3. **Manual (rung 4).** As in §3.12.
4. **Labels.** bedrock → `Amazon Bedrock · <model id>`; vertex-fallback → `Fallback model (not Bedrock)`; golden → `Recorded run`; manual → `Manual`.

### §5.12 Orchestrator (`runWeekReview`) — the call graph
Rounds: perceive 1, plan 2, act 3, repair 4, explain 5, checkpoint and finish 6. `callRole(role, input, round)` assigns `key = role + "-" + (++counter[role])`, calls `transport.role`, records `trace.record({ round, kind:"model", name: role, source:"agent", input_ref: key, output_ref: <one-line summary or the degraded reason>, ok, tokens, latency_ms, decision })`, and pushes any `DegradedResult` into `degraded`. `onPhase(phase, …)` fires at the start of each phase.
0. **Manual guard.** `transport.kind === "manual"` → return `{ ok:false, stoppedAt:"load", … }` with the floors report listing `The AI path is off.`; nothing is called.
1. **load.** `devices = await ring.listDevices()`; dispatch `set_devices` with `devices.map(toDomainDevice)` (source `system`); a `RingError` is added to `degraded` and the seeded devices stay.
2. **perceive.** (a) `inbox = await ring.drainWebhookInbox()`; records `{ rawId: "evt:" + meta.request_id, record }`; chunks of at most 60 → `callRole("extractor", { kind:"webhook_inbox", deviceId:"all", records }, 1)`. (b) `verifyExtraction(records, output)`: for each returned event whose `rawId` is in the records, recompute the ground truth with `parseRingPayload` / `parseHistoryPage`; where the parser yields an event, **the parser's fields win** (counted as `corrected` when they differ); where the parser yields nothing but the model returned an event for that `rawId`, accept it only if its `tsMs` equals the record's own timestamp and its `deviceId` equals the record's device; records the model skipped or omitted that the parser can read are **filled** from the parser (counted `filled`). (c) Dispatch `ingest_events` (source `agent`) and record a trace `action` entry named `ingest_events` with `state_change`; dispatch `record_webhook` per payload. (d) History: `since = (lastWebhookMs(model, doorId) ?? model.window.startMs) − HISTORY_OVERLAP_MS`; `rawHistory = await fetchRawHistorySince(ring, doorId, since)`; one extractor call (`kind:"history_page"`), verification and ingest as above; this deliberately ingests by id only, so the overlap becomes the seeded duplicate cluster. Degraded extractor → the parser's events are ingested and the phase detail says `used the built-in reader`. `errorsAfterPerceive = session.checkNow().counts.errors`.
3. **plan.** `callRole("planner", …)` with `dayCounts` from the model (review days 7–13), `actions` = `{ name, purpose: title }` of every registered action (including `get_capabilities`), `goal` = `Review the week and decide what to tell the family.`; the guard drops action names not in `ACTION_NAMES`; `planText` = steps rendered as `1. <goal> (<actions>) — <why>` plus `Watch for: <watchFor>`; degraded → a fixed `DEFAULT_PLAN_TEXT` constant (the six steps of Procedure A) and the phase detail says `used the default plan`.
4. **act.** `runAgentLoop({ registry: session.registry, step: transport.step, goal: ACT_GOAL(planText), productName: "Doorstep Rhythm", procedureText: ACTOR_PROMPT, maxSteps: limits.act ?? 16, trace: session.trace, round: () => 3, signal, modelRole: "actor" })`. `stopped === "model_error"` → return `{ ok:false, stoppedAt:"act" }`. `errorsAfterAct = checkNow().counts.errors`.
5. **verify.** When the trace has no `check_week_model` entry newer than the last state change, call `session.call("check_week_model", {}, { source:"agent", round:3 })`.
6. **repair.** While `errors > 0`: `runAgentLoop` with `REPAIR_GOAL`, `maxSteps: limits.repair ?? 8`, `round: () => 4`; then **system repair for the pass**: for each remaining error issue with a `fix`, `session.call(fix.action, fix.args, { source:"system", round:4 })`, then `check_week_model` again (the phase detail says `repaired by the system after the agent stopped` when the system cleared the last of them). Every tenth system fix flushes the pending UI updates with `flushSync` (a no-op outside browsers): a long run of fixes would otherwise keep every render attempt dirty with leftover work, and React caps nested updates per attempt; the flush drains the queue so the cap (50) never accumulates. Break when errors reach 0 (`agent repaired all errors` when the agent pass alone did it) or when a full agent-plus-system pass changed no `revision`. Bulk issues the agent did not reach in its pass (e.g. a week of channel duplicates against a short recorded run) are folded by the system in the same pass, so the loop converges without spending a second agent pass. `errorsAfterRepair`, `warningsAfterRepair` from `checkNow()`.
7. **explain.** For each incident with status `open`, in id order: build `NarratorInput` (facts per §5.10), `callRole("narrator", input, 5)`, then `guardCopy(output.explanation, rewrite, template)` where `rewrite` calls the narrator once more with an extra fact `Avoid these words: <hits>` and returns its explanation, and `numbersGrounded` is checked on the result (not grounded → treated as dirty); then `session.call("set_incident_status", { incidentId, status: "explained", summary: text }, { source:"agent", round:5 })`. A degraded narrator → the template.
8. **checkpoint.** With `autoDecide` set, subscribe to `session.gate.subscribe` and decide each pending request after `decisionDelayMs` (`approve`, or `reject-first-then-approve`: the first request is rejected, later ones approved); with `autoDecide: null` a person decides in the approval bar. `runAgentLoop` with `CHECKPOINT_GOAL(household.caretaker)`, `maxSteps: limits.checkpoint ?? 8`, `round: () => 6`. Unsubscribe in a `finally`.
9. **finish.** `session.call("check_week_model", {}, { source:"agent", round:6 })`; `trace = session.trace.snapshot()`; `floors = checkFloors(trace)`; `ok = floors.ok && stoppedAt === null`; `counts.modelCalls = summarizeTrace(entries).model_calls`; `roles = summary.model_roles`.
Expected totals in the golden demo run (R-6 of the blueprint): extractor 2 + planner 1 + actor act ≈ 7 + repair ≈ 3 + narrator 3 + checkpoint ≈ 4 = ≈ 20 model entries (floor 15), 4 roles, the verify→repair drop from 1 error to 0, one gated approval, and the chime refusal when consent is off.

### §5.13 Golden recording and replay
`scripts/record-golden.ts [--allow-fallback]`: (1) `discoverModels()`; (2) deletes every file under `data/golden-cache/` whose name starts with `doorstep-`; (3) builds `createAppSession({ initial: demoSeed(), ring: createBundleRingPort() })`, an in-process transport with `recordGolden: true` over `createGoldenCache("data/golden-cache")`; (4) `runWeekReview({ autoDecide: "approve" })`; (5) requires `floors.ok`, then writes `doorstep-meta` = `{ promptVersion, provider, model, region, recordedAt (ISO), roles: { extractor: n, planner: n, narrator: n }, steps: N, floors }` and `data/golden-cache/recorded-trace.json` (the run's `RunTrace`); (6) prints `recorded: <provider> <model> steps=<N> roles=<n>`. A recording where `rung !== "bedrock"` prints `recorded via fallback` and the metadata keeps `provider: "vertex-fallback"`. `scripts/run-review.ts --transport bedrock|vertex|golden|scripted [--out <path>]` runs the same orchestrator headlessly and prints `review: ok=<bool> rung=<kind> modelCalls=<n> errors <a>→<b>→<c> warnings=<w>`.
`scripts/verify/scripted-transport.ts` (verification tooling only, never shipped in the app, never recorded as golden) provides `createScriptedTransport(session)`: roles return deterministic outputs (the extractor echoes the parser's events, the planner returns a fixed plan, the narrator returns the template text) and `step` plays a scripted actor: it reads the previous `functionResponse` data and emits (Procedure A) `get_rhythm_baseline` + `list_devices`; `reconcile_webhook_gap` per device with `overlapMinutes: 0`; `compare_to_baseline` for days 7–13 in one turn; `open_incident` per finding (args copied from the finding) in one turn; `add_incident_note` per opened incident; `check_week_model`; a final text. For Procedure B it applies each error issue's `fix`, then `check_week_model`, then a final text. For Procedure C it calls `propose_family_nudge`, `export_weekly_brief`, `play_chime_announcement`, then a final text. It is how WU-06 and the later plans test the orchestrator without a model.

### §5.14 Floors, manifest and the trace validator
`checkFloors(trace)`: `summary = summarizeTrace(trace.entries)`; `modelEntries = summary.model_calls`; problems list one sentence per unmet floor: fewer than `FLOORS.minModelEntries` model entries, fewer than 4 distinct roles among `extractor, planner, actor, narrator`, `verify_repair_rounds < 1`, `human_checkpoints < 1`, or `final_truth?.errors !== 0`. `scripts/export-manifest.ts` builds a session over the demo seed and writes `actions.manifest.json` = `session.registry.exportManifest()` (the kit's shape, including `contract_hash`) and prints `manifest: 21 actions, hash <first 12 hex>`; `--check` fails when the committed file differs. The kit's validator is the one authority on trace shape: `npx vite-node hee/scripts/hee-validate-run-trace.ts <trace> --min-roles 4 --min-actions 15 --require-verify-repair --require-human-checkpoint`.

### §5.15 `createAppSession` and `actionFields`
`createAppSession(opts)` = `createSession({ ...opts, procedures: ACTOR_PROCEDURES, registrar: (core) => registerDoorstepActions(core) })`. `actionFields(session, name)` finds the descriptor in `session.registry.list()` and flattens `inputSchema.properties` into `{ name, type: (Array.isArray(type) ? type.join("|") : type), enum, description, required }` for DP-UI's manual runner (`required` from `inputSchema.required`). Importing this file must not import any server-only module.

## §6 Failure modes
| Failure | What the code does | What the person sees |
|---|---|---|
| Bedrock credentials missing or access denied | `generate` returns `ok:false`; `withResilience` retries once, then the fallback chain | banner "Fallback model (not Bedrock)" when allowed, else "Replaying a recorded run", else the manual runner |
| Throttling | one retry with backoff, then as above | the banner above, with the reason in its detail line |
| Strands result shape differs | adapter returns `ok:false`; the Converse forced-tool runner answers | nothing (internal) |
| Model returns invalid JSON | one repair round, then a degraded result for that role | planner → default plan; extractor → built-in reader; narrator → template; each noted in the phase detail |
| Banned vocabulary or an ungrounded number in narration | one rewrite, then the template | the template sentence |
| A model invents an id or timestamp | the parser's value wins, the event is counted `corrected` or dropped | none; the trace decision records the counts |
| Cost sidecar missing | degraded counter | cost chip reads "approximate" |
| Actor loop hits its turn limit | `stopped: "max_steps"`; repair or system repair follows | the phase detail says what ran |
| Human rejects an approval | the registry returns `The human declined "<summary>". Ask what to do instead.` | the feed shows the rejection; the agent says what it did instead |
| Consent off | preflight refusal before the gate | the refusal sentence in the feed |
| Golden cache has no entry | `golden_cache_miss` degraded result | banner "The recorded run is incomplete", manual runner stays usable |
| Ring snapshot fails | incident opens without media | the incident card shows "no snapshot" with the reason |

## §7 Work units

Every verify script is `scripts/verify/aw-NN-<name>.ts`, run as `npx vite-node scripts/verify/<file>`. It runs its numbered checks in order with a local `assert(cond, message)`; a failed check prints `FAIL: <message>` and exits 1; when all pass it prints exactly `<file stem>: N checks OK`. Scripts that need files use a fresh temporary directory (`os.tmpdir()`), never the committed `data/golden-cache/`, except WU-09.

### WU-AGENT-WORKFLOW-01 — dependencies, model discovery, Bedrock client, probes **[offline checks, live probes]**
- **Goal:** pinned dependencies resolve; `discoverModels` and `createBedrockClient` work against stubs; the two live probes exist for the operator.
- **Steps:**
  1. `npm install --save-exact @strands-agents/sdk@1.19.0 @aws-sdk/client-bedrock-runtime@3.1146.0 @aws-sdk/client-bedrock@3.1146.0 zod@4.6.5`.
  2. Write `src/llm/model-discovery.ts` (§3.1, §5.1) and `src/llm/bedrock-client.ts` (§3.2, §5.2).
  3. Write `scripts/probe-bedrock.ts` (prints `bedrock: ok model=<id> region=<region> latencyMs=<n>` after one `generate` of "Reply with the single word ok.", or `bedrock: FAILED <error name>: <message>`) and `scripts/probe-strands.ts` (prints `strands: structuredOutput=ok usage=found` or `usage=absent`, plus the list of the result's own keys, or `strands: FAILED <message>`). Run both when credentials exist; on failure quote the line in the unit's notes and follow the §0 fallback rule.
  4. Write `scripts/verify/aw-01-bedrock.ts` with stub `send` and stub `listCandidates` (fixtures: names "Claude Sonnet 4", "Claude Sonnet 4.5", "Claude Haiku 4.5", "Claude Opus 4.1", "Nova Pro", "Nova Lite", one inactive Sonnet 9).
- **Files:** `package.json`, `src/llm/model-discovery.ts`, `src/llm/bedrock-client.ts`, `scripts/probe-bedrock.ts`, `scripts/probe-strands.ts`, `scripts/verify/aw-01-bedrock.ts`.
- **Checks (15):**
  1. `node_modules/@strands-agents/sdk/package.json` version is `1.19.0`.
  2. `@aws-sdk/client-bedrock-runtime` version is `3.1146.0`.
  3. `@aws-sdk/client-bedrock` version is `3.1146.0`.
  4. `zod` version is `4.6.5`.
  5. `rankCandidates(fixtures, "balanced")` returns the Sonnet 4.5 id (highest active Sonnet).
  6. `rankCandidates(fixtures, "fast")` returns the Haiku 4.5 id.
  7. Opus and the inactive Sonnet never win either tier.
  8. `discoverModels({ env: { BEDROCK_MODEL_ID: "x-model", AWS_REGION: "eu-west-1" } })` returns `{ fast: "x-model", balanced: "x-model", source: "env", region: "eu-west-1" }`.
  9. `discoverModels` with stub candidates returns `source: "discovery"` and the region default `us-east-1` when `AWS_REGION` is unset.
  10. The source text of `src/llm/*.ts` contains no literal that matches `/(anthropic|amazon)\.(claude|nova)/i` (no hardcoded model id).
  11. `discoverModels` with no candidates rejects with a message starting `No invocable text model is visible in`.
  12. `toConverseInput` merges two consecutive user turns into one message and prepends a user turn when the first content is a model turn.
  13. A `functionCall` in turn 2 and its `functionResponse` in turn 3 receive the same `toolUseId` (`tu-1-0`).
  14. With `responseSchema`, the input has a tool named `emit_result` and `toolChoice.tool.name === "emit_result"`, and `fromConverseOutput` of a stub reply returns that tool input as `json` with the usage mapped to `promptTokens/outputTokens/totalTokens`.
  15. `generate` with a `send` that throws an error named `ThrottlingException` returns `{ ok:false, reason:"ThrottlingException", retryable:true }`.
- **Verify:** `npx vite-node scripts/verify/aw-01-bedrock.ts`
- **Expected output:** `aw-01-bedrock: 15 checks OK`
- **Proves:** the model ids are discovered, never typed, and the Converse mapping pairs tool calls with their answers correctly.

### WU-AGENT-WORKFLOW-02 — cost sidecar, banned-vocabulary guard, context fitting **[offline]**
- **Goal:** metering, vocabulary guard and context fitting exist and fail soft.
- **Steps:** write `config/cost.json`, `scripts/cost_sidecar.py`, `src/llm/cost.ts` (§3.5, §5.4); `scripts/sync-banned-words.ts`, run it once to create `config/banned-patterns.json`, `src/llm/guard.ts` (§5.5); `src/llm/context.ts` (§5.6); first run `python3 -c "from src.cost import create_cost_store; print('cost ok')"` and expect `cost ok`; then write the verify script.
- **Files:** `config/cost.json`, `scripts/cost_sidecar.py`, `src/llm/cost.ts`, `scripts/sync-banned-words.ts`, `config/banned-patterns.json`, `src/llm/guard.ts`, `src/llm/context.ts`, `scripts/verify/aw-02-wrappers.ts`.
- **Checks (15):**
  1. `config/banned-patterns.json` has a string `version` and at least 2 patterns, each of which compiles as a `RegExp`.
  2. No pattern id in it belongs to an entry that has a `presets` field in the chassis list without `"ui"`.
  3. For each chassis entry without `presets`, every string in its `examples` makes `bannedHits` non-empty (examples are read from the chassis file by the script, not typed in).
  4. `bannedHits("A calm note about Tuesday.")` is `[]`.
  5. `guardCopy` of clean text returns it unchanged with `rewritten:false`.
  6. `guardCopy` of dirty text with a clean rewrite returns the rewrite, `rewritten:true`, `usedTemplate:false`.
  7. A dirty rewrite returns the template with `usedTemplate:true`.
  8. A throwing rewrite returns the template.
  9. `fitTurns` of a 5-turn history with the default window returns the same array and `evicted: 0`.
  10. `fitTurns` with `contextWindow: 400, reservedOutput: 100` and a long history evicts at least one unit and keeps the first user turn.
  11. After that eviction, every kept model turn that holds a `functionCall` is immediately followed by a user turn holding a `functionResponse`.
  12. `createCostClient().guard` with 1000 prompt and 500 output tokens returns `summary.totalTokens === 1500`, `usedPct === 0.3`, `degraded === false`.
  13. A further call of 480000 tokens makes `summary.warning === "warning"`.
  14. `reset()` returns `usedPct === 0`.
  15. With `sidecarPath` pointing at a missing file, `guard` still returns the call's result, `summary().degraded === true` and `summary().text` starts with `Approximate usage:`; a `call` that throws rejects with its own error and records nothing.
- **Verify:** `npx vite-node scripts/verify/aw-02-wrappers.ts`
- **Expected output:** `aw-02-wrappers: 15 checks OK`
- **Proves:** metering never blocks a model call, banned words never pass the guard, and a history is never cut between a tool call and its answer.

### WU-AGENT-WORKFLOW-03 — schemas, prompts, generated JSON Schemas **[offline]**
- **Goal:** the schemas and the four literal prompts exist exactly as in §5.7–§5.8.
- **Steps:** write `src/agent/schemas.ts` (§3.8, §5.7), the five files under `src/prompts/` (§3.9, §5.8), `scripts/gen-schemas.ts`; run `npx vite-node scripts/gen-schemas.ts` once to create the three JSON Schema files; write the verify script.
- **Files:** `src/agent/schemas.ts`, `src/prompts/{extractor,planner,actor,narrator,index}.ts`, `scripts/gen-schemas.ts`, `engine/schema/{extractor-output,review-plan,narration}.schema.json`, `scripts/verify/aw-03-schemas.ts`.
- **Checks (14):**
  1. `ExtractorOutputSchema` accepts one valid event with `subType: null`.
  2. It rejects `type: "doorbell"`.
  3. It rejects `componentId: -1`.
  4. `ReviewPlanSchema` accepts a 4-step plan.
  5. It rejects a 2-step plan.
  6. It rejects `focusDays: [6]`.
  7. `NarrationSchema` rejects an `explanation` of 321 characters.
  8. It rejects `tone: "alarm"`.
  9. `npx vite-node scripts/gen-schemas.ts --check` exits 0 (spawned).
  10. Each of the three schema files parses and has `$schema` containing `2020-12` and `type: "object"`.
  11. `PROMPT_VERSION === "doorstep-prompts-1"`.
  12. The four prompt strings are non-empty and `bannedHits` finds nothing in any of them.
  13. `ACTOR_PROCEDURES` has 3 entries named `review_week`, `repair_errors`, `prepare_family_update` with 6, 3 and 4 steps.
  14. `ACT_GOAL("PLAN")` contains `PLAN`, `REPAIR_GOAL` contains `check_week_model`, `CHECKPOINT_GOAL("Dana")` contains `Dana`.
- **Verify:** `npx vite-node scripts/verify/aw-03-schemas.ts`
- **Expected output:** `aw-03-schemas: 14 checks OK`
- **Proves:** the model contracts are validated by code and the committed JSON Schemas match the zod source.

### WU-AGENT-WORKFLOW-04 — role runners **[offline with stubs]**
- **Goal:** `createRoleRunners` per §5.3 with Strands primary, Converse forced-tool fallback, labelled Vertex secondary, golden cache rung.
- **Steps:** write `src/llm/strands-adapter.ts` (§3.3; usage from `result.metrics?.accumulatedUsage` when present, else zeros), `src/llm/vertex-fallback.ts` (§3.4), `src/llm/roles.ts` (§3.10, §5.3); write the verify script with stub `StrandsAdapter`, stub `BedrockClient`, stub `VertexFallback`, a spy `CostClient`, and a temporary `createGoldenCache(tmpdir)`.
- **Files:** `src/llm/strands-adapter.ts`, `src/llm/vertex-fallback.ts`, `src/llm/roles.ts`, `scripts/verify/aw-04-roles.ts`.
- **Checks (14):**
  1. Extractor via the Strands stub returns `ok:true`, `kind:"bedrock"`, `model` equal to the fast model id.
  2. Planner uses the balanced model id.
  3. The narrator's `system` captured by the stub ends with a line starting `Never use words that match any of these patterns:`.
  4. When the Strands stub returns `ok:false`, the Bedrock stub's `generate` is called with a `responseSchema` and the outcome is `ok:true`.
  5. Invalid JSON from the first `generate` and valid JSON from the second gives `ok:true` and exactly 2 `generate` calls.
  6. Two invalid replies with no fallback and an empty cache give `ok:false` with `degraded.reason` `primary_failed`.
  7. With `allowFallback: true` and a Vertex stub, a failing Bedrock gives `ok:true`, `kind:"vertex-fallback"`.
  8. With `allowFallback: false`, the Vertex stub is never called.
  9. With both failing and a pre-put cache entry `doorstep-role-extractor-1`, the outcome is `ok:true`, `kind:"golden"`.
  10. A pre-put entry whose `value` fails the schema gives `ok:false` with `degraded.reason === "golden_entry_invalid"`.
  11. With `recordGolden: true`, a primary success stores `doorstep-role-<key>` with `via:"recorded"`, `provider:"bedrock"` and `promptVersion` equal to `PROMPT_VERSION`.
  12. The cost spy saw `{ provider:"bedrock", label:"extractor" }` for an extractor call.
  13. With `resilience: { forced_degraded: true }`, the primary stub is never called and the outcome is degraded (proof that `withResilience` is in the path).
  14. The Strands stub received `maxTokens` 8192 for the extractor, 1500 for the planner and 600 for the narrator.
- **Verify:** `npx vite-node scripts/verify/aw-04-roles.ts`
- **Expected output:** `aw-04-roles: 14 checks OK`
- **Proves:** every model call goes through `withResilience`, validates its output, and degrades visibly through the full ladder.

### WU-AGENT-WORKFLOW-05 — the 20 actions and their preflights **[offline]**
- **Goal:** `registerDoorstepActions` registers the 20 descriptors of §5.9 with the handlers and preflights described there.
- **Steps:** write `src/agent/brief.ts` (§5.10), `src/agent/actions.ts` (§3.11, §5.9) and a minimal `src/agent/app-session.ts` (§5.15, `actionFields` included); write the verify script over `createAppSession({ initial: demoSeed(), ring: createBundleRingPort() })`.
- **Files:** `src/agent/brief.ts`, `src/agent/actions.ts`, `src/agent/app-session.ts`, `scripts/verify/aw-05-actions.ts`.
- **Checks (26):**
  1. `session.registry.list().length` is 21.
  2. The descriptor names minus `get_capabilities` equal `ACTION_NAMES` as sets, and `ACTION_NAMES.length` is 20.
  3. `lintDescriptor` returns no problem for every descriptor.
  4. Group counts are read 6, change 5, verify 2, navigate 3, collaborate 2, cross_boundary 2.
  5. The destructive actions are exactly `play_chime_announcement` and `export_weekly_brief`.
  6. Every token in `ACTOR_PROMPT` matching `\b(list|get|ingest|merge|reconcile|open|set|check|compare|focus|add|propose|play|export)_[a-z_]+\b` is a member of `ACTION_NAMES` or is `get_capabilities`.
  7. `get_capabilities` returns 3 procedures and a `contract_hash` of 64 hex characters.
  8. No registered action name contains `consent`.
  9. `list_week_events({ deviceId: "nope" })` returns `ok:false` and `error.next` contains `list_devices`.
  10. `ingest_ring_events({ source: "history" })` returns `ok:false` with a message containing `Pass deviceId`.
  11. In a fresh session, `ingest_ring_events({ source: "webhook_inbox" })` adds events and `model.webhookLedger.length` equals the inbox size.
  12. `ingest_ring_events({ source: "history", deviceId: "dev-door", sinceMs: <last webhook − 600000> })` leaves at least one duplicate cluster.
  13. `merge_duplicate_events` on that cluster's ids leaves zero clusters, and repeating it returns `ok:false`.
  14. `reconcile_webhook_gap({ deviceId: "Hall camera", overlapMinutes: 0 })` (a name, not an id) adds events and leaves the duplicate-cluster count unchanged.
  15. Repeating it reports `0` new events (`already known`).
  16. In a fresh census session (ingest the inbox; ingest `dev-door` history from the last webhook − 600000 ms; `reconcile_webhook_gap` for `dev-elite` with `overlapMinutes: 0`), `compare_to_baseline({ day: 8 })` has a `quiet_hours_activity` finding with non-empty `eventIds`, `day: 11` has a `missed_routine` finding with `eventIds: []`, and `day: 10` has a `device_outage` finding.
  17. In that session `open_incident` with a finding's fields returns `ok:true`, status `open`, and one media item whose label starts `Snapshot ·`.
  18. The same call again returns `ok:false` and a message containing `already exists`.
  19. After opening all three findings, `check_week_model` returns `data.truth.errors === 1` and its only error issue has `fix.action === "merge_duplicate_events"`.
  20. `focus_incident` sets `ui.selectedIncidentId` and `ui.shotId` equal to `focus:<id>`; `set_camera_shot({ shot: "focus" })` without an incident returns `ok:false`.
  21. With `family_message` consent revoked by a human `set_consent`, `propose_family_nudge` returns `ok:false` containing `Consent panel`; granted, it returns `ok:true` and one nudge with status `proposed`.
  22. With `chime_announcement` not granted, `play_chime_announcement` returns `ok:false` containing `Chime announcements are off` and `session.gate.pending().length` is 0.
  23. After a human grants it, the agent's call stays pending (`gate.pending().length === 1`); approving it resolves `ok:true`, and the nudge ends with status `sent` (the bundle port's `playChime` is `simulated`).
  24. Rejecting a second call resolves `ok:false` with summary exactly `The human declined "play a gentle chime on the Front door". Ask what to do instead.`
  25. `export_weekly_brief({ includeNotes: true })` after approval returns `data.brief.title` starting `Week of`; `bannedHits` over the brief body is `[]`.
  26. `actionFields(session, "open_incident")` marks `kind`, `title`, `eventIds`, `startMs`, `endMs` as required, and for `play_chime_announcement` lists `audioRef` with 2 enum values.
- **Verify:** `npx vite-node scripts/verify/aw-05-actions.ts`
- **Expected output:** `aw-05-actions: 26 checks OK`
- **Proves:** the action surface is typed and linted, the consent boundary refuses before the gate, and a human decision gates every cross-boundary action.

### WU-AGENT-WORKFLOW-06 — the week-review orchestrator **[offline with the scripted transport]**
- **Goal:** `runWeekReview` per §5.12 with floors per §5.14.
- **Steps:** write `src/agent/floors.ts`, `src/agent/orchestrator.ts` (§3.13, §5.12), `scripts/verify/scripted-transport.ts` (§5.13, with switches to force a degraded planner, a wrong extractor timestamp, a dirty narrator reply, an ungrounded narrator number, and a failing `step`); write the verify script.
- **Files:** `src/agent/floors.ts`, `src/agent/orchestrator.ts`, `scripts/verify/scripted-transport.ts`, `scripts/verify/aw-06-orchestrator.ts`.
- **Checks (20):**
  1. A scripted run over `createAppSession({ initial: demoSeed(), ring: createBundleRingPort() })` returns `ok:true`.
  2. The phases reported through `onPhase` are exactly `load, perceive, plan, act, verify, repair, explain, checkpoint, finish`, in that order.
  3. `counts.errorsAfterPerceive` is 3.
  4. `counts.errorsAfterAct` is 1.
  5. `counts.errorsAfterRepair` is 0 and `counts.warningsAfterRepair` is 3.
  6. `counts.incidentsOpened` is 3.
  7. The extractor is called at least twice, the planner once and the narrator 3 times.
  8. The trace's `model_roles` are `actor, extractor, narrator, planner`.
  9. `counts.modelCalls` is at least 15.
  10. `floors.ok` is true and `floors.problems` is empty.
  11. After the run every incident has status `explained` and a non-empty `summary`.
  12. The trace holds one approved approval and a failed `play_chime_announcement` action whose output mentions `Chime announcements are off`.
  13. With `autoDecide: "reject-first-then-approve"`, the trace holds one rejected approval and the matching action's output contains `The human declined`.
  14. A scripted extractor that returns a wrong `tsMs` for one record: the ingested event keeps the parser's `tsMs`.
  15. A planner returning `ok:false` makes the phase detail contain `used the default plan`, `degraded.length` is 1 and the run is still `ok:true`.
  16. A dirty narrator reply followed by a dirty rewrite ends with the template sentence as the incident summary, and `bannedHits` on it is `[]`.
  17. A narrator reply with a number that is not in the facts ends with the template sentence.
  18. A failing scripted `step` in the act phase returns `ok:false` with `stoppedAt: "act"`.
  19. A manual transport returns `ok:false`, `stoppedAt: "load"`, and leaves `trace.entries()` empty.
  20. `fetchRawHistorySince(ring, "dev-door", since)` returns items sorted ascending, all at or after `since`, with at most 3 `getEventHistory` calls (counted with a wrapper).
- **Verify:** `npx vite-node scripts/verify/aw-06-orchestrator.ts`
- **Expected output:** `aw-06-orchestrator: 20 checks OK`
- **Proves:** the seven-stage graph runs end to end, verify→repair drops the error count to zero, and every model output is checked by code before it changes the record.

### WU-AGENT-WORKFLOW-07 — agent transports **[offline with stubs]**
- **Goal:** `createInProcessTransport`, `createGoldenTransport`, `createManualTransport` per §5.11.
- **Steps:** write `src/agent/transport.ts`; write the verify script with stub Bedrock, Vertex and cache in a temporary directory.
- **Files:** `src/agent/transport.ts`, `scripts/verify/aw-07-transport.ts`.
- **Checks (11):**
  1. In-process `step` with a Bedrock stub returning one function call yields `ok:true`, `result.functionCalls.length === 1`, `kind === "bedrock"`.
  2. When Bedrock and the secondary fail, `step` returns `{ ok:false, status:502 }`.
  3. With `allowFallback` and a Vertex stub, a failing Bedrock switches `kind` to `"vertex-fallback"` and `onRungChange` fires exactly once with label `Fallback model (not Bedrock)`.
  4. With `allowFallback: false` the Vertex stub is never called.
  5. With `recordGolden`, two steps store `doorstep-step-001` and `doorstep-step-002` with `via:"recorded"` and a string `inputHash`.
  6. The golden transport serves them in order, `remaining()` goes 2 → 1 → 0, and a third call returns `status: 502` with `The recorded run has no further steps.`
  7. A step whose last turn differs from the recorded one is still served and `drift()` becomes 1.
  8. Golden `role()` serves a stored role entry and returns `golden_cache_miss` for a key that was never stored.
  9. The manual transport has `kind: "manual"`; `role()` returns `degraded.reason === "manual_mode"`; `step()` returns `status: 503` and a message containing `Use the action runner`.
  10. The four labels equal `Amazon Bedrock · <model id>`, `Fallback model (not Bedrock)`, `Recorded run`, `Manual`.
  11. `createGoldenTransport({ dir: <missing directory> })` does not throw and every `role()` call returns a degraded miss.
- **Verify:** `npx vite-node scripts/verify/aw-07-transport.ts`
- **Expected output:** `aw-07-transport: 11 checks OK`
- **Proves:** the degraded ladder has four labelled rungs and a recorded run replays in order.

### WU-AGENT-WORKFLOW-08 — app session and manual runner **[offline]**
- **Goal:** `createAppSession` is the composition root; every action is runnable by a person with no model.
- **Steps:** finalise `src/agent/app-session.ts`; write the verify script.
- **Files:** `src/agent/app-session.ts` (completed), `scripts/verify/aw-08-app-session.ts`.
- **Checks (8):**
  1. `createAppSession` registry lists 21 entries and `get_capabilities` names the 3 procedures `review_week`, `repair_errors`, `prepare_family_update`.
  2. Two sessions are isolated: a `set_ui` in one leaves the other's `ui` unchanged.
  3. `actionFields` returns a field list for all 20 actions without throwing.
  4. A table of minimal arguments runs the 6 read actions, 2 verify actions and `focus_day`, `set_camera_shot({shot:"overview"})` through `session.call(..., { source: "human" })` with `ok:true` for each.
  5. After a human grants `chime_announcement`, a human-source `play_chime_announcement` runs with no pending approval (the human's click is the approval) and returns `ok:true`.
  6. The same call with `source: "agent"` is held at the gate.
  7. Trace entries for the human calls have `source: "human"`.
  8. `session.reset()` restores the demo seed (`store.revision() === 0`) and empties the trace.
- **Verify:** `npx vite-node scripts/verify/aw-08-app-session.ts`
- **Expected output:** `aw-08-app-session: 8 checks OK`
- **Proves:** the product is complete without a model, and `/` and `/watch` can each own an isolated session.

### WU-AGENT-WORKFLOW-09 — record the golden cache from a real run and replay it **[live recording, offline verification]**
- **Goal:** `data/golden-cache/` holds one real recorded run; the golden transport replays it with no network.
- **Steps:**
  1. Write `scripts/record-golden.ts` and `scripts/run-review.ts` (§5.13).
  2. With Bedrock credentials in the environment, run `npx vite-node scripts/record-golden.ts`. Expected final line: `recorded: bedrock <model id> steps=<N> roles=3`. If Bedrock is unreachable, quote the probe's error, then run `AGENT_ALLOW_FALLBACK=1 npx vite-node scripts/record-golden.ts --allow-fallback`; the final line is then `recorded via fallback: vertex-fallback <model id> steps=<N> roles=3` and the metadata keeps `provider: "vertex-fallback"`.
  3. If a recording fails its floors, run it again (the model is not deterministic); after three failed attempts, lower nothing — report the failing floor in the unit's notes and stop.
  4. Commit `data/golden-cache/**` (entries contain recorded model output only: no credentials, no tokens).
  5. Write the verify script.
- **Files:** `scripts/record-golden.ts`, `scripts/run-review.ts`, `data/golden-cache/**`, `scripts/verify/aw-09-golden.ts`.
- **Checks (10):**
  1. `data/golden-cache/doorstep-meta.json` exists and its `provider` is `bedrock` or `vertex-fallback`.
  2. Its `promptVersion` equals `PROMPT_VERSION`.
  3. `meta.roles.extractor` is at least 2, `planner` is 1, `narrator` is 3.
  4. A replay with the golden transport over `createAppSession({ initial: demoSeed(), ring: createBundleRingPort() })` returns `ok:true`.
  5. `transport.remaining()` is 0 after the replay.
  6. `transport.drift()` is 0.
  7. `counts.errorsAfterAct` is 1, `errorsAfterRepair` is 0 and `warningsAfterRepair` is 3 (same census as WU-06).
  8. `floors.ok` is true.
  9. A second replay returns an identical `counts` object (deterministic).
  10. The replayed trace saved to a temporary file passes `npx vite-node hee/scripts/hee-validate-run-trace.ts <file> --min-roles 4 --min-actions 15 --require-verify-repair --require-human-checkpoint` (spawned, exit 0).
- **Verify:** `npx vite-node scripts/verify/aw-09-golden.ts`
- **Expected output:** `aw-09-golden: 10 checks OK`
- **Proves:** a real recorded run replays offline with the same census, so the demo survives any outage.

### WU-AGENT-WORKFLOW-10 — floors, manifest and the end-to-end headless proof **[offline]**
- **Goal:** the trace floors, the action manifest and one headless run are frozen as regression guards.
- **Steps:** write `scripts/export-manifest.ts` (§5.14), run it to create `actions.manifest.json`; add `npm` scripts `agent:review` (`vite-node scripts/run-review.ts --transport golden`) and `agent:manifest` (`vite-node scripts/export-manifest.ts --check`); write the verify script.
- **Files:** `scripts/export-manifest.ts`, `actions.manifest.json`, `package.json` (scripts), `scripts/verify/aw-10-floors.ts`.
- **Checks (8):**
  1. `npx vite-node scripts/export-manifest.ts --check` exits 0 (spawned) and prints a line starting `manifest: 21 actions, hash `.
  2. `actions.manifest.json` has `version: "1.0.0"`, 21 `actions` and 3 `procedures`.
  3. `checkFloors` on a trace with 14 model entries reports a problem naming the model-entry floor.
  4. `checkFloors` on a trace with three roles reports a problem naming the role floor.
  5. `checkFloors` on a trace whose last truth entry has errors 1 reports a problem naming the final error count.
  6. `checkFloors` on the scripted-run trace (WU-06 helper) is `ok:true`.
  7. `npx vite-node scripts/run-review.ts --transport golden` (spawned) prints a line matching `^review: ok=true rung=golden modelCalls=\d+ errors 3→1→0 warnings=3$`.
  8. The spawned process exits 0.
- **Verify:** `npx vite-node scripts/verify/aw-10-floors.ts`
- **Expected output:** `aw-10-floors: 8 checks OK`
- **Proves:** the contract hash, the floors and the replayed census are checked in CI-style, not by eye.

## §8 Verification summary
| WU | Command | Expected |
|---|---|---|
| 01 | `npx vite-node scripts/verify/aw-01-bedrock.ts` | `aw-01-bedrock: 15 checks OK` |
| 02 | `npx vite-node scripts/verify/aw-02-wrappers.ts` | `aw-02-wrappers: 15 checks OK` |
| 03 | `npx vite-node scripts/verify/aw-03-schemas.ts` | `aw-03-schemas: 14 checks OK` |
| 04 | `npx vite-node scripts/verify/aw-04-roles.ts` | `aw-04-roles: 14 checks OK` |
| 05 | `npx vite-node scripts/verify/aw-05-actions.ts` | `aw-05-actions: 26 checks OK` |
| 06 | `npx vite-node scripts/verify/aw-06-orchestrator.ts` | `aw-06-orchestrator: 20 checks OK` |
| 07 | `npx vite-node scripts/verify/aw-07-transport.ts` | `aw-07-transport: 11 checks OK` |
| 08 | `npx vite-node scripts/verify/aw-08-app-session.ts` | `aw-08-app-session: 8 checks OK` |
| 09 | `npx vite-node scripts/verify/aw-09-golden.ts` | `aw-09-golden: 10 checks OK` |
| 10 | `npx vite-node scripts/verify/aw-10-floors.ts` | `aw-10-floors: 8 checks OK` |
If an exact count differs because a check was split or merged while writing the script, change the number in the unit and in this table in the same edit; the check list in the unit is the source.

## §9 Risks
- **Strands result shape.** `structuredOutput` is documented, usage fields may differ. Mitigation: WU-01 probe; the Converse forced-tool runner answers when the adapter fails; zeros are reported rather than invented.
- **Model drift between recording and replay.** The golden cache stores outputs, not prompts; changing a prompt or an action description makes a recording stale. Mitigation: `promptVersion` in the metadata (WU-09 check 2); after any change to `src/prompts/*` or `src/agent/actions.ts`, run `scripts/record-golden.ts` again and WU-09 and WU-10.
- **Actor does not follow the procedure live.** Mitigation: findings carry exact arguments; the repair loop applies fixes verbatim; the system repair step guarantees zero errors; floors are checked on every recording.
- **Bedrock model access is per account and region.** Mitigation: `discoverModels` lists what is visible; `BEDROCK_MODEL_ID` overrides; the labelled Vertex rung and the recorded rung keep the demo alive.
- **Python missing at run time.** Mitigation: degraded counter, chip reads "approximate"; the Dockerfile (DP-DEPLOY) installs python3.
- **Cost.** One live review is about 20 model entries; the budget in `config/cost.json` allows several runs and warns at 80%.
