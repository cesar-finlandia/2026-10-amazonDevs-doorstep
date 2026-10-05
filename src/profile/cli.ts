// Requirement IDs: PROFILE-01, PROFILE-02, PROFILE-06, XCUT-06
// `profile` CLI — TypeScript twin of src/profile/cli.py (DP-L §9.3). Flags,
// help text and exit codes stay byte-compatible:
//   profile extract --brief <file> [--out <file>] [--role r] [--json]
//   profile --validate <file> [--brief <file>]
//   profile --show-flag <file>
// Exit codes: 0 on ANY successful write · 1 usage/validation/I-O failure.
// The mandated-platform flag is DATA ONLY (PROFILE-06/NONGOAL-17).

import { existsSync, readFileSync, readlinkSync, symlinkSync } from "node:fs";
import { dirname } from "node:path";

import {
  NOT_EXTRACTED,
  ProfileWriteError,
  runProfileExtractBrief,
  sha256Hex,
} from "./extractor.js";
import { validate } from "../resilience/index.js";
import { loadEventProfileSchema } from "./validate.js";
import { callLlmForProfile } from "./roles.js";

const HELP_EPILOG = [
  "Advisory note (PROFILE-05): every field in event_profile.json is an OPTIONAL runtime-configuration default — consumers stay functional when the file is absent or extraction failed.",
  "Mandated-platform warning (PROFILE-06): a ⚠️ flag means the brief mandates a specific build platform — this is a prompt for a MANUAL human decision; no component is disabled automatically.",
].join("\n");

const USAGE = `profile — Event Profile Extractor

  profile extract --brief hackathon_brief.md --out event_profile.json [--role profile_extractor] [--json]
  profile --brief hackathon_brief.md --out event_profile.json          # alias form
  profile extract --validate event_profile.json --brief hackathon_brief.md   # dry-run + hash check
  profile --validate event_profile.json [--brief hackathon_brief.md]
  profile --show-flag event_profile.json
  profile --help

${HELP_EPILOG}`;

function fail(message: string): number {
  console.error(`[profile] ${message}`);
  return 1;
}

// §5.2 distinctness rules (verification item 3) — mirrors src/profile/cli.py.
const FLAG_SENTINELS = ["⚠️ MANDATED PLATFORM —", "!!! MANDATED PLATFORM —"];
const FLAG_TAIL = "chassis likely doesn't apply — confirm manually";

interface DistinctnessError {
  path: string;
  code: string;
  message: string;
}

export function checkFlagDistinctness(data: unknown): DistinctnessError[] {
  const errors: DistinctnessError[] = [];
  const mp =
    data && typeof data === "object"
      ? ((data as { mandated_platform?: { required?: unknown; flag?: unknown; name?: unknown } }).mandated_platform ?? undefined)
      : undefined;
  if (!mp || mp.required !== true) return []; // gate ONLY when mandated (blank template passes)
  const flag = mp.flag;
  if (typeof flag !== "string" || !flag.trim()) {
    errors.push({
      path: "mandated_platform.flag",
      code: "flag/required-when-mandated",
      message: 'required:true demands a non-null flag with a MANDATED PLATFORM sentinel',
    });
    return errors;
  }
  if (!FLAG_SENTINELS.some((s) => flag.startsWith(s))) {
    errors.push({
      path: "mandated_platform.flag",
      code: "flag/sentinel-prefix",
      message: 'must start with "⚠️ MANDATED PLATFORM —" or "!!! MANDATED PLATFORM —"',
    });
  }
  if (!flag.endsWith(FLAG_TAIL)) {
    errors.push({
      path: "mandated_platform.flag",
      code: "flag/tail-language",
      message: `must end with the exact phrase "${FLAG_TAIL}"`,
    });
  }
  const name = mp.name;
  if (typeof name === "string" && name.trim() && !flag.includes(`— ${name} —`)) {
    errors.push({
      path: "mandated_platform.flag",
      code: "flag/name-embedded",
      message: `must embed the extracted platform name verbatim (— ${name} —)`,
    });
  }
  return errors;
}

function cmdValidate(file: string, brief?: string): number {
  let data: unknown;
  try {
    data = JSON.parse(readFileSync(file, "utf8"));
  } catch (err) {
    return fail(`invalid JSON/unreadable: ${err instanceof Error ? err.message : err}`);
  }
  const result = validate(loadEventProfileSchema(), data);
  if (!result.valid) {
    for (const e of result.errors) console.error(`${e.path} [${e.code}]: ${e.message}`);
    return 1;
  }
  // §9.3 --validate gate: flag-distinctness when required:true (§5.2 rules).
  const distinct = checkFlagDistinctness(data);
  for (const e of distinct) console.error(`${e.path} [${e.code}]: ${e.message}`);
  if (distinct.length > 0) return 1;
  if (brief && data && typeof data === "object") {
    const doc = data as { raw_brief_hash?: string; extraction_meta?: { status?: string } };
    const recorded = doc.raw_brief_hash ?? "";
    const actual = sha256Hex(readFileSync(brief, "utf8"));
    if (recorded && recorded !== actual && doc.extraction_meta?.status === "extracted") {
      console.error(
        `[profile] warn: raw_brief_hash stale (file ${recorded.slice(0, 12)}… vs brief ${actual.slice(0, 12)}…) — re-run profile extract`,
      );
    }
  }
  console.log(`[profile] valid: ${file}`);
  return 0;
}

function cmdShowFlag(file: string): number {
  let data: unknown;
  try {
    data = JSON.parse(readFileSync(file, "utf8"));
  } catch (err) {
    return fail(`invalid JSON/unreadable: ${err instanceof Error ? err.message : err}`);
  }
  const flag =
    data && typeof data === "object"
      ? ((data as { mandated_platform?: { flag?: string | null } }).mandated_platform?.flag ?? null)
      : null;
  console.log(flag ?? "(no mandated platform)");
  return 0;
}

/** §9.3 gate 3: idempotent profile/event_profile.json → ../event_profile.json.
 *  Best-effort — a failed symlink never fails the run (mirrors cli.py). */
function ensureCanonicalSymlink(outPath: string): void {
  const parent = dirname(outPath);
  if (parent.endsWith("profile") && !parent.endsWith(".profile")) return; // --out targets profile/
  const link = `${parent}/profile/event_profile.json`;
  if (!existsSync(`${parent}/profile`)) return; // no profile/ dir → nothing to alias
  const target = "../event_profile.json";
  try {
    let existing: string | null = null;
    try {
      existing = readlinkSync(link);
    } catch {
      /* not a symlink — real file or absent */
      try {
        readFileSync(link, "utf8");
        return; // real file occupies the spot — never clobber user data
      } catch {
        /* absent → create below */
      }
    }
    if (existing === target) return; // idempotent — already correct
    symlinkSync(target, link);
    console.log(`[profile] symlinked ${link} → ${target}`);
  } catch {
    /* advisory convenience only */
  }
}

async function cmdExtract(args: Map<string, string>, jsonOut: boolean): Promise<number> {
  const brief = args.get("brief");
  if (!brief) return fail("extract requires --brief");
  const out = args.get("out") ?? `${dirname(brief)}/event_profile.json`;
  // §9.3 gate 2: role resolved through the SHARED roles module (never hardcoded).
  const role = args.get("role") || "profile_extractor";
  let outcome: Awaited<ReturnType<typeof runProfileExtractBrief>>;
  try {
    outcome = await runProfileExtractBrief(brief, out, {
      callLlm: (prompt, opts) => callLlmForProfile(prompt, opts, role),
    });
  } catch (err) {
    if (err instanceof ProfileWriteError) {
      // §9.3 rule 5: exit 1 ONLY here; no raw stack trace ever.
      let h = "0".repeat(64);
      try {
        h = sha256Hex(readFileSync(brief, "utf8"));
      } catch {
        /* unreadable brief — zeros hash */
      }
      const msg = err.message.replace(" — re-run with --out <writable-dir>", "");
      console.error(`${msg} — brief hash ${h.slice(0, 12)}… — re-run with --out <writable-dir>`);
      return 1;
    }
    throw err;
  }
  if (jsonOut) console.log(JSON.stringify(outcome));
  if (outcome.status === "extracted") {
    const profile = JSON.parse(readFileSync(out, "utf8")) as {
      extracted_at?: string;
      raw_brief_hash?: string;
      mandated_platform?: { required?: boolean; flag?: string | null; name?: string | null };
      tracks?: { structure?: string; sponsors?: string[] };
      video_limits?: { max_minutes?: number | null };
      disclosure_required?: unknown;
    };
    // §5.2 rendering: flag on its own banner, never buried; manual-confirm
    // language verbatim (mirrors src/profile/cli.py _render_banner).
    console.log(
      `[profile] extracted at ${profile.extracted_at} — hash ${(profile.raw_brief_hash ?? "").slice(0, 8)}… — status: ${outcome.status}`,
    );
    const mp = profile.mandated_platform ?? {};
    if (mp.required && mp.flag) {
      const name = mp.name ?? "unknown";
      console.log();
      console.log("─".repeat(61));
      console.log(mp.flag);
      console.log(`   This hackathon's brief mandates a specific end-to-end build platform (${name}).`);
      console.log("   The chassis's code components (Platform/Transport/Media) likely do not apply");
      console.log("   to this event. This is a prompt for a manual human decision — no component");
      console.log("   is being disabled automatically. Confirm with the team whether to proceed");
      console.log("   with the chassis or pivot to the mandated platform.");
      console.log("─".repeat(61));
    }
    const val = (v: unknown): string => (v === null || v === undefined || v === "" ? NOT_EXTRACTED : String(v));
    const vmax = profile.video_limits?.max_minutes;
    const vmaxS = typeof vmax === "number" ? `${vmax} min (${Math.round(vmax * 60)} s)` : val(vmax);
    console.log(
      `  Tracks: ${val(profile.tracks?.structure)} — sponsors: ${(profile.tracks?.sponsors ?? []).join(", ") || "(none listed)"}`,
    );
    console.log(`  Video: ${vmaxS}`);
    console.log(`  Disclosure: ${val(profile.disclosure_required)}`);
  } else {
    console.log(
      `mandated platform: ${NOT_EXTRACTED} — verify brief manually — no assumption`,
    );
    console.log(`[profile] warn: extraction failed (${outcome.reason ?? "unknown"}) — wrote blank template`);
  }
  ensureCanonicalSymlink(outcome.outPath ?? out);
  return 0; // both extracted AND not-extracted are successful writes (§9.3 rule 5)
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  if (argv.length === 0 || argv.includes("--help") || argv.includes("-h")) {
    console.log(USAGE);
    return argv.length === 0 ? 1 : 0;
  }
  try {
    const eqIndex = argv.findIndex((a) => a.startsWith("--validate="));
    if (eqIndex !== -1) return cmdValidate((argv[eqIndex] ?? "").slice("--validate=".length));
    if (argv.includes("--validate")) {
      const idx = argv.indexOf("--validate");
      const briefIdx = argv.indexOf("--brief"); // §9.3: optional staleness check
      return cmdValidate(
        argv[idx + 1] ?? "",
        briefIdx !== -1 ? argv[briefIdx + 1] : undefined,
      );
    }
    if (argv.includes("--show-flag")) {
      const idx = argv.indexOf("--show-flag");
      return cmdShowFlag(argv[idx + 1] ?? "");
    }
    if (argv[0] === "extract") {
      const args = new Map<string, string>();
      let jsonOut = false;
      for (let i = 1; i < argv.length; i++) {
        const a = argv[i];
        if (a === undefined) continue;
        if (a === "--json") jsonOut = true;
        else if (a.startsWith("--")) {
          args.set(a.slice(2), argv[i + 1] ?? "");
          i++;
        }
      }
      // §9.3 alternative form: `profile extract --validate f --brief b`
      if (args.has("validate")) return cmdValidate(args.get("validate") ?? "", args.get("brief"));
      return await cmdExtract(args, jsonOut);
    }
    if (argv.some((a) => a === "--brief" || a.startsWith("--brief="))) {
      // Alias invocation (§9.3): `profile --brief … [--out …] [--role …] [--json]`
      const args = new Map<string, string>();
      let jsonOut = false;
      for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === undefined) continue;
        if (a === "--json") jsonOut = true;
        else if (a?.startsWith("--")) {
          args.set(a.slice(2), argv[i + 1] ?? "");
          i++;
        }
      }
      return await cmdExtract(args, jsonOut);
    }
    console.log(USAGE);
    return 1;
  } catch (err) {
    // §9.3 rule 5: exit 1 ONLY on I/O failure here.
    if (err instanceof ProfileWriteError) {
      console.error(`${err.message} — re-run with --out <writable-dir>`);
      return 1;
    }
    return fail(`I/O failure: ${err instanceof Error ? err.message : String(err)}`);
  }
}

const argv1 = process.argv[1]?.replace(/\\/g, "/") ?? "";
// Entry guard mirroring src/pgm/cli.ts: node (argv[1] is this file) AND
// vite-node (argv[1] is vite-node's cli.mjs; user args start at index 2).
// VITEST workers are excluded so suites can import main() safely.
const invokedDirectly = argv1.endsWith("src/profile/cli.ts");
const invokedViaViteNode =
  argv1.includes("vite-node") &&
  process.env["CHASSIS_DISPATCH"] === undefined &&
  process.env["VITEST"] === undefined;
if (invokedDirectly || invokedViaViteNode) {
  void main().then((code) => process.exit(code));
}
