// Requirement IDs: HEE-SHOW-01, HEE-SHOW-02, HEE-SHOW-03, HEE-SHOW-04, HEE-CLAIM-01
// DP-W09 §1.1 CLI. Exit 0 ok; 1 problems or error; 2 usage.
import { initClaims, lintClaims, verifyAllClaims } from "./claims.js";
import { lintReadme, scaffoldReadme } from "./readme.js";
import { makeStills } from "./stills.js";
import { lintJudgeKit, renderJudgeKitTo } from "./judge-kit.js";
import { showcaseGate } from "./gate.js";

export interface CliOutput {
  exitCode: number;
  out: string[];
  err: string[];
}

const USAGE = [
  "usage: cli.ts <command> --entry <dir> [flags]",
  "  claims init|verify|lint --entry .",
  "  readme scaffold|lint --entry . [--force]",
  "  stills --entry . [--base-url <url>]",
  "  judge-kit render|lint --entry . [--online]",
  "  gate --entry . [--online]",
].join("\n");

interface Parsed {
  command: string[];
  entry: string;
  force: boolean;
  online: boolean;
  baseUrl?: string;
}

function parseArgs(argv: string[]): Parsed | null {
  const command: string[] = [];
  let entry: string | null = null;
  let force = false;
  let online = false;
  let baseUrl: string | undefined;
  let i = 0;
  while (i < argv.length && !argv[i]?.startsWith("--")) {
    command.push(argv[i] as string);
    i += 1;
  }
  while (i < argv.length) {
    const flag = argv[i] as string;
    if (flag === "--entry" && i + 1 < argv.length) {
      entry = argv[i + 1] as string;
      i += 2;
    } else if (flag === "--force") {
      force = true;
      i += 1;
    } else if (flag === "--online") {
      online = true;
      i += 1;
    } else if (flag === "--base-url" && i + 1 < argv.length) {
      baseUrl = argv[i + 1] as string;
      i += 2;
    } else {
      return null;
    }
  }
  if (command.length === 0 || entry === null) return null;
  return { command, entry, force, online, baseUrl };
}

/** Run the CLI over an argv array (without node/script). Output is collected. */
export async function runCli(argv: string[]): Promise<CliOutput> {
  const out: string[] = [];
  const err: string[] = [];
  const parsed = parseArgs(argv);
  if (parsed === null) return { exitCode: 2, out, err: [USAGE] };
  const [area, verb] = parsed.command;

  try {
    if (area === "claims" && verb === "init") {
      const { created, candidates } = initClaims(parsed.entry);
      out.push(created ? "claims init: wrote claims.json" : "claims init: claims.json exists");
      for (const c of candidates) out.push(`candidate ${c.file}:${c.line} ${c.kind} "${c.match}"`);
      return { exitCode: 0, out, err };
    }
    if (area === "claims" && verb === "verify") {
      const { ok, bad } = verifyAllClaims(parsed.entry);
      out.push(`claims verify: ${ok} verified, ${bad} unverified`);
      return { exitCode: bad === 0 ? 0 : 1, out, err };
    }
    if (area === "claims" && verb === "lint") {
      const result = lintClaims(parsed.entry);
      if (result.problems.length === 0) out.push(`claims: OK (${result.count} claims)`);
      else for (const p of result.problems) out.push(p);
      return { exitCode: result.problems.length === 0 ? 0 : 1, out, err };
    }
    if (area === "readme" && verb === "scaffold") {
      const result = scaffoldReadme(parsed.entry, { force: parsed.force });
      (result.ok ? out : err).push(result.ok ? result.message : result.message);
      return { exitCode: result.ok ? 0 : 1, out, err };
    }
    if (area === "readme" && verb === "lint") {
      const result = lintReadme(parsed.entry);
      if (result.problems.length === 0) out.push("readme: OK");
      else for (const p of result.problems) out.push(p);
      return { exitCode: result.problems.length === 0 ? 0 : 1, out, err };
    }
    if (area === "stills" && verb === undefined) {
      await makeStills({ entryDir: parsed.entry, baseUrl: parsed.baseUrl });
      return { exitCode: 0, out, err };
    }
    if (area === "judge-kit" && verb === "render") {
      const result = renderJudgeKitTo(parsed.entry);
      (result.ok ? out : err).push(result.message);
      return { exitCode: result.ok ? 0 : 1, out, err };
    }
    if (area === "judge-kit" && verb === "lint") {
      const result = await lintJudgeKit(parsed.entry, { online: parsed.online });
      if (result.problems.length === 0) out.push("judge-kit: OK");
      else for (const p of result.problems) out.push(p);
      if (!parsed.online) out.push(result.note);
      return { exitCode: result.problems.length === 0 ? 0 : 1, out, err };
    }
    if (area === "gate" && verb === undefined) {
      const result = await showcaseGate(parsed.entry, { online: parsed.online });
      for (const line of result.lines) out.push(line);
      return { exitCode: result.ok ? 0 : 1, out, err };
    }
  } catch (e) {
    err.push((e as Error).message ?? String(e));
    return { exitCode: 1, out, err };
  }
  return { exitCode: 2, out, err: [USAGE] };
}

async function main(): Promise<void> {
  const result = await runCli(process.argv.slice(2));
  for (const line of result.out) console.log(line);
  for (const line of result.err) console.error(line);
  process.exit(result.exitCode);
}

if (!process.env["VITEST"] && !process.env["VITEST_WORKER_ID"]) void main();
