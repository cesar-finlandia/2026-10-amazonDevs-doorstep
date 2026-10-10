// scripts/verify/sb-03-feedback.ts — DP-SUBMISSION WU-03 (10 checks).
// Requirement IDs: FR-25 (part)
import { readFileSync } from "node:fs";
import { createChecker } from "./ui-kit.js";
import { run } from "./e2e-kit.js";
import { scanBanned } from "../lib/submission.js";

const c = createChecker("sb-03-feedback");
const text = readFileSync("design_documents/submission/feedback.md", "utf8").replace(/\r/g, "");
const tools = [
  "Ring REST API and OAuth", "Ring webhooks", "Ring live sessions (WHEP)",
  "Ring Developer Playground token", "Ring Appstore MCP", "Amazon Bedrock",
  "Strands Agents SDK", "Amazon Bedrock AgentCore",
];
const heads = ["Used for", "What worked", "What needs work", "Zero to hello-world", "Would I build with it again"];
const sectionOf = (t: string): string => {
  const i = text.indexOf(`## ${t}`);
  if (i === -1) return "";
  const rest = text.slice(i);
  const lines = rest.split("\n").slice(1);
  const out: string[] = [];
  for (const l of lines) {
    if (/^##(?!#)\s+/.test(l)) break;
    out.push(l);
  }
  return out.join("\n");
};

// 1. Ten h2 sections in order.
let last = -1;
let orderOk = true;
for (const t of [...tools, "AWS Builder", "Other tools"]) {
  const i = text.indexOf(`## ${t}`, last + 1);
  if (i === -1 || i < last) { orderOk = false; break; }
  last = i;
}
c.ok(orderOk, "ten h2 sections in order");

// 2. Five h3s ordered and non-empty in the first eight.
let hOk = true;
for (const t of tools) {
  const body = sectionOf(t);
  let li = -1;
  for (const h of heads) {
    const i = body.indexOf(`### ${h}`);
    if (i === -1 || i < li) { hOk = false; break; }
    li = i;
  }
  for (const h of heads) {
    const i = body.indexOf(`### ${h}`);
    const next = body.indexOf("### ", i + 1);
    const chunk = (next === -1 ? body.slice(i) : body.slice(i, next)).replace(`### ${h}`, "").trim();
    if (chunk === "") hOk = false;
  }
}
c.ok(hOk, "five h3s ordered and non-empty");

// 3. Would-answers Yes/No + >= 6-word reason.
let wOk = true;
for (const t of tools) {
  const body = sectionOf(t);
  const i = body.indexOf("### Would I build with it again");
  const first = body.slice(i).replace("### Would I build with it again", "").trim().split("\n").filter((l) => l.trim() !== "").join(" ");
  const m = /^(Yes|No)[,:]\s*(.+)$/.exec(first);
  if (!m || (m[2] as string).split(/\s+/).length < 6) wOk = false;
}
c.ok(wOk, "would-answers Yes/No + reason");

// 4. Needs-work bullets with resolvable evidence (reuses the checker rule).
{
  const friction = readFileSync("design_documents/friction-log.md", "utf8");
  const flIds = new Set<string>();
  for (const m of friction.matchAll(/^## (FL-\d+)/gm)) flIds.add(m[1] as string);
  const { existsSync } = await import("node:fs");
  let bOk = true;
  for (const t of tools) {
    const body = sectionOf(t);
    const i = body.indexOf("### What needs work");
    const next = body.indexOf("### ", i + 1);
    const chunk = next === -1 ? body.slice(i) : body.slice(i, next);
    const bullets = chunk.split("\n").filter((l) => l.trim().startsWith("- "));
    if (bullets.length === 0) { bOk = false; continue; }
    for (const b of bullets) {
      const m = /\(evidence: ([^)]+)\)\s*$/.exec(b.trim());
      if (!m) { bOk = false; continue; }
      const ref = (m[1] as string).replace(/`/g, "").trim();
      if (/^FL-\d+$/.test(ref)) { if (!flIds.has(ref)) bOk = false; }
      else if (!existsSync(ref)) bOk = false;
    }
  }
  c.ok(bOk, "needs-work bullets evidence-linked");
}

// 5. Hello-world step counts + named targets.
{
  const { existsSync } = await import("node:fs");
  let sOk = true;
  for (const t of tools) {
    const body = sectionOf(t);
    const i = body.indexOf("### Zero to hello-world");
    const next = body.indexOf("### ", i + 1);
    const chunk = (next === -1 ? body.slice(i) : body.slice(i, next)).replace("### Zero to hello-world", "");
    const steps = chunk.split("\n").filter((l) => /^\d+\.\s/.test(l.trim()));
    if (steps.length < 1 || steps.length > 6) { sOk = false; continue; }
    const named = steps.some((s) => {
      const mm = /(scripts\/[\w-]+\.ts|design_documents\/[\w.-]+|JUDGES\.md|src\/[\w/-]+\.ts)/.exec(s);
      return mm !== null && existsSync(mm[1] as string);
    });
    if (!named) sOk = false;
  }
  c.ok(sOk, "hello-world steps + targets");
}

// 6. AgentCore not-used + >= 10-word reason.
{
  const body = sectionOf("Amazon Bedrock AgentCore");
  c.ok(body.includes("not used") && body.split(/\s+/).length >= 10, "agentcore not-used");
}

// 7. AWS Builder verbatim six-line answer + table + SDK strings.
{
  const body = sectionOf("AWS Builder");
  const verbatim = "Amazon Bedrock runs the agent's four model roles through the Converse API with a Bedrock API key; the Strands Agents SDK drives the tool loop. Both are called at runtime from src/llm and src/agent, and the architecture file records the call.";
  const bedrockClient = readFileSync("src/llm/bedrock-client.ts", "utf8");
  const strands = readFileSync("src/llm/strands-adapter.ts", "utf8");
  c.ok(
    body.startsWith(verbatim) && body.includes("| Amazon Bedrock |") && body.includes("| Strands Agents SDK |") &&
      body.includes("`src/llm/bedrock-client.ts`") && body.includes("`src/llm/strands-adapter.ts`") &&
      bedrockClient.includes("@aws-sdk/client-bedrock-runtime") && strands.includes("@strands-agents/sdk"),
    "AWS Builder verbatim + table + SDK strings",
  );
}

// 8. Other-tools rows.
{
  const body = sectionOf("Other tools");
  c.ok(
    ["Gemini on Vertex AI", "Google Cloud Run", "Playwright", "React Three Fiber", "Express"].every((r) => body.includes(r)),
    "other-tools rows",
  );
}

// 9. Clean scans.
{
  const hits = scanBanned(["design_documents/submission/feedback.md"]);
  c.ok(
    hits.length === 0 && !/TODO|{{/.test(text) && !/\/home\/|\/Users\/|C:[\\/]/.test(text) && !text.includes("Bearer "),
    `feedback clean (${hits.map((h) => `${h.file}:${h.line}`).join(",") || "no hits"})`,
  );
}

// 10. Checker green + final pending.
{
  const r = run("npx", ["vite-node", "scripts/check-feedback.ts"]);
  const m = /feedback: 8 tools, (\d+) evidence links/.exec(r.out);
  const f = run("npx", ["vite-node", "scripts/check-feedback.ts", "--final"]);
  c.ok(
    r.code === 0 && m !== null && Number(m[1]) >= 8 && f.code === 1 && f.out.includes("feedback: live-check still pending"),
    "checker green, final pending",
  );
}

c.done();
