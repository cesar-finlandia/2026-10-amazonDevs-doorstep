// Requirement IDs: PROFILE-01, PROFILE-05, PROFILE-07
// Public entry of the Event Profile Extractor (DP-L §9.1): consumers import
// ONLY this barrel — never prompts/ internals (deep-import blocked). The
// EventProfile type mirrors contracts/event-profile.schema.json; it is NOT a
// second schema — the JSON contract stays authoritative.

export {
  extractEventProfile,
  runProfileExtractBrief,
  blankTemplate,
  normalize,
  applyFabricationGuard,
  computeNotExtracted,
  dedupStrings,
  renderExtractPrompt,
  renderExtractRepairPrompt,
  parseLlmJson,
  readEventProfile,
  writeAtomically,
  sha256Hex,
  NOT_EXTRACTED,
  REPAIR_TEMPERATURE,
  EXTRACTION_RESILIENCE_CONFIG,
  PROFILE_HARD_CEILING_MS,
  EVENT_PROFILE_SCHEMA_PATH,
  BriefInsufficientError,
  ProfileWriteError,
} from "./extractor.js";
export type { EventProfile, RawProfile, ProfileRunOutcome } from "./extractor.js";
export { validateEventProfile, loadEventProfileSchema, SCHEMA_PATH } from "./validate.js";
export {
  getModelForProfileRole,
  callLlmForProfile,
  DEFAULT_PROFILE_MODEL_PROFILE,
} from "./roles.js";
