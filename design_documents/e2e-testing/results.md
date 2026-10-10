# E2E results

## Run

final: 59 passed, 0 failed, 1 skipped

Total duration: 228 seconds.

| Spec file | Seconds |
|---|---|
| depth.spec.ts | 19.9 |
| harness.spec.ts | 1.9 |
| scenarios/3d.spec.ts | 19.8 |
| scenarios/controls.spec.ts | 36.6 |
| scenarios/s-bedrock.spec.ts | 0.1 |
| scenarios/s-ring.spec.ts | 24.1 |
| scenarios/uc01-open-the-week.spec.ts | 8.6 |
| scenarios/uc02-review-the-week.spec.ts | 86.8 |
| scenarios/uc03-the-moment.spec.ts | 5.6 |
| scenarios/uc04-decide-a-moment.spec.ts | 11.2 |
| scenarios/uc05-approve-a-message.spec.ts | 62.9 |
| scenarios/uc06-the-rail.spec.ts | 11.9 |
| scenarios/uc07-by-hand.spec.ts | 8.3 |
| scenarios/uc11-when-things-fail.spec.ts | 4.6 |
| scenarios/uc13-help-and-looks.spec.ts | 11.9 |
| scenarios/uc14-activity-and-trace.spec.ts | 71.1 |
| smoke.spec.ts | 27.1 |

## Traceability

| Test | Result |
|---|---|
| H-1 | pass |
| UC01-1 | pass |
| UC01-2 | pass |
| UC01-3 | pass |
| UC01-4 | pass |
| UC01-5 | pass |
| UC02-1 | pass |
| UC02-2 | pass |
| UC02-3 | pass |
| UC02-4 | pass |
| UC03-1 | pass |
| UC03-2 | pass |
| UC03-3 | pass |
| UC04-1 | pass |
| UC04-2 | pass |
| UC04-3 | pass |
| UC04-4 | pass |
| UC05-1 | pass |
| UC05-2 | pass |
| UC05-3 | pass |
| UC06-1 | pass |
| UC06-2 | pass |
| UC06-3 | pass |
| UC06-4 | pass |
| UC06-5 | pass |
| UC07-1 | pass |
| UC07-2 | pass |
| UC07-3 | pass |
| UC11-1 | pass |
| UC11-2 | pass |
| UC11-3 | pass |
| UC13-1 | pass |
| UC13-2 | pass |
| UC13-3 | pass |
| UC14-1 | pass |
| UC14-2 | pass |
| UC14-3 | pass |
| UC14-4 | pass |
| CTL-1 | pass |
| CTL-2 | pass |
| S-RING-1 | pass |
| S-RING-2 | pass |
| S-RING-3 | pass |
| S-RING-4 | pass |
| S-RING-5 | pass |
| S-RING-6 | pass |
| S-RING-7 | pass |
| S-RING-8 | pass |
| S-RING-9 | pass |
| S-BEDROCK-1 | skipped: CredentialsProviderError: Could not load credentials from any providers |
| SMOKE-1 | pass |
| SMOKE-2 | pass |
| SMOKE-3 | pass |
| SMOKE-4 | pass |
| DEPTH-1 | pass |
| 3D-1 | pass |
| 3D-2 | pass |
| 3D-3 | pass |
| 3D-4 | pass |
| 3D-5 | pass |

## Mandated technology

Evidence for the nine `S-RING` rows comes from the simulated Ring (`createMockRingServer`; every answer carries `x-simulated: true`); none of it is recorded or presented as live Ring.

bedrock-probe: unavailable (CredentialsProviderError: Could not load credentials from any providers)

| Test | Result |
|---|---|
| S-RING-1 | pass |
| S-RING-2 | pass |
| S-RING-3 | pass |
| S-RING-4 | pass |
| S-RING-5 | pass |
| S-RING-6 | pass |
| S-RING-7 | pass |
| S-RING-8 | pass |
| S-RING-9 | pass |

## Agent surface

95.0% task success (19/20) with the product's action surface against 35.0% (7/20) with generic screen actions only; 44527.3 tokens and 34.2 s per try with the surface.

Measured on 10 frozen tasks, 2 repetitions each, with gemini-2.5-flash; this shows success on those tasks only.

## Architecture proofs

harvest: 3 proofs, 3 missing

lint-architecture: pending live proof (DP-LIVE-RUN-AND-VIDEO)

## Repository hygiene

e2e-06-hygiene: 10 checks OK

## How to re-run

```
npm run e2e
npm run e2e:smoke
BASE_URL=<url> npx playwright test e2e/smoke.spec.ts
```
