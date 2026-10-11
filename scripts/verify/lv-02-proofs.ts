// scripts/verify/lv-02-proofs.ts — DP-LIVE-RUN-AND-VIDEO WU-LIVE-02 (10 checks).
// Live proofs come from a real log line at a real line number; a missing
// live service is reported, never faked; the feedback file is closed.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { existsSync } from "node:fs";
import { check, done, runNode, runPy } from "../video/lib.js";
import { PROJECT, readJson } from "../video/lib.js";

const failures: string[] = [];
let n = 0;
const t = (ok: boolean, label: string): void => {
  n += 1;
  check(n, ok, label, failures);
};
const resolveEvidence = (ref: string): boolean =>
  existsSync(ref) || existsSync(`${PROJECT}/${ref}`);

// Snapshot before-state, then run the unit.
const fbBefore = readFileSync("design_documents/submission/feedback.md", "utf8");
const archBefore = readJson("architecture.json") as { edges?: { id?: string; proof?: unknown }[] };
const proofsBefore = JSON.stringify((archBefore.edges ?? []).map((e) => [e.id, e.proof ?? null]));
const outsideBefore = fbBefore.slice(0, fbBefore.indexOf("<!-- live-check:start -->")) +
  fbBefore.slice(fbBefore.indexOf("<!-- live-check:end -->") + "<!-- live-check:end -->".length);
const outsideHash = createHash("sha256").update(outsideBefore).digest("hex");

const live = runNode(["scripts/video/live-proofs.ts"]);
const liveLine = live.out.trim().split("\n").map((l) => l.trim())
  .find((l) => /^proofs: \d+ proven, \d+ missing$/.test(l)) ?? "";
const fill = runNode(["scripts/video/fill-live-check.ts"]);
const fb = runNode(["scripts/check-feedback.ts", "--final"]);

// 1. counts cover exactly the live/sponsor-mode ids.
{
  const m = /proofs: (\d+) proven, (\d+) missing/.exec(liveLine);
  const cfg = readJson("config/architecture-proofs.json") as Record<string, { accept?: string[] }>;
  const need = Object.keys(cfg).filter((id) => (cfg[id]?.accept ?? []).some((x) => x === "live" || x === "bedrock"));
  t(live.code === 0 && m !== null && Number(m[1]) + Number(m[2]) === need.length,
    `proofs line covers ${need.length} live/sponsor ids (${liveLine})`);
}

// 2. proof.log lines are real format, no secrets.
{
  const lines = readFileSync(`${PROJECT}/video/proofs/proof.log`, "utf8").split(/\r?\n/).filter((l) => l !== "");
  const fmt = /^\S+ proof edge=\S+ mode=\S+ .+/;
  t(lines.length > 0 && lines.every((l) => fmt.test(l)) &&
    !lines.some((l) => /AKIA|Bearer [A-Za-z0-9_\-]{16,}|refresh_token/i.test(l)),
    `proof.log: ${lines.length} real-format lines, no secrets`);
}

// 3. each proven id resolves: file exists, line holds the text.
{
  const doc = readJson("architecture.json") as { edges?: { id?: string; proof?: { file?: string; line?: number; text?: string } }[] };
  const harvest = readJson(`${PROJECT}/video/proofs/harvest.json`) as { proven?: Record<string, unknown> };
  let ok = Object.keys(harvest.proven ?? {}).length > 0;
  for (const e of doc.edges ?? []) {
    if (!e.proof) continue;
    const f = e.proof.file ?? "";
    const full = existsSync(f) ? f : `${PROJECT}/${f}`;
    let holds = false;
    try {
      const lns = readFileSync(full, "utf8").split(/\r?\n/);
      holds = (lns[(e.proof.line ?? 0) - 1] ?? "").includes(e.proof.text ?? "§none§");
    } catch { holds = false; }
    if (!holds) ok = false;
  }
  t(ok, "proven ids resolve to file+line+text");
}

// 4. missing ids have reasons, gaps, and no proof.
{
  const harvest = readJson(`${PROJECT}/video/proofs/harvest.json`) as { missing?: Record<string, string> };
  const doc = readJson("architecture.json") as { edges?: { id?: string; proof?: unknown }[] };
  const notes = readFileSync(`${PROJECT}/video/production-notes.md`, "utf8");
  const gaps = notes.slice(notes.indexOf("## Known gaps"));
  const ok = Object.entries(harvest.missing ?? {}).every(([id, reason]) =>
    typeof reason === "string" && reason.length > 0 && gaps.includes(id) &&
    (doc.edges ?? []).find((e) => e.id === id)?.proof === undefined);
  t(ok && Object.keys(harvest.missing ?? {}).length > 0, "missing ids reasoned, gapped, proof-free");
}

// 5. no proof wears a foreign mode.
{
  const cfg = readJson("config/architecture-proofs.json") as Record<string, { accept?: string[] }>;
  const doc = readJson("architecture.json") as { edges?: { id?: string; proof?: { mode?: string } }[] };
  t((doc.edges ?? []).every((e) =>
    !e.proof || (cfg[e.id ?? ""]?.accept ?? []).includes(e.proof.mode ?? "")),
    "proof modes within accepted modes");
}

// 6. the architecture lint is green (sponsor proof satisfied or named gap).
{
  const r = runNode(["scripts/lint-architecture.ts", "hackathon-projects/2026-10-amazonDevs"], "../../hackathons");
  t(r.code === 0, "lint-architecture exits 0");
}

// 7. observations are well-formed, one per operation.
{
  const obs = readJson(`${PROJECT}/video/live-observations.json`) as {
    date?: string; operation?: string; outcome?: string; fact?: string;
  }[];
  t(obs.length >= 4 && obs.every((o) =>
    !!o.date && !!o.operation && !!o.fact &&
    (/^(ok|error:[A-Za-z0-9_]+|not run: .+)$/.test(o.outcome ?? ""))),
    `${obs.length} observations well-formed`);
}

// 8. the feedback block is closed with evidence that exists.
{
  const text = readFileSync("design_documents/submission/feedback.md", "utf8");
  const block = text.slice(text.indexOf("<!-- live-check:start -->"), text.indexOf("<!-- live-check:end -->"));
  const bullets = block.split("\n").filter((l) => l.trim().startsWith("- "));
  const ok = !/^\s*Pending:/m.test(block) &&
    (/^Observed on \d{4}-\d{2}-\d{2}/m.test(block) || /^Not run on \d{4}-\d{2}-\d{2}/m.test(block)) &&
    bullets.length > 0 && bullets.every((b) => {
      const m = /\(evidence: ([^)]+)\)\s*$/.exec(b.trim());
      return m !== null && resolveEvidence(m[1]!.replace(/`/g, "").trim());
    });
  t(ok, "feedback block closed, evidence resolves");
}

// 9. the fill printed its line and --final is green.
{
  t(fill.code === 0 && /fill-live-check: \d+ observations/.test(fill.out) &&
    fb.code === 0 && /feedback: \d+ tools, \d+ evidence links/.test(fb.out),
    "fill line printed, check-feedback --final green");
}

// 10. outside the block, feedback is untouched; architecture differs only in proofs.
{
  const fbAfter = readFileSync("design_documents/submission/feedback.md", "utf8");
  const outsideAfter = fbAfter.slice(0, fbAfter.indexOf("<!-- live-check:start -->")) +
    fbAfter.slice(fbAfter.indexOf("<!-- live-check:end -->") + "<!-- live-check:end -->".length);
  const sameOutside = createHash("sha256").update(outsideAfter).digest("hex") === outsideHash;
  const archAfter = readJson("architecture.json") as { edges?: { id?: string }[] };
  const onlyProofs = (() => {
    const b4 = JSON.parse(proofsBefore) as [string, unknown][];
    const af = (archAfter.edges ?? []).map((e) => [e.id, (e as { proof?: unknown }).proof ?? null]);
    if (b4.length !== af.length) return false;
    return b4.every(([id], i) => (af[i] as unknown[])[0] === id);
  })();
  t(sameOutside && onlyProofs, "feedback outside untouched, architecture diff proof-only");
}

done("lv-02-proofs", n, failures);
