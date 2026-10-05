// Requirement IDs: HEE-KIT-01
export { createThreeScene } from "./createThreeScene.js";
export type { VanillaSceneHandle, VanillaSceneOptions } from "./createThreeScene.js";
export type { SceneDescription, SceneEntity, Vec3 } from "../core/scene-description.js";
export { validateSceneDescription } from "../core/scene-description.js";
export type { ThreeTokens } from "../core/tokens.js";
export { NEUTRAL_DEMO_TOKENS, readTokensFromCss } from "../core/tokens.js";
export type { ShotDef } from "../core/shots.js";
export { defaultShots, easeInOutCubic, interpolateCamera, shotForEntity } from "../core/shots.js";
export type { Demo3dApi } from "../core/demo-hooks.js";
export { installDemoHooks } from "../core/demo-hooks.js";
