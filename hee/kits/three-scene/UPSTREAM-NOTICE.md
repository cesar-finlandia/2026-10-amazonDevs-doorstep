<!-- Requirement IDs: HEE-KIT-01 -->

# Upstream notices

Pinned dependency versions, resolved 2026-10-03 via `npm view` (see DP-W05 WU-1).

| package | version | licence |
|---|---|---|
| three | 0.186.1 | MIT |
| @react-three/fiber | 9.8.1 | MIT |
| @react-three/drei | 10.7.9 | MIT |
| @react-three/postprocessing | 3.1.3 | MIT |
| postprocessing | 6.39.5 | Zlib |
| leva | 0.10.1 | MIT |
| react | 19.3.0 | MIT |
| react-dom | 19.3.0 | MIT |
| @types/three | 0.186.0 | MIT |
| typescript | 7.0.2 | Apache-2.0 |
| vite | 8.3.2 | MIT |
| @vitejs/plugin-react | 6.1.1 | MIT |
| vitest | 5.0.3 | MIT |
| @playwright/test | 1.63.0 | Apache-2.0 |
| pngjs | 7.0.0 | MIT |
| @types/react | 19.3.0 | MIT |
| @types/react-dom | 19.3.0 | MIT |

No upstream example code is adapted in this kit: every module is written for
this repository. If an upstream example is adapted later, its licence text and
the pinned revision are recorded here.

## Pinned-stack notices (deviations from older three.js behaviour)

- `Shadows: PCFShadowMap (PCFSoftShadowMap removed in three 0.186)`. The kit
  uses R3F `shadows="percentage"` and `THREE.PCFShadowMap` instead of
  `shadows="soft"` / `THREE.PCFSoftShadowMap`: three r183+ removed the soft
  map and setting it only warns (`THREE.WebGLShadowMap: PCFSoftShadowMap has
  been removed`). R3F maps a bare `shadows` prop onto the removed type too,
  hence the explicit `"percentage"` value.
- `Clock: THREE.Timer supersedes THREE.Clock (deprecated r183)`.
  `@react-three/fiber@9.8.1` constructs a `THREE.Clock` internally, so every
  R3F page logs `THREE.Clock: This module has been deprecated. Please use
  THREE.Timer instead.` once. The e2e render check allow-lists exactly this
  notice; every other `THREE` warning still fails the run. Kit code uses
  `performance.now()` directly and never constructs `THREE.Clock`.
