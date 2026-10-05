// src/agent/floors.ts
import { summarizeTrace } from "src/kits/agent-workflow/src/trace/summarize.js";
import type { RunTrace } from "src/kits/agent-workflow/src/trace/types.js";
export interface FloorReport { ok: boolean; modelEntries: number; roles: string[]; verifyRepairRounds: number; humanCheckpoints: number; finalErrors: number | null; problems: string[] }
export const FLOORS: { minModelEntries: 15; minRoles: 4; minVerifyRepairRounds: 1; minHumanCheckpoints: 1; finalErrors: 0 } = { minModelEntries: 15, minRoles: 4, minVerifyRepairRounds: 1, minHumanCheckpoints: 1, finalErrors: 0 };
const COUNTED_ROLES = new Set(["extractor", "planner", "actor", "narrator"]);
export function checkFloors(trace: RunTrace): FloorReport {
  const summary = summarizeTrace(trace.entries);
  const modelEntries = summary.model_calls;
  const roles = summary.model_roles.filter((r) => COUNTED_ROLES.has(r));
  const verifyRepairRounds = summary.verify_repair_rounds;
  const humanCheckpoints = summary.human_checkpoints;
  const finalErrors = summary.final_truth ? summary.final_truth.errors : null;
  const problems: string[] = [];
  if (modelEntries < FLOORS.minModelEntries) {
    problems.push(`only ${modelEntries} model entries, need ${FLOORS.minModelEntries} (model-entry floor)`);
  }
  if (roles.length < FLOORS.minRoles) {
    problems.push(`only ${roles.length} distinct roles (${roles.join(",") || "none"}), need ${FLOORS.minRoles} (role floor)`);
  }
  if (verifyRepairRounds < FLOORS.minVerifyRepairRounds) {
    problems.push(`no verify to repair round (verify-repair floor)`);
  }
  if (humanCheckpoints < FLOORS.minHumanCheckpoints) {
    problems.push(`no human checkpoint (human-checkpoint floor)`);
  }
  if (finalErrors !== FLOORS.finalErrors) {
    problems.push(`final error count is ${finalErrors === null ? "unknown" : finalErrors}, need ${FLOORS.finalErrors}`);
  }
  return { ok: problems.length === 0, modelEntries, roles, verifyRepairRounds, humanCheckpoints, finalErrors, problems };
}
