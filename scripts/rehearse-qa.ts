// scripts/rehearse-qa.ts — DP-SUBMISSION WU-07.
// Scripted rehearsal: io.ask answers with the drafted answer of the question
// the runner just printed (no person needed); io.write echoes and appends to
// the transcript. After the run, the unverified-answer count is prepended.
// Usage: npx vite-node scripts/rehearse-qa.ts [--count 5]
// Prints `rehearsal: <n> answered, <m> scored`.
import { readFileSync, writeFileSync } from "node:fs";
import { runRehearsal } from "../src/ideation/faqdef/rehearse.js";
import type { RehearsalIo } from "../src/ideation/faqdef/rehearse.js";
import { callVertexJson } from "./lib/submission-llm.js";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i === -1 ? undefined : process.argv[i + 1];
}

const count = Number(arg("--count") ?? "5") || 5;
const sheet = JSON.parse(readFileSync("design_documents/submission/qa/qa-sheet.json", "utf8")) as {
  questions?: { id?: string; question?: string; draft_answer?: string }[];
};
const entries = sheet.questions ?? [];
const transcript: string[] = [];
let asked = 0;
let lastQuestion = "";

const io: RehearsalIo = {
  ask: async (prompt: string, _budgetS: number): Promise<string> => {
    void prompt;
    const hit = entries.find((e) => e.question !== undefined && e.question !== "" && lastQuestion.includes(e.question.slice(0, 60)));
    const entry = hit ?? entries.find((e) => e.question !== undefined);
    asked += 1;
    return entry?.draft_answer ?? "Not stated in the sheet.";
  },
  write: (line: string): void => {
    console.log(line);
    transcript.push(line);
    const m = /^Q\d+\/\d+ \[[^\]]*\] (.*) \(\d+ s\)$/.exec(line);
    if (m) lastQuestion = m[1] as string;
  },
};

const code = await runRehearsal({
  qaPath: "design_documents/submission/qa/qa-sheet.md",
  count,
  budgetS: 90,
  callLlm: callVertexJson,
  io,
  logPath: "design_documents/submission/qa/rehearsal.md",
});

// Prepend the unverified-answer count; merge the transcript bodies so each
// judge feedback block (with its numeric score) is kept in the file.
let logBody = "";
try {
  logBody = readFileSync("design_documents/submission/qa/rehearsal.md", "utf8");
} catch { /* ignore */ }
const notStated = entries.filter((e) =>
  JSON.stringify(e).includes("not_stated"),
).length;
const merged = `unverified: ${notStated}\n${transcript.join("\n")}\n---\n${logBody}`;
writeFileSync("design_documents/submission/qa/rehearsal.md", merged, "utf8");

const scored = (logBody.match(/score=\d/g) ?? []).length;
console.log(`rehearsal: ${asked} answered, ${scored} scored`);
process.exit(code);
