---
version: "1.0.0"
generated_at: "2026-10-12T18:31:22.270Z"
not_extracted_fields: []
---

# Submission copy

## Tagline

**Thesis:** Doorstep life is rhythmic and irregular, which is why a distant daughter cannot judge a quiet day without Ri

## Target User

Long-distance adult children of solo-living seniors in Ring-camera households.

## Why AI

Could this have been built 2y ago with forms+DB and no AI? No — static thresholds cannot learn a household's irregular rhythm or explain an anomaly in plain language across weeks of messy doorstep events, and without the now-public Ring developer platform (documented webhooks, component addressing, simulator-tested onboarding) there was no lawful resident-data stream to reason over at all. The sponsor timing is uniquely winnable because this is the first hackathon where Ring is open to outside developers, so caretaking depth on Ring has no entrenched prior art.

## Tech Stack

openai, playwright, reddit, vercel

## Disclosure / Provenance

# Provenance & Disclosure

> Generated from the assembly manifest — do not hand-edit accuracy; polish wording only if needed.

## Reused prior code

For this hackathon I reused **4** pre-existing block(s) of code that handle infrastructure-level functionality, none of them specific to this project:

- a message buffer that keeps a conversation inside a model's context window, with a pluggable token counter
- code that counts token and request usage and warns before a configured budget is exceeded, to prevent overspending
- a typed event-streaming bus for pushing step-by-step progress to the browser, plus a one-command deploy helper and a small themed UI shell
- a wrapper that retries a slow or failed provider call and falls back to a cached response, so a live demo never dead-ends on a blank screen

Thus all application-level code, and most other low-level code, was designed and implemented only for this hackathon.

The repository also contains a small amount of pre-existing developer tooling used to prepare this submission's documents. The application does not call it at runtime and it is not part of the product.

## How this entry was built

The workflow was: design plans authored with Claude AI from my project idea, then implemented using cheaper AI models. Testing was done with Claude as well.

## AI assistance

- **Claude Code** — wrote the design plans and implemented the engine, the interface, the tests and the deployment scripts from them
- **Ring Appstore MCP** — looked up Ring API shapes and the Developer Playground token flow while the Ring port was written
- **Gemini on Vertex AI** — generated the three text-free pitch pictures, the Q&A sheet draft and its rehearsal feedback, and served as the labelled fallback model of the product
- **Amazon Bedrock** — is the product's runtime model route (the agent's extractor, planner, actor and narrator calls)

_Generated at 2026-10-10T13:36:34.388Z from manifest hash 77e04710c2031011b04da05bb5d83f783c09f9d84a43eea379d4640cbc404b09._


## Hygiene (advisory)

### Secret scan — clean (0 hit(s))

No secret-pattern hits across 972 scanned file(s) (69 ignored).

### Commit distribution — clean (15% in one 1h bucket)

33 total commits; largest bucket `2026-10-10T13:00Z` holds 5 (15%, threshold 80%).

Overall: **clean**
