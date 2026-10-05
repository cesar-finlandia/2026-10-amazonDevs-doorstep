<!-- Requirement IDs: HEE-KIT-02 -->

# agent-workflow kit

## Purpose

A standalone starter kit for the multi-round agent workflow every entry ships
(`templates/product-depth.spec.md` §1–§5 and §9). It supplies the mechanics —
domain store, truth engine, action registry, approval gate, run trace, model
client, adapters and UI primitives — over a neutral "widget shelf" demo
domain. The entry's `DP-DOMAIN-ENGINE` supplies the domain model and
truth-engine rules; `DP-AGENT-WORKFLOW` supplies the domain actions and
prompts.

## Config

The kit reads no entry config of its own. Actions are registered in code with
`createRegistry`; the run trace validates against
`contracts/hee-run-trace.schema.json` and the manifest against
`contracts/hee-action-manifest.schema.json`. The server model client takes
`project`/`location`/`model` from the environment (`GOOGLE_CLOUD_PROJECT`,
`GOOGLE_CLOUD_LOCATION`, `AGENT_MODEL`) and its token from
`google-auth-library` (Application Default Credentials locally, the attached
service account when deployed). No API key is used anywhere.

## Worked example

```powershell
npx vite-node hee/scripts/install-kit.ts agent-workflow --to .
npm install
```

```ts
import { createDomainStore } from "./src/kits/agent-workflow/src/store/domainStore.js";
const store = createDomainStore({ initial: { widgets: [] }, actions: [addWidget] });
store.dispatch("add_widget", { name: "alpha" }, "human");
```

## What this does not contain

No domain model, no truth-engine rules, no domain actions or prompts (those
are the entry's), no brand styling, and no edits to the video pipeline: the
kit's components emit `data-demo-focus` only when a `demoFocus` prop is
given.
