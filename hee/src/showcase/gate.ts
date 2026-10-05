// Requirement IDs: HEE-SHOW-01, HEE-SHOW-02, HEE-SHOW-03, HEE-SHOW-04, HEE-CLAIM-01
// DP-W09 §3 gate: claims → readme → captions → judge-kit, in order.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { lintClaims } from "./claims.js";
import { lintReadme } from "./readme.js";
import { lintJudgeKit } from "./judge-kit.js";
import { captionError } from "./stills.js";
import { compileSchema, loadSchema } from "../llm/index.js";
import type { CaptionEntry, ClaimLedger } from "./types.js";

export interface GateOpts {
  online?: boolean;
}

export interface GateResult {
  ok: boolean;
  lines: string[];
}

/** DP-W09 WU-8 showcaseGate. */
export async function showcaseGate(entryDir: string, opts?: GateOpts): Promise<GateResult> {
  const lines: string[] = [];

  const claims = lintClaims(entryDir);
  if (claims.problems.length === 0) {
    lines.push(`claims: OK (${claims.count} claims)`);
  } else {
    for (const p of claims.problems) lines.push(`FAIL claims: ${p}`);
  }

  const readme = lintReadme(entryDir);
  if (readme.problems.length === 0) {
    lines.push("readme: OK");
  } else {
    for (const p of readme.problems) lines.push(`FAIL readme: ${p}`);
  }

  const captionsPath = join(entryDir, "shots", "showcase", "captions.json");
  if (!existsSync(captionsPath)) {
    lines.push("FAIL captions: shots/showcase/captions.json not found");
  } else {
    let entries: CaptionEntry[] | null = null;
    try {
      entries = JSON.parse(readFileSync(captionsPath, "utf8")) as CaptionEntry[];
    } catch {
      entries = null;
    }
    const schemaResult =
      entries === null ? null : compileSchema(loadSchema("contracts/hee-captions.schema.json"))(entries);
    if (entries === null || schemaResult === null || !schemaResult.ok) {
      lines.push("FAIL captions: shots/showcase/captions.json is invalid");
    } else {
      const ledger = readLedgerIds(entryDir);
      let failures = 0;
      for (const entry of entries) {
        const problem = captionError(entry.caption);
        if (problem !== null) {
          lines.push(`FAIL captions: ${entry.file}: ${problem}`);
          failures += 1;
        } else if (entry.claim_id !== null && !ledger.has(entry.claim_id)) {
          lines.push(`FAIL captions: ${entry.file}: unknown claim_id "${entry.claim_id}"`);
          failures += 1;
        }
      }
      if (failures === 0) lines.push(`captions: OK (${entries.length} images)`);
    }
  }

  const judgeKit = await lintJudgeKit(entryDir, { online: opts?.online });
  if (judgeKit.problems.length === 0) {
    lines.push("judge-kit: OK");
  } else {
    for (const p of judgeKit.problems) lines.push(`FAIL judge-kit: ${p}`);
  }

  const failures = lines.filter((l) => l.startsWith("FAIL ")).length;
  if (failures === 0) {
    lines.push("showcase gate OK");
    return { ok: true, lines };
  }
  lines.push(`showcase gate FAILED (${failures} problems)`);
  return { ok: false, lines };
}

function readLedgerIds(entryDir: string): Set<string> {
  const path = join(entryDir, "claims.json");
  if (!existsSync(path)) return new Set();
  try {
    const ledger = JSON.parse(readFileSync(path, "utf8")) as ClaimLedger;
    return new Set((ledger.claims ?? []).map((c) => c.id));
  } catch {
    return new Set();
  }
}
