# DP-DEPLOY — Container image, Cloud Run deploy, deployed-URL gate

> Plan 8 of 12. The single owner of everything between "it passes in the browser on this machine" and "a judge can open it": the container image, the deploy script that wires the chassis Docker adapter to Google Cloud Run, the Secret Manager wiring, the deploy record that lives outside the repository, and the gate that runs DP-E2E-BROWSER-TESTING's `e2e/smoke.spec.ts` and `e2e/depth.spec.ts` against the deployed URL and fails the deploy when either is red. It writes no application code; the only application-adjacent files are `Dockerfile`, `.dockerignore`, two scripts and one config.
> Chassis paths are written `../../hackathons/…`. Imports use the `src/…` alias; scripts run under `vite-node`. The vendored deploy dispatcher under `src/platform/deploy/` and `scripts/deploy.ts` are **used as they are and never edited**.

## §0 Context & blockers

**Must already exist before WU-01 runs** (plans 1–7). Proof, each prints its own line:

```bash
npx vite-node scripts/verify/at-08-integration.ts
npx vite-node scripts/verify/e2e-05-smoke.ts
npx vite-node scripts/verify/e2e-12-results.ts
```
Expected: `at-08-integration: 15 checks OK`, `e2e-05-smoke: 12 checks OK`, `e2e-12-results: 10 checks OK`. If one differs, stop: the owning plan is not finished. The deploy plan never starts from a red suite.

**Preflight (each line must print a path or a version):**
```bash
ls -d scripts/deploy.ts scripts/smoke-deploy.ts src/platform/deploy/deploy.ts src/platform/deploy/adapters/docker.ts config/deploy/docker.json config/server.json config/cost.json scripts/cost_sidecar.py data/golden-cache data/bundle e2e/smoke.spec.ts e2e/depth.spec.ts playwright.config.ts
node --version
python3 --version
gcloud --version
git --version
```
`node --version` must print v22 or newer. `docker --version` is **optional**: when it is missing, WU-01 records `image: skipped (docker not found)` and WU-02 uses the Cloud Build builder; neither hides the fact.

**What is live here.** WU-DEPLOY-04 (the deploy to Google Cloud) and WU-DEPLOY-05 (the gate against the deployed URL) need the operator's Google Cloud account and, for the deployed model path, the secrets of §5.3. Everything else is offline and deterministic. Credentials come from the operator's environment and Application Default Credentials (`gcloud auth list`, `gcloud auth application-default print-access-token`); none is written to a file, a plan or a log. A unit that cannot run for lack of access ends with a **named error** and the line `BLOCKED (<named error>)`, never with a guess.

**Vendor-name guard check (AI ACCESS SPEC §2A).** The brief carries no list of forbidden vendor names, so §2A does not apply and the full AI ACCESS rule below stands. Google Cloud is the documented operator-overridable default host; any container host that serves the app on `PUBLIC_URL` and answers `/health` satisfies the plan (§5.7 override).

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
**How this plan uses the rule above.** The deployed service reaches Amazon Bedrock when the secret `AWS_BEARER_TOKEN_BEDROCK` is mounted (blueprint FR-18); when that route is unreachable the service steps down the visible ladder to the labelled Vertex fallback (the service account carries `roles/aiplatform.user` and the environment variable `GOOGLE_GENAI_USE_VERTEXAI=true`, per AI ACCESS §2 step 5; no API key is used) and then to the recorded run. WU-05 reads which rung answered and records it; it never presents a fallback as Bedrock.

## §1 Purpose & requirement IDs

| ID | This plan's share |
|---|---|
| FR-24 | The public deployment: `/health` with a build marker; the deployed URL is green on `e2e/smoke.spec.ts` before it is claimed |
| FR-06 | `e2e/depth.spec.ts` runs against the deployed URL: the depth bar is met by the hosted product, not only by localhost |
| NFR-02 | No secret in the image, the repository, a log line or the deploy record; secrets travel through Secret Manager and stdin only |
| NFR-09, NFR-10 | The chassis is not modified; the deploy record lives outside the repository |
| NFR-12 | The deployed webhook route answers inside the 5-second budget (the smoke gate calls `/health`; `S-RING-1` already proved the route locally) |
| K-2 | `ALLOW_SIMULATE=1` is set on the service so the signed, `SIMULATED`-labelled deliveries work in production |
| K-9 | The image installs `python3` for the cost sidecar |
| K-10 | The override: `--record-only --url <url>` records any other container host's URL and runs the same gate |
| HEE-DEP-01 | One command from a clean checkout to a public URL; the gate is the same file the other plans run |

## §2 Scope boundaries

**IN — files this plan creates or modifies:**

| Path | Purpose |
|---|---|
| `Dockerfile`, `.dockerignore` | the image |
| `config/deploy.json` | the Cloud Run descriptor (names, region, limits, environment, secret ids) — no secret values |
| `config/env.doorstep.example` | the environment template: names only, empty values |
| `scripts/deploy-cloud-run.ts` | the deploy script (§3.2) |
| `scripts/deploy-gate.ts` | the gate (§3.3) |
| `scripts/verify/dp-01-image.ts` … `dp-05-gate.ts` | one verification script per work unit |
| `package.json` | scripts `deploy:cloud-run`, `deploy:gate`, `verify:deploy` |
| `../../hackathons/hackathon-projects/2026-10-amazonDevs/deploy-record.json` | the deploy record (outside the repository; written by the script) |

**OUT — named owners:**

| Not here | Owner |
|---|---|
| The server, its routes, `/health`, `PORT`, the proof log | DP-API-TRANSPORT |
| The smoke and depth specs, the harness, `BASE_URL` handling | DP-E2E-BROWSER-TESTING |
| The vendored dispatcher `src/platform/deploy/*` and `scripts/deploy.ts`, `scripts/smoke-deploy.ts` | the chassis kit (used, never edited) |
| README run instructions, `JUDGES.md`, `claims.json` | DP-SHOWCASE |
| Licence, disclosure, public-repository checks | DP-SUBMISSION |
| Any change to the chassis `../../hackathons/src/` | nobody: never modified |

## §3 Interfaces owned (literal skeletons)

### §3.1 `config/deploy.json` (literal)

```json
{
  "version": "1.0.0",
  "service": "doorstep-rhythm",
  "defaultProject": "2026-09-agentic-cinema1",
  "projectEnv": "GOOGLE_CLOUD_PROJECT",
  "defaultRegion": "us-central1",
  "regionEnv": "GOOGLE_CLOUD_LOCATION",
  "repository": "doorstep",
  "image": "doorstep-rhythm",
  "serviceAccount": "doorstep-run",
  "serviceAccountRoles": ["roles/aiplatform.user", "roles/secretmanager.secretAccessor"],
  "services": ["run.googleapis.com", "artifactregistry.googleapis.com", "secretmanager.googleapis.com", "aiplatform.googleapis.com"],
  "run": {
    "port": 8080,
    "memory": "1Gi",
    "cpu": 1,
    "concurrency": 40,
    "timeoutSec": 900,
    "minInstances": 1,
    "maxInstances": 1,
    "sessionAffinity": true,
    "allowUnauthenticated": true
  },
  "env": {
    "NODE_ENV": "production",
    "AGENT_ALLOW_FALLBACK": "1",
    "ALLOW_SIMULATE": "1",
    "GOOGLE_GENAI_USE_VERTEXAI": "true"
  },
  "envFromOperator": ["AWS_REGION", "BEDROCK_MODEL_ID", "GOOGLE_CLOUD_LOCATION"],
  "secrets": {
    "RING_WEBHOOK_SECRET": { "id": "doorstep-ring-webhook-secret", "generateIfMissing": true },
    "RING_HMAC_KEY": { "id": "doorstep-ring-hmac-key", "generateIfMissing": true },
    "AWS_BEARER_TOKEN_BEDROCK": { "id": "doorstep-bedrock-token", "generateIfMissing": false },
    "RING_CLIENT_ID": { "id": "doorstep-ring-client-id", "generateIfMissing": false },
    "RING_CLIENT_SECRET": { "id": "doorstep-ring-client-secret", "generateIfMissing": false },
    "RING_REFRESH_TOKEN": { "id": "doorstep-ring-refresh-token", "generateIfMissing": false }
  },
  "record": { "dirEnv": "PROJECT_SYNC_DIR", "defaultDir": "../../hackathons/hackathon-projects/2026-10-amazonDevs", "file": "deploy-record.json" }
}
```
Why one instance: the server keeps sessions, the event hub, the inbox and the cost counter in memory (blueprint §2); two instances would split a family member's session across processes. `minInstances 1` keeps the first judge's click from waiting for a cold start; `sessionAffinity` is set as a courtesy should the ceiling ever be raised.

### §3.2 `scripts/deploy-cloud-run.ts`

```ts
// Requirement IDs: FR-24, NFR-02, K-9, K-10
export interface DeployConfig { /* the shape of §3.1, typed field for field */ }
export interface Cmd { id: string; argv: string[]; stdin?: "secret"; redact?: string[] }   // argv[0] is "gcloud" or "docker"; `stdin: "secret"` means the value is piped, never in argv
export interface Opts { dryRun: boolean; createSecrets: boolean; builder: "docker" | "cloudbuild"; skipBuild: boolean; recordOnly: boolean; url?: string }

export function loadDeployConfig(opts?: { path?: string; env?: Record<string, string | undefined> }): { cfg: DeployConfig; project: string; region: string };
export function buildMarker(now: Date, shortSha: string): string;                     // "<sha>-<YYYYMMDD>-<HHMM>" in UTC
export function imageRef(cfg: DeployConfig, project: string, region: string): string; // "<region>-docker.pkg.dev/<project>/<repository>/<image>" (no tag)
export function planCommands(input: { cfg: DeployConfig; project: string; region: string; marker: string; opts: Opts; env: Record<string, string | undefined>; digest?: string }): Cmd[];
export function randomSecretValue(bytes?: number): string;                            // crypto.randomBytes(bytes ?? 32) as hex
export function writeRecord(dir: string, rec: DeployRecord): string;                  // returns the written path
export interface DeployRecord { url: string; service: string; project: string; region: string; image: string; digest: string | null; buildMarker: string; deployedAt: string; builder: string; smoke: null | { at: string; smoke: string; depth: string; rung: string; ring: string } }
export function main(argv: string[]): Promise<number>;                                // CLI
```
CLI: `npx vite-node scripts/deploy-cloud-run.ts [--dry-run] [--create-secrets] [--builder docker|cloudbuild] [--skip-build] [--record-only --url <url>]`. Exit `0` on success, `1` on a failed command (its own error is printed), `3` on `BLOCKED`.

### §3.3 `scripts/deploy-gate.ts`

```
npx vite-node scripts/deploy-gate.ts [--url <url>]
```
Reads the URL from `--url`, else `PUBLIC_URL`, else the record; runs `BASE_URL=<url> npx vite-node scripts/e2e-run.ts --label smoke e2e/smoke.spec.ts` and the same for `--label depth e2e/depth.spec.ts`; prints both summary lines; reads the `rung` and `ring` annotations of `SMOKE-3` from `e2e/artifacts/report.json`; writes them into the record's `smoke` field; prints `gate: green` and exits `0` when both are green, otherwise prints `gate: red` followed by the rollback hint of §5.6 and exits `1`. It never edits the record's URL.

## §4 Interfaces consumed (copy verbatim)

```ts
import { runDeploy } from "src/platform/deploy/deploy";        // chassis dispatcher: runDeploy("docker") builds and pushes `${DOCKER_REGISTRY}:latest`, then returns { url: process.env.PUBLIC_URL, provider: "docker", elapsedMs }; it throws when DOCKER_REGISTRY or PUBLIC_URL is unset
import type { DeployResult } from "src/platform/deploy/types"; // { url, provider, elapsedMs }
```
Also consumed: `scripts/smoke-deploy.ts` (`npm run deploy:verify`, polls `GET $PUBLIC_URL/health` every 2 s up to 30 s and prints `PASS <ms>ms …`), `e2e/smoke.spec.ts`, `e2e/depth.spec.ts`, `scripts/e2e-run.ts` (DP-E2E-BROWSER-TESTING §3.5), `config/deploy/docker.json` (the descriptor of the Docker adapter), `config/server.json` (`port`, `proofLog`), the `PORT` and `BUILD_MARKER` environment variables of the server (DP-API-TRANSPORT §3.2, §5.10), `GET /health` → `{ ok, build, mode, provider, uptimeSec }`.

## §5 Algorithms and literal configuration

### §5.1 `Dockerfile` (literal)

```dockerfile
# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim
ENV NODE_ENV=production PORT=8080 PYTHONUNBUFFERED=1 PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 ca-certificates \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --include=dev
COPY --chown=node:node . .
RUN npx vite build --logLevel error \
 && mkdir -p logs \
 && chown -R node:node /app
USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["npx", "vite-node", "src/server/index.ts"]
```
`BUILD_MARKER` is **not** baked into the image: the chassis Docker adapter runs a plain `docker build`, and the marker changes on every deploy. The deploy script sets it as a Cloud Run environment variable (§5.4). `devDependencies` stay in the image because the server runs under `vite-node`.

### §5.2 `.dockerignore` (literal)

```
node_modules
dist
.git
.gitignore
.env
.env.*
.run_sweep
.run_sweep.lock
.chat
.control
.intramessages
.lock
.opencode
.supervisor
.run_summaries
.pi_sessions
.tmp
run_state.json
run_state.json.*
e2e
evals
design_documents
video
test-results
playwright-report
logs/*
!logs/proof.log
*.md
!README.md
```
Everything the server reads at run time stays in the context: `src/`, `config/`, `data/` (the bundle and the golden cache), `scripts/cost_sidecar.py`, `contracts/`, `public/`, `index.html`, `vite.config.ts`, `tsconfig.json`, `package.json`, `package-lock.json`.

### §5.3 Secrets and the environment template

Secret Manager ids are those of `config/deploy.json` `secrets`. `--create-secrets`, for each entry: create the secret if `gcloud secrets describe <id>` fails (`gcloud secrets create <id> --replication-policy=automatic`), then add a version whose value is read **from the operator's environment variable of the same name as the key** and sent on **standard input** (`gcloud secrets versions add <id> --data-file=-`). When the variable is unset: `generateIfMissing: true` entries get `randomSecretValue()` (the webhook secret and the linking key guard only simulated and staging flows, so a random value is correct when no real Ring webhook is configured; an operator who registers a real webhook sets `RING_WEBHOOK_SECRET` first); other entries are skipped and the script prints `secret <NAME>: not provided` — for `AWS_BEARER_TOKEN_BEDROCK` it adds `(the deployed app will use the labelled fallback or the recorded run)`. Values are never printed, never in argv, never in the record.

`config/env.doorstep.example` (literal; names only):
```
# Doorstep Rhythm — environment names. Copy to .env and fill; .env is never committed.
PORT=
NODE_ENV=
BUILD_MARKER=
PUBLIC_URL=
RING_MODE=
RING_ACCESS_TOKEN=
RING_REFRESH_TOKEN=
RING_CLIENT_ID=
RING_CLIENT_SECRET=
RING_HMAC_KEY=
RING_WEBHOOK_SECRET=
AWS_BEARER_TOKEN_BEDROCK=
AWS_REGION=
BEDROCK_MODEL_ID=
AGENT_PROVIDER=
AGENT_ALLOW_FALLBACK=
GOLDEN_CACHE_DIR=
ALLOW_SIMULATE=
RECORD_GOLDEN=
GOOGLE_GENAI_USE_VERTEXAI=
GOOGLE_CLOUD_PROJECT=
GOOGLE_CLOUD_LOCATION=
DOCKER_REGISTRY=
PROJECT_SYNC_DIR=
ARCH_SYNC_DIR=
BASE_URL=
```

### §5.4 The command plan (`planCommands`, literal order and ids)

`marker = buildMarker(now, <git rev-parse --short HEAD>)`; `image = imageRef(...)`.

| # | id | argv (after the program name) | when |
|---|---|---|---|
| 1 | `enable-services` | `gcloud services enable <cfg.services…> --project <project>` | not `recordOnly` |
| 2 | `ensure-repo` | `gcloud artifacts repositories describe <repository> --location <region> --project <project>` or, on failure, `gcloud artifacts repositories create <repository> --repository-format=docker --location <region> --project <project>` | docker builder |
| 3 | `ensure-sa` | `gcloud iam service-accounts describe <sa>@<project>.iam.gserviceaccount.com` or, on failure, `gcloud iam service-accounts create <sa> --display-name "Doorstep Rhythm"` | not `recordOnly` |
| 4 | `bind-<role>` (one per role) | `gcloud projects add-iam-policy-binding <project> --member serviceAccount:<sa-email> --role <role> --condition=None` | not `recordOnly` |
| 5 | `secrets-<ID>` (per entry) | the §5.3 pair of commands, value on stdin | `createSecrets` |
| 6 | `docker-auth` | `gcloud auth configure-docker <region>-docker.pkg.dev --quiet` | docker builder |
| 7 | `build-push` | docker builder: **the chassis adapter**, i.e. `process.env.DOCKER_REGISTRY = image; process.env.PUBLIC_URL = <current service URL, else "https://pending.invalid">; await runDeploy("docker")` (the placeholder only satisfies the adapter's own check; the real URL is read in step 10); cloudbuild builder: `gcloud builds submit --tag <image>:latest --project <project> .` | not `skipBuild` |
| 8 | `digest` | `gcloud artifacts docker images describe <image>:latest --format="value(image_summary.digest)"` | not `recordOnly` |
| 9 | `deploy` | `gcloud run deploy <service> --image <image>@<digest> --region <region> --project <project> --platform managed --service-account <sa-email> --port <port> --memory <memory> --cpu <cpu> --concurrency <concurrency> --timeout <timeoutSec> --min-instances <min> --max-instances <max> --session-affinity --allow-unauthenticated --set-env-vars BUILD_MARKER=<marker>,<env pairs>,<envFromOperator pairs that are set> --set-secrets <NAME>=<id>:latest,… (only the secrets that exist)` | not `recordOnly` |
| 10 | `url` | `gcloud run services describe <service> --region <region> --project <project> --format="value(status.url)"` | not `recordOnly` |

`--dry-run` prints each command as `would run: <program> <argv…>` (the `build-push` step as `would run: chassis docker adapter (DOCKER_REGISTRY=<image>)`), runs nothing, writes nothing.

### §5.5 The deploy record (`deploy-record.json`; literal shape)

```json
{ "url": "https://…", "service": "doorstep-rhythm", "project": "…", "region": "…", "image": "…", "digest": "sha256:…", "buildMarker": "…", "deployedAt": "<ISO-8601 UTC>", "builder": "docker", "smoke": null }
```
Written to the directory named by `PROJECT_SYNC_DIR`, default `../../hackathons/hackathon-projects/2026-10-amazonDevs`, never inside the repository. `smoke` is filled by the gate with `{ at, smoke: "4 passed", depth: "1 passed", rung, ring }`.

### §5.6 Rollback hint (printed by the gate on red; literal)

```
gate: red — roll back with:
  gcloud run services update-traffic doorstep-rhythm --region <region> --project <project> --to-revisions <previous-revision>=100
  (list revisions: gcloud run revisions list --service doorstep-rhythm --region <region> --project <project>)
```

### §5.7 Override for another host (K-10)

`npx vite-node scripts/deploy-cloud-run.ts --record-only --url <https url>` records a URL the operator hosted elsewhere (any container host that serves the image of §5.1 with the same environment), without running any Google Cloud command; the gate then runs unchanged against it.

## §6 Failure modes

| Situation | What happens |
|---|---|
| No `gcloud` credentials | WU-04 prints `BLOCKED (<named error>)` after running the §0 credential commands; nothing is invented; downstream plans use the localhost proof and the override of §5.7 |
| `docker` missing | the builder is `cloudbuild`; WU-01 records the skipped image check |
| The build fails | the failing command's own error is printed and the script exits `1`; no record is written |
| The deploy succeeds but `/health` does not answer | the record is written with `smoke: null`; the gate prints `gate: red` and the rollback hint |
| Secret not provided | the deployed app starts on the next rung (labelled fallback or recorded run) and says so in its banner; the gate records the rung |
| Two instances start | prevented by `maxInstances 1`; a check in WU-02 asserts it |
| The image is large or slow to build | the `.dockerignore` of §5.2; the build is done once per deploy |

## §7 Work units

Conventions for every unit: scripts live in `scripts/verify/`, start with `import { createChecker } from "./ui-kit.js"` (the same `createChecker(name)` of the other plans: `done()` prints `<name>: N checks OK` and exits `0`, or prints the first failing label and exits `1`), and may use `run(cmd, args, opts?) → { code, out }` from `scripts/verify/e2e-kit.ts`. A unit's check count in its header, its list and its Expected output must be the same number; if a script is written with another count, change all three in the same edit. Every unit runs from the entry root.

### WU-DEPLOY-01 — the image and the production start
- **Goal:** the `Dockerfile` and `.dockerignore` exist, contain everything the server needs and nothing secret, and the exact production start command works on this machine (and in a container when Docker exists).
- **Steps:**
  1. Write `Dockerfile` (§5.1 literal) and `.dockerignore` (§5.2 literal).
  2. Add to `package.json`: `"deploy:cloud-run": "vite-node scripts/deploy-cloud-run.ts"`, `"deploy:gate": "vite-node scripts/deploy-gate.ts"`, `"verify:deploy": "vite-node scripts/verify/dp-01-image.ts && …"` (the five scripts of this plan, extended unit by unit).
  3. Write `scripts/verify/dp-01-image.ts`. The parity run (check 8) starts `npx vite-node src/server/index.ts` as a child process with `NODE_ENV=production`, `PORT=<a free port>`, `BUILD_MARKER=dp-01`, `AGENT_PROVIDER=golden` and no Ring or AWS variable, after `npx vite build --logLevel error`; it polls `/health` for up to 20 s and stops the child with `SIGTERM`.
- **Files:** `Dockerfile`, `.dockerignore`, `package.json`, `scripts/verify/dp-01-image.ts`.
- **Checks (10):**
  1. The first instruction of the `Dockerfile` after comments and `# syntax` is `FROM node:22-bookworm-slim`.
  2. It installs `python3` with `apt-get` and sets `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` on a line before `npm ci`.
  3. It sets `PORT=8080` and `NODE_ENV=production`, runs `USER node`, has `EXPOSE 8080`, and its `CMD` is `["npx", "vite-node", "src/server/index.ts"]`.
  4. It has a `HEALTHCHECK` whose command mentions `/health`.
  5. It contains no `ARG` or `ENV` whose name starts `RING_` or `AWS_`, no `Bearer ` and no 20-character hex string.
  6. `.dockerignore` contains every line of §5.2 and does not exclude any of `src`, `config`, `data`, `scripts`, `contracts`, `public`, `index.html`, `package.json`, `package-lock.json`, `vite.config.ts`, `tsconfig.json`.
  7. After applying `.dockerignore` (the script implements the matching rules for plain names, `*` and `!` lines) each of `data/golden-cache/doorstep-meta.json`, `data/bundle/doorstep-14d.json`, `scripts/cost_sidecar.py`, `config/server.json`, `config/cost.json`, `src/server/index.ts` stays in the build context.
  8. The production start command answers `GET /health` with `ok: true` and `build: "dp-01"`, `GET /` returns HTML containing `<div id="root"` or the app mount element of `index.html`, and `SIGTERM` ends the process with exit `0` within 5 s.
  9. `python3 -c "import sys; sys.path.insert(0, '.'); import src.cost"` exits `0` (the cost sidecar's package is importable from the repository root, as it will be in the image).
  10. When `docker --version` works, `docker build -t doorstep-local .` succeeds, a container started with `-e BUILD_MARKER=dp-01 -p <free>:8080` answers `/health` with `build: "dp-01"` within 30 s and is removed; the script prints `image: built and healthy`. When Docker is missing it prints `image: skipped (docker not found)`. Exactly one of the two lines appears.
- **Verify:** `npx vite-node scripts/verify/dp-01-image.ts`
- **Expected output:** `dp-01-image: 10 checks OK` (after exactly one of the lines `image: built and healthy` or `image: skipped (docker not found)`)
- **Proves:** the container the cloud will run starts the same server the tests ran, with python for the cost sidecar, with no secret inside it, and the context contains the golden cache and the bundled week the judges rely on.

### WU-DEPLOY-02 — the deploy script
- **Goal:** `scripts/deploy-cloud-run.ts` plans, prints and (when asked) executes the commands of §5.4 through the chassis Docker adapter, offline-testable end to end with `--dry-run`.
- **Steps:**
  1. Write `config/deploy.json` (§3.1 literal).
  2. Write `scripts/deploy-cloud-run.ts` per §3.2 and §5.4: `planCommands` is pure; `main` resolves the project (`GOOGLE_CLOUD_PROJECT` else `defaultProject`), region, the short git sha (`git rev-parse --short HEAD`, `nogit` when it fails), computes the marker, runs the commands in order with `spawnSync` (stdout and stderr inherited, `stdin` piped only for `stdin: "secret"` commands), stops at the first failing command with its own exit code mapped to `1`, and after the `url` step writes the record (§5.5). Step `ensure-*` commands are "describe, else create": the describe's non-zero exit is the signal to create, not an error.
  3. The `build-push` step for the docker builder sets `process.env.DOCKER_REGISTRY` and `process.env.PUBLIC_URL` and calls `runDeploy("docker")` from `src/platform/deploy/deploy`; it never calls `docker` itself and never edits the adapter.
  4. `--record-only --url <url>` skips every command and writes the record with `digest: null`, `builder: "external"`.
  5. Write `scripts/verify/dp-02-script.ts`.
- **Files:** `config/deploy.json`, `scripts/deploy-cloud-run.ts`, `scripts/verify/dp-02-script.ts`.
- **Checks (12):**
  1. `config/deploy.json` has the keys of §3.1, `run.minInstances` and `run.maxInstances` both `1`, `run.port` `8080`, and six secret entries each with an `id` starting `doorstep-`.
  2. `loadDeployConfig({ env: {} })` returns project `2026-09-agentic-cinema1` and region `us-central1`; with `GOOGLE_CLOUD_PROJECT=p-test` and `GOOGLE_CLOUD_LOCATION=europe-west1` it returns those.
  3. `buildMarker(new Date("2026-10-06T12:00:00Z"), "abc1234")` equals `abc1234-20261006-1200`.
  4. `imageRef(cfg, "p-test", "europe-west1")` equals `europe-west1-docker.pkg.dev/p-test/doorstep/doorstep-rhythm`.
  5. `planCommands` for default options returns the ids `enable-services`, `ensure-repo`, `ensure-sa`, `bind-roles/aiplatform.user`, `bind-roles/secretmanager.secretAccessor`, `docker-auth`, `build-push`, `digest`, `deploy`, `url` in exactly that order.
  6. The `deploy` command contains `--min-instances 1`, `--max-instances 1`, `--allow-unauthenticated`, `--session-affinity`, `--port 8080`, `--timeout 900`, `--service-account doorstep-run@p-test.iam.gserviceaccount.com` and an `--set-env-vars` value that starts `BUILD_MARKER=<marker>,`.
  7. With `builder: "cloudbuild"` the ids `ensure-repo`, `docker-auth` and the docker form of `build-push` are replaced by one `build-push` whose argv starts `gcloud builds submit --tag`.
  8. The source of `deploy-cloud-run.ts` imports `runDeploy` from `src/platform/deploy/deploy`, sets `DOCKER_REGISTRY` and `PUBLIC_URL` before calling it, and contains no `spawn` of the word `docker` outside the `docker-auth`/`docker` argv strings (scan).
  9. `npx vite-node scripts/deploy-cloud-run.ts --dry-run` run with `PATH` reduced to the directory of `node` exits `0`, prints one `would run:` line per planned command (the count equals `planCommands(...).length`), and creates no file.
  10. `--record-only --url https://example.invalid/app` with `PROJECT_SYNC_DIR` set to a temporary directory writes `deploy-record.json` there with `url`, `service`, `buildMarker`, `deployedAt` (ISO-8601) and `builder: "external"`, and the file contains none of the secret names of `config/deploy.json`'s values (there are none) nor a 20-hex string.
  11. `config/deploy.json` and `scripts/deploy-cloud-run.ts` contain no absolute path (no string beginning with `/` followed by a directory name or a drive letter) and no `Bearer `.
  12. `git status --porcelain -- src/platform/deploy scripts/deploy.ts scripts/smoke-deploy.ts config/deploy` prints nothing: the vendored deploy files are untouched.
- **Verify:** `npx vite-node scripts/verify/dp-02-script.ts`
- **Expected output:** `dp-02-script: 12 checks OK`
- **Proves:** the whole deploy is expressed as a reviewable list of commands that a dry run prints without touching anything, goes through the chassis Docker adapter, pins one instance, and records its result outside the repository.

### WU-DEPLOY-03 — secrets and the environment template
- **Goal:** secrets reach the service through Secret Manager and standard input only, and the environment template lists every name the server reads, with no values.
- **Steps:**
  1. Implement `--create-secrets` (§5.3) in `deploy-cloud-run.ts`: in `planCommands`, for each configured secret emit `secrets-<NAME>` commands (describe-or-create, then `versions add --data-file=-`) with `stdin: "secret"`; the value is read in `main` from `env[NAME]`, or generated, or the entry is skipped with the printed line `secret <NAME>: not provided`. Redact: the printer never prints stdin; `Cmd.redact` lists substrings to mask in any echoed argument (none expected).
  2. Add `--set-secrets` to the `deploy` command only for secrets whose Secret Manager version exists after step 1, or that `gcloud secrets describe` reports as existing (the script checks).
  3. Write `config/env.doorstep.example` (§5.3 literal) and make sure `.env*` stays ignored (DP-E2E-BROWSER-TESTING WU-06 added it).
  4. Write `scripts/verify/dp-03-secrets.ts`. Its sentinels are generated at run time with `crypto.randomBytes`; none is written to a file.
- **Files:** `scripts/deploy-cloud-run.ts`, `config/env.doorstep.example`, `scripts/verify/dp-03-secrets.ts`.
- **Checks (10):**
  1. `planCommands` with `createSecrets: true` emits, for each of the six secrets, a describe-or-create command and a `versions add` command whose argv ends `--data-file=-` and whose `stdin` is `"secret"`.
  2. No emitted argv element contains any value of the environment passed in (sentinels `S1…S6` set for all six names): the sentinels appear in no argv.
  3. `npx vite-node scripts/deploy-cloud-run.ts --dry-run --create-secrets` with the sentinels set prints output that contains none of the sentinels.
  4. With `RING_WEBHOOK_SECRET` and `RING_HMAC_KEY` unset, the plan marks both for generation; `randomSecretValue()` returns 64 lowercase hex characters and two calls differ.
  5. With `AWS_BEARER_TOKEN_BEDROCK` unset, the printed lines include `secret AWS_BEARER_TOKEN_BEDROCK: not provided` and the text `labelled fallback or the recorded run`.
  6. The `--set-secrets` argument of the `deploy` command equals `NAME=id:latest` pairs for exactly the secrets that exist (the script is run with a stub that reports three as existing and checks the three).
  7. `config/env.doorstep.example` has exactly the names of §5.3 in that order, every line of the form `NAME=` with an empty value, and the first line is a comment.
  8. Every name read from `process.env`/`env.` in `src/server/**` and `src/ring/**` and `src/llm/**` (the script scans for `env\.([A-Z][A-Z0-9_]+)` and `process\.env\.([A-Z][A-Z0-9_]+)`) is present in the template or in the list of platform-provided names (`HOME`, `PATH`, `TMPDIR`, `NODE_ENV`, `PORT`).
  9. `git check-ignore -q .env` and `git check-ignore -q .env.local` succeed, and `git check-ignore -q config/env.doorstep.example` fails (the template is tracked).
  10. `serviceAccountRoles` of the config equals `["roles/aiplatform.user", "roles/secretmanager.secretAccessor"]` and the `bind-*` commands use `--condition=None`.
- **Verify:** `npx vite-node scripts/verify/dp-03-secrets.ts`
- **Expected output:** `dp-03-secrets: 10 checks OK`
- **Proves:** a secret can only travel on standard input into Secret Manager and onto the service by reference; nothing the script prints or the repository tracks contains one; a missing secret is stated in words and the app steps down the ladder instead of failing.

### WU-DEPLOY-04 — deploy and record the URL **[live]**
- **Goal:** the service is running on Google Cloud Run at a public URL, `/health` carries the build marker, and the deploy record exists outside the repository.
- **Steps:**
  1. Run the credential commands of AI ACCESS §2 and of the deploy: `gcloud auth list`, `gcloud auth application-default print-access-token`, `gcloud config get-value project`, `gcloud services list --enabled --filter="name:run.googleapis.com"`. With `GOOGLE_CLOUD_PROJECT=2026-09-agentic-cinema1` unless the operator names another. If one fails with a named error, quote it, write `BLOCKED (<named error>)` as the unit's result, and continue with the plans that do not need a URL (the override of §5.7 is the way forward); do not invent a project, a region or a billing account.
  2. Export the operator's secrets into the environment of this shell only (names of §5.3; values from the operator's own secret store, never typed into a file), then run `npx vite-node scripts/deploy-cloud-run.ts --create-secrets` (add `--builder cloudbuild` when Docker is missing).
  3. Run `PUBLIC_URL=<printed url> npm run deploy:verify` (the chassis health poll; it prints `PASS <ms>ms (attempt <n>, status 200)`).
  4. Write `scripts/verify/dp-04-deploy.ts`.
- **Files:** `scripts/verify/dp-04-deploy.ts`, `../../hackathons/hackathon-projects/2026-10-amazonDevs/deploy-record.json` (outside the repository).
- **Checks (10):**
  1. The record file exists at `<PROJECT_SYNC_DIR or default>/deploy-record.json` and is **not** inside the repository (its resolved path does not start with the repository root).
  2. The record has `url` starting `https://`, a non-empty `buildMarker`, `service` `doorstep-rhythm` and `deployedAt` parseable as a date within the last 24 hours.
  3. `GET <url>/health` without any credential answers `200` with `ok: true` and `build` equal to the record's `buildMarker`.
  4. `GET <url>/` answers `200` with HTML.
  5. `GET <url>/watch` and `GET <url>/lab` answer `200` with HTML (the single-page fallback).
  6. `GET <url>/api/status` answers `200` with `ring.mode` and `agent.kind` fields.
  7. `GET <url>/events/stream` answers within 5 s with header `content-type` starting `text/event-stream` (the request is aborted after the headers).
  8. `gcloud run services describe doorstep-rhythm --format="value(spec.template.metadata.annotations)"` output (or the equivalent JSON) shows `autoscaling.knative.dev/maxScale` equal to `1` and `minScale` equal to `1`.
  9. `PUBLIC_URL=<url> npm run deploy:verify` exits `0` and prints a line starting `PASS `.
  10. The record contains none of the secret ids' values, no 20-hex string and no `Bearer `.
- **Verify:** `npx vite-node scripts/verify/dp-04-deploy.ts`
- **Expected output:** `dp-04-deploy: 10 checks OK`. When access is missing after step 1 the command prints `dp-04-deploy: BLOCKED (<named error>)` and exits `3`; the same line goes into the unit notes and into `results.md` of DP-E2E-BROWSER-TESTING's successors.
- **Proves:** a stranger with no login can open the product at a public address that names the build it is running, the live event stream works through the host's proxy, and exactly one instance holds the sessions.

### WU-DEPLOY-05 — the gate: smoke and depth against the deployed URL **[live]**
- **Goal:** the deployed URL is claimed only after `e2e/smoke.spec.ts` and `e2e/depth.spec.ts` are green against it; red fails the deploy and prints the way back.
- **Steps:**
  1. Write `scripts/deploy-gate.ts` per §3.3.
  2. Run `npx vite-node scripts/deploy-gate.ts`. The depth test may use live Bedrock when the secret is mounted (AI ACCESS rule of §0); the rung that answered is read from the `SMOKE-3` annotations and recorded.
  3. On red: follow DP-E2E-BROWSER-TESTING's fix loop for the cause (the fix is made where it belongs and the service is redeployed with WU-04 step 2), then rerun this unit. Never mark the URL as claimed while red.
  4. Write `scripts/verify/dp-05-gate.ts`; it reads the record and the JSON report, and itself runs the two Playwright commands once more.
- **Files:** `scripts/deploy-gate.ts`, `scripts/verify/dp-05-gate.ts`, the record's `smoke` field.
- **Checks (8):**
  1. `BASE_URL=<url> npx playwright test e2e/smoke.spec.ts` (run by the script) shows `4 passed` in its own summary.
  2. `BASE_URL=<url> npx vite-node scripts/e2e-run.ts --label smoke e2e/smoke.spec.ts` prints `smoke: 4 passed, 0 failed, 0 skipped`.
  3. `BASE_URL=<url> npx vite-node scripts/e2e-run.ts --label depth e2e/depth.spec.ts` prints `depth: 1 passed, 0 failed, 0 skipped`.
  4. The output of the smoke run contains the line `smoke: base <url>` with the deployed URL (the gate really ran against it, not against localhost).
  5. The record's `smoke` field is non-null with `smoke` `4 passed`, `depth` `1 passed`, and non-empty `rung` and `ring` strings; `rung` is one of `Amazon Bedrock`, `Fallback model (not Bedrock)`, `Recorded run`, `Manual` (as the agent chip names it) and the script prints it.
  6. With `BASE_URL=http://127.0.0.1:1` (an unreachable address) the gate command exits `1`, prints `gate: red` and the rollback hint beginning `gate: red — roll back with:` (run with `--url` pointing there and a temporary record directory so the real record is untouched).
  7. The gate on the real URL prints `gate: green` and exits `0`.
  8. `design_documents/e2e-testing/strategy.md` and `scripts/deploy-gate.ts` both name `e2e/smoke.spec.ts` as the one smoke test, and no other file under `e2e/` or `scripts/` defines a test titled `SMOKE-`.
- **Verify:** `npx vite-node scripts/verify/dp-05-gate.ts`
- **Expected output:** `dp-05-gate: 8 checks OK` (after the lines `smoke: 4 passed, 0 failed, 0 skipped`, `depth: 1 passed, 0 failed, 0 skipped`, `rung: <rung>` and `gate: green`). When no deployed URL exists because WU-04 was blocked, the command prints `dp-05-gate: BLOCKED (no deployed URL: <named error of WU-04>)` and exits `3`.
- **Proves:** the hosted product, not just the local one, loads clean, runs a week review to the end and meets the depth bar; the rung that answered is recorded; and a red result stops the claim and shows how to roll back.

## §8 Verification summary

| WU | Command | Expected |
|---|---|---|
| 01 | `npx vite-node scripts/verify/dp-01-image.ts` | `dp-01-image: 10 checks OK` |
| 02 | `npx vite-node scripts/verify/dp-02-script.ts` | `dp-02-script: 12 checks OK` |
| 03 | `npx vite-node scripts/verify/dp-03-secrets.ts` | `dp-03-secrets: 10 checks OK` |
| 04 | `npx vite-node scripts/verify/dp-04-deploy.ts` | `dp-04-deploy: 10 checks OK` (or the blocked line, exit 3) |
| 05 | `npx vite-node scripts/verify/dp-05-gate.ts` | `dp-05-gate: 8 checks OK` (or the blocked line, exit 3) |
| all | `npm run verify:deploy` | the five results above, in order |
| gate | `BASE_URL=<url> npx playwright test e2e/smoke.spec.ts` | `4 passed` (Playwright's own summary) |

If a count differs because a check was split or merged while writing a script, change the number in the unit and in this table in the same edit.

## §9 Risks

- **Cloud access is missing.** Mitigation: the named-error rule, `BLOCKED (…)` lines, the override of §5.7 for another host, and the plans downstream that run on localhost until a URL exists.
- **The image build pulls a large dependency tree.** Mitigation: `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`, the `.dockerignore`, layer caching on `package*.json`.
- **`npm ci` fails because the lock file and `package.json` drifted.** Mitigation: WU-01 check 10 (or the cloud build) fails at the first deploy, not at the last; fix by regenerating the lock file with `npm install` and committing it.
- **Two instances split sessions.** Mitigation: `maxInstances 1`, asserted in WU-02 check 1 and WU-04 check 8.
- **The event stream is buffered by a proxy.** Mitigation: WU-04 check 7 reads the headers of the live stream; the server already sends `Cache-Control: no-store` and the no-buffering header (DP-API-TRANSPORT §5).
- **A secret is missing at deploy time.** Mitigation: the app steps down the visible ladder; the gate records the rung; nothing fails silently.
- **The real Ring cannot reach the webhook URL during the video.** Mitigation: `ALLOW_SIMULATE=1`; signed, `SIMULATED`-labelled deliveries through the same verifier (K-2).
- **`vite-node` as the production launcher is slower to start than compiled code.** Mitigation: `--start-period=20s` on the health check, `minInstances 1`, and the 2-second poll of `deploy:verify`.
- **A red gate after a fix elsewhere.** Mitigation: the loop of WU-05 step 3 returns to the owning plan and redeploys; the URL is never claimed while red.
