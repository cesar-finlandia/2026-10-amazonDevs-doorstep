# Product feedback

<!-- live-check:start -->
Observed on 2026-10-12
- probeBedrock: ok — balanced tier discovered in us-east-1 (evidence: logs/proof.log)
- listDevices: not run: no Ring credentials in the environment (RING_ACCESS_TOKEN or the refresh trio absent) — Ring observations need a live account; the film uses the recorded sample week (evidence: video/live-observations.json)
- getEventHistory: not run: no Ring credentials in the environment (RING_ACCESS_TOKEN or the refresh trio absent) — Ring observations need a live account; the film uses the recorded sample week (evidence: video/live-observations.json)
- webhookDelivery: not run: no Ring credentials in the environment (RING_ACCESS_TOKEN or the refresh trio absent) — Ring observations need a live account; the film uses the recorded sample week (evidence: video/live-observations.json)
- agentReview: ok — rung bedrock, 23 model calls, phases load>perceive>plan>act>verify>repair>explain>checkpoint>finish, review ok (evidence: logs/proof.log)
<!-- live-check:end -->

## Ring REST API and OAuth
### Used for
Device discovery, status, capabilities, location, configurations and event history through `src/ring/live-ring-port.ts`, with the endpoint shapes collected in `src/ring/wire.ts`.
### What worked
The contract server round-trips every read path, and the mock-backed suite stays green, so discovery through history behaves the same in tests and against the documented shapes.
### What needs work
- The organizer's flat webhook sample parses to nothing while the canonical shape parses, so payloads must be normalized before anything else reads them (evidence: FL-1)
- The committed contract once asked for a sixty-second clip while the plan bounds clips at half a minute, so clip ranges need agreeing before a download is attempted (evidence: FL-3)
### Zero to hello-world
1. Create a Ring Developer Portal app and keep its credentials outside the repository.
2. Run the steps of `scripts/probe-ring.ts` to list devices.
3. Read one device status through `src/ring/live-ring-port.ts`.
4. Page one event-history window for the same device.
### Would I build with it again
Yes, because the documented shapes plus the mock server made every read path testable without owning hardware.

## Ring webhooks
### Used for
Signed HTTPS delivery of motion, button, presence and integration events into `src/ring/webhook.ts`, verified with HMAC-SHA256 before any processing and answered inside five seconds.
### What worked
All nine mandated-technology scenarios pass against the mock server, and duplicate deliveries collapse on the request id, so redeliveries never double-count a moment.
### What needs work
- The flat `event_type` sample needs the tolerant normalizer or it never ingests, which cost a debugging pass against the documented shape (evidence: FL-1)
- A hosted copy cannot receive webhooks during a demo, so the simulated-delivery route through the same verifier has to exist before filming day (evidence: `scripts/mock-ring-server.ts`)
### Zero to hello-world
1. Start the mock server from `scripts/mock-ring-server.ts`.
2. Send its first signed request at the webhook route.
3. Watch the inbox pill count up in the interface.
4. Drain the inbox through the same call the product uses.
### Would I build with it again
Yes, because signed, idempotent webhooks give the product a lawful event record to interpret.

## Ring live sessions (WHEP)
### Used for
Starting and stopping live video through the `whepSessionId` path for the door speaker view, with snapshot evidence attached to incidents.
### What worked
Session start and stop run through one disciplined path with battery and line-powered windows, and the scenarios covering live video pass.
### What needs work
- Battery sessions close after half a minute, so the interface must say why a stream ended instead of showing a dead frame (evidence: `src/ring/live-ring-port.ts`)
- Auto-close timers and manual close race when a judge opens and shuts the view quickly, which needed an explicit close discipline (evidence: `src/ui/panels/LiveViewPanel.tsx`)
### Zero to hello-world
1. Open the live view panel in the interface.
2. Start a session through the call sequence of `src/ring/live-ring-port.ts`.
3. Watch the stream render in the door speaker view.
4. Close the session and confirm the timer released it.
### Would I build with it again
Yes, because live sessions plus snapshots give each incident eyes and evidence in one place.

## Ring Developer Playground token
### Used for
The token box of the interface accepts a short-lived Playground token so a judge can read their own devices without registering an app, held in server memory only.
### What worked
Paste-and-read works end to end, the countdown chip names the remaining minutes, and expiry steps down to the bundled sample week with a banner instead of failing.
### What needs work
- The token lives about half an hour, so a judging session longer than that must re-paste or fall back to the bundle (evidence: JUDGES.md)
- A pasted token that cannot list devices needs a plain-language error, not a stack trace, which took one extra pass on the status chip (evidence: `src/ui/panels/LiveViewPanel.tsx`)
### Zero to hello-world
1. Open the Ring Developer Playground and copy a token.
2. Follow the paste-and-read steps of `JUDGES.md`.
3. Confirm the device list appears with the countdown chip.
4. Wait out the expiry or re-paste to see the fallback banner.
### Would I build with it again
Yes, because hardware-free judging would be impossible without the Playground path.

## Ring Appstore MCP
### Used for
Looking up Ring API shapes and the Playground token flow while the Ring port was written, recorded in `design_documents/submission/ai_tools.json`.
### What worked
The lookups returned the endpoint inventory that became the wire table, so the port matched the documentation on the first contract run.
### What needs work
- Lookup answers describe shapes in prose, so each shape still needed a wire sample pinned in code before the port trusted it (evidence: `src/ring/wire.ts`)
- The MCP knows nothing of the organizer's flat sample, so that gap surfaced only at the parser, not at lookup time (evidence: FL-1)
### Zero to hello-world
1. Install the Ring Appstore MCP server in the editor.
2. Run a first query for the webhook endpoint shape.
3. Compare the answer with `design_documents/hackathon_brief.md`.
4. Pin the shape as a wire sample before coding the port.
### Would I build with it again
Yes, because it shortened the documentation hunt from hours to minutes.

## Amazon Bedrock
### Used for
The product's runtime model route in `src/llm/bedrock-client.ts`: the extractor, planner, actor and narrator calls with runtime model discovery.
### What worked
The client, the Strands primary path and the Converse forced-tool fallback are all implemented behind one interface, and the golden replay of a recorded Bedrock run keeps every browser suite green.
### What needs work
- Scenario S-BEDROCK-1 is skipped in this build because no Bedrock credentials are mounted yet, so the live route is implemented but not yet measured (evidence: `design_documents/e2e-testing/results.md`)
- Model ids differ per account and region, so discovery must run at startup and every id in prose must come from the fact ledger, never typed by hand (evidence: `src/llm/model-discovery.ts`)
### Zero to hello-world
1. Mount a Bedrock API key for the region in use.
2. Run the steps of `scripts/probe-bedrock.ts`.
3. Confirm the probe prints the discovered model and region.
4. Run scenario S-BEDROCK-1 and watch it leave the skipped state.
### Would I build with it again
Yes, because a caretaking product needs a model route that explains a household in family language.

## Strands Agents SDK
### Used for
The agent tool loop through `src/llm/strands-adapter.ts`, driving the structured extractor, planner and narrator roles.
### What worked
The adapter holds one interface for the Strands primary path and the Converse fallback, so a shape change on either side stays behind the same call.
### What needs work
- The result shape needed a probe before the runner trusted it, since the documented shape and the returned shape did not obviously match (evidence: `scripts/probe-strands.ts`)
- Forced-tool Converse calls need different plumbing than structured-output calls, so both paths stay tested instead of one (evidence: `src/llm/strands-adapter.ts`)
### Zero to hello-world
1. Install the SDK at the pinned version.
2. Run the steps of `scripts/probe-strands.ts`.
3. Confirm the structured call returns the expected shape.
4. Run the forced-tool variant and compare.
### Would I build with it again
Yes, because one adapter for two call styles kept the role runners small.

## Amazon Bedrock AgentCore
### Used for
AgentCore is not used for anything in this build.
### What worked
Nothing to report; this section exists to record that AgentCore was considered and set aside.
### What needs work
- Keeping sessions, the inbox and the cost counter in one process made a separate agent host unnecessary, and that tradeoff deserves revisiting if the product ever serves more than one household per process (evidence: `src/server/agent-service.ts`)
### Zero to hello-world
1. Read the reason below for why AgentCore was set aside.
2. Confirm the single-process design in `src/server/agent-service.ts`.
3. Revisit only when one process must serve many households.
### Would I build with it again
No, the review is one bounded in-process run that needs no separate agent host.

## AWS Builder
Amazon Bedrock runs the agent's four model roles through the Converse API with a Bedrock API key; the Strands Agents SDK drives the tool loop. Both are called at runtime from src/llm and src/agent, and the architecture file records the call.

| Service | Call | File |
|---|---|---|
| Amazon Bedrock | Converse API for extractor, planner, actor, narrator | `src/llm/bedrock-client.ts` |
| Strands Agents SDK | Agent tool loop over the registered actions | `src/llm/strands-adapter.ts` |

The `api-bedrock` edge of `architecture.json` records the runtime proof once the live run harvests it.

## Other tools

| Tool | Used for | Note |
|---|---|---|
| Gemini on Vertex AI | Labelled fallback model when Bedrock is unreachable | Serves the product visibly as not-Bedrock |
| Google Cloud Run | Hosting the container with scale to zero | Costs nothing while judges are away |
| Playwright | Real-browser suites for every use case | Sixty browser tests hold the product still |
| React Three Fiber | The 3D doorway-week scene | Draws the week as a room you can enter |
| Express | The Node server for API, events and webhooks | One process serves API and interface |
