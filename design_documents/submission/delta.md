# What was built in the submission window

The submission window opened on 2026-08-31. Doorstep Rhythm was started inside it, as a new project on a reusable hackathon scaffold. Nothing in this repository was submitted to another event.

## Reused scaffolding

- `context` — a message buffer that keeps a conversation inside a model's context window
- `cost` — code that counts token and request usage and warns before a configured budget is exceeded
- `ideation` — developer tooling used to prepare the submission's documents
- `pgm` — developer tooling used to prepare the submission's documents
- `platform` — a typed event-streaming bus for pushing step-by-step progress to the browser, plus a one-command deploy helper and a small themed UI shell
- `profile` — developer tooling used to prepare the submission's documents
- `provenance` — developer tooling used to prepare the submission's documents
- `resilience` — a wrapper that retries a slow or failed provider call and falls back to a cached response

The full list, the scaffold version and the AI tools that helped are in `disclosure.md`.

## Built in the window

- `e2e` — The single owner of everything that proves the product works the way a person will use it: a Playwright harness that boots the real server and the built UI, one scenario file per use case, the nine mandated-technology scenarios `S-RING-1…9` plus the live Bedrock probe, the re-runnable smoke gate that the deploy plan, DP-SCRIPT and DP-LIVE-RUN-AND-VIDEO all call, the depth acceptance, the 3D acceptance, the repository hygiene, the fix loop, the agent-surface evaluation and the architecture proof harvest.
- `scripts` — The single owner of everything between "it passes in the browser on this machine" and "a judge can open it": the container image, the deploy script that wires the chassis Docker adapter to Google Cloud Run, the Secret Manager wiring, the deploy record that lives outside the repository, and the gate that runs DP-E2E-BROWSER-TESTING's `e2e/smoke.spec.ts` and `e2e/depth.spec.ts` against the deployed URL and fails the deploy when either is red.
- `src/3d` — The single owner of the entry's signature 3D view: the scene description built from the domain model, the mapping of DP-UI's tokens onto materials, the live binding in both directions, the named camera shots, the recorder hooks, the `/lab` tuning page, the capability fallback, the performance probe and the vision-review loop.
- `src/agent` — Owner of: model discovery, the Bedrock client, the cost and guard wrappers, the four model roles with their literal prompts and schemas, the 20 registered agent actions, the week-review orchestrator, the agent transports (in-process, golden replay), `createAppSession`, the golden cache recording and the trace-floor validator.
- `src/domain` — Owner of: every domain type, the one store, the 17 store actions, the 7 truth rules, the deterministic synthetic generator and bundle, the `RingPort` interface with its bundle implementation, and the session composition (`createSession`).
- `src/kits` — Owner of: every domain type, the one store, the 17 store actions, the 7 truth rules, the deterministic synthetic generator and bundle, the `RingPort` interface with its bundle implementation, and the session composition (`createSession`).
- `src/llm` — Owner of: model discovery, the Bedrock client, the cost and guard wrappers, the four model roles with their literal prompts and schemas, the 20 registered agent actions, the week-review orchestrator, the agent transports (in-process, golden replay), `createAppSession`, the golden cache recording and the trace-floor validator.
- `src/prompts` — Owner of: model discovery, the Bedrock client, the cost and guard wrappers, the four model roles with their literal prompts and schemas, the 20 registered agent actions, the week-review orchestrator, the agent transports (in-process, golden replay), `createAppSession`, the golden cache recording and the trace-floor validator.
- `src/ring` — Owner of everything that talks to Ring from Node: signature check, webhook handler and inbox, OAuth token provider, rate-limited REST client, `LiveRingPort`, account linking, the wire constants and samples, and a local contract server that imitates Ring (always labelled *simulated*).
- `src/server` — Owner of the one server process: the Express app, the SSE event hub, every route in blueprint §2.6, per-session Ring port selection and the in-memory Playground-token store, the agent service that picks and steps down the model rung, the two browser-safe clients (`HttpRingPort`, `HttpAgentTransport`), the proof log, and the `architecture.json` skeleton with its proof-harvest script.
- `src/ui` — The single owner of the entry's visual identity and of every pixel the family member sees on `/`.
