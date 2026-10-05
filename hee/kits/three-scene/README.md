<!-- Requirement IDs: HEE-KIT-01 -->

# three-scene kit

## Purpose

A standalone starter kit for the signature real-time 3D view every entry ships
(`templates/3d-experience.spec.md`). Two variants share the same scene input:
a React/R3F variant (`src/react/`) and a vanilla three.js variant
(`src/vanilla/`). The kit provides the renderer, lights, effects, camera rig,
fallback, `/lab` tuning panel and the `window.__demo3d` hooks the video
recorder reads. Entries never author these from scratch.

## Config

The kit's input is a `SceneDescription` (`src/core/scene-description.ts`)
produced by the entry's `src/3d/adapter.ts`, plus a `ThreeTokens` palette
(`src/core/tokens.ts`) mapped from the DP-UI token set onto the `--scene-*`
CSS custom properties. Named camera shots come from `src/core/shots.ts`.

## Worked example

```powershell
npx vite-node hee/scripts/install-kit.ts three-scene --to . --variant react
npm install
```

```tsx
import { ThreeScene } from "./src/kits/three-scene/src/react/index.js";
<ThreeScene scene={scene} tokens={tokens} name="widget-bay" />;
```

## What this does not contain

No domain geometry, no brand colours (defaults are neutral greys for the demo
page only), no network-fetched environments, and no edits to the video
pipeline: the kit only provides the hooks the recorder already reads.
