// Requirement IDs: PGM-11, PGM-10, XCUT-06, XCUT-08
// Public surface of the PGM module (DP-K §11 file tree). Consumers import
// exclusively from "src/pgm" — deep imports of internals (roles.js,
// resilientCall.js internals) are CI-blocked, mirroring the src/resilience
// barrel rule. Stage orchestration (runPgm/runStage) is stubbed until the
// M09 stage steps wire deconstruction → mining → synthesis → selection.
//
// Re-exports:
//   getModelForRole / Role / RoleModelConfig  — PGM-11 role routing (§8)
//   callLlmForRole / callValidatedRole        — PGM-10 resilient dispatch
//   resolveRoleTimeoutMs / ResilientCallOutcome
//   runPgm / runPgmStage                      — orchestration (§9)

export {
  getModelForRole,
  resolveRolesFilePath,
  DEFAULT_ROLES_PATH,
} from "./roles.js";
export type { Role, RoleModelConfig } from "./roles.js";

export {
  callLlmForRole,
  callValidatedRole,
  resolveRoleTimeoutMs,
} from "./resilientCall.js";
export type { RoleCallOptions, RoleLlm, ResilientCallOutcome } from "./resilientCall.js";

export {
  runStage1,
  validatePersonas,
  extractSponsorNames,
  renderCatalogSponsorList,
  renderDeconstructionPrompt,
  renderTemplate,
} from "./stages/stage1_deconstruction.js";
export type { Stage1Options, Stage1Outcome, PersonaSemanticsResult } from "./stages/stage1_deconstruction.js";

export { runStage2 } from "./stages/stage2_mining.js";
export type { Stage2Options, Stage2Outcome, MiningConfig, Stage2PgmConfig } from "./stages/stage2_mining.js";

export {
  runStage4,
  compactCandidates,
  renderCatalogDigest,
  splitFrontmatter,
  parseFrontmatterYaml,
  checkHeadings,
  findUsernameLeak,
  findOverlongQuotes,
  findManifestLeaks,
  FROZEN_BODY_HEADINGS,
  MAX_QUOTE_WORDS,
  FRONTMATTER_SCHEMA_PATH,
} from "./stages/stage4_selection.js";
export type { Stage4Options, Stage4Outcome, Stage4Data } from "./stages/stage4_selection.js";

export {
  createDataSource,
  resolveTiers,
  LocalCacheDataSource,
  LiveApiDataSource,
  NullDataSource,
  TieredDataSource,
} from "./mining/factory.js";
export type { DataSourceConfig, ResolvedTier } from "./mining/factory.js";
export type { RedditDataSource, RedditRawSubmission, SearchParams, RedditSubset } from "./mining/types.js";
export {
  toMinedRecord,
  makeUngroundedMarker,
  paraphraseExcerpt,
  toRoughDate,
  COMMENTS_STALENESS_WARNING,
  EXCERPT_MAX_CHARS,
} from "./mining/ingest.js";
export type { MinedRecord, SourceTier } from "./mining/ingest.js";

//#region Orchestrator (PGM-12/13 — DP-K §9)

export {
  runPgm,
  runPgmStage,
  loadPgmConfig,
  defaultPgmConfig,
  surfacePartials,
  groundedFraction,
  hashArtifacts,
} from "./pipeline.js";
export type {
  PgmRunOptions,
  PgmSingleStageOptions,
  PgmSingleStageResult,
  PgmResolvedConfig,
  RunManifest,
} from "./pipeline.js";

//#endregion
