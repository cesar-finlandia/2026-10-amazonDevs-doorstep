// scripts/check-feedback.ts — DP-SUBMISSION WU-03 (six rules of §5.3).
// Prints `feedback: <n> tools, <m> evidence links`. With --final also fails
// while the live-check block says Pending: (`feedback: live-check still pending`).
import { existsSync, readFileSync } from "node:fs";

const text = readFileSync("design_documents/submission/feedback.md", "utf8").replace(/\r/g, "");
const failures: string[] = [];
const tools = [
  "Ring REST API and OAuth", "Ring webhooks", "Ring live sessions (WHEP)",
  "Ring Developer Playground token", "Ring Appstore MCP", "Amazon Bedrock",
  "Strands Agents SDK", "Amazon Bedrock AgentCore",
];
const heads = ["Used for", "What worked", "What needs work", "Zero to hello-world", "Would I build with it again"];

// Split into the ten ## sections.
const sections = new Map<string, string>();
{
  const lines = text.split("\n");
  let cur = "";
  let buf: string[] = [];
  for (const l of lines) {
    const m = /^##(?!#)\s+(.*)$/.exec(l);
    if (m) {
      if (cur !== "") sections.set(cur, buf.join("\n"));
      cur = (m[1] as string).trim();
      buf = [];
    } else if (cur !== "") buf.push(l);
  }
  if (cur !== "") sections.set(cur, buf.join("\n"));
}

// 1-2. Headings present, ordered, non-empty.
for (const t of tools) {
  const body = sections.get(t) ?? "";
  if (body === "") { failures.push(`section ${t} missing`); continue; }
  let last = -1;
  for (const h of heads) {
    const i = body.indexOf(`### ${h}`);
    if (i === -1 || i < last) { failures.push(`section ${t} heading ${h}`); break; }
    last = i;
  }
  for (const h of heads) {
    const i = body.indexOf(`### ${h}`);
    const next = body.indexOf("### ", i + 1);
    const chunk = (next === -1 ? body.slice(i) : body.slice(i, next)).replace(`### ${h}`, "").trim();
    if (chunk === "") failures.push(`section ${t} ${h} empty`);
  }
}

// 3. Would-answers start Yes/No + >= 6-word reason.
for (const t of tools) {
  const body = sections.get(t) ?? "";
  const i = body.indexOf("### Would I build with it again");
  const chunk = body.slice(i).replace("### Would I build with it again", "").trim().split("\n").filter((l) => l.trim() !== "");
  const first = chunk.join(" ");
  const m = /^(Yes|No)[,:]\s*(.+)$/.exec(first);
  if (!m || (m[2] as string).split(/\s+/).length < 6) failures.push(`section ${t} would-answer`);
}

// 4. Needs-work bullets end with (evidence: ref); refs resolve.
let evidence = 0;
const friction = readFileSync("design_documents/friction-log.md", "utf8").replace(/\r/g, "");
const flIds = new Set<string>();
for (const m of friction.matchAll(/^## (FL-\d+)/gm)) flIds.add(m[1] as string);
for (const t of tools) {
  const body = sections.get(t) ?? "";
  const i = body.indexOf("### What needs work");
  const next = body.indexOf("### ", i + 1);
  const chunk = next === -1 ? body.slice(i) : body.slice(i, next);
  const bullets = chunk.split("\n").filter((l) => l.trim().startsWith("- "));
  if (bullets.length === 0) { failures.push(`section ${t} no bullets`); continue; }
  for (const b of bullets) {
    const m = /\(evidence: ([^)]+)\)\s*$/.exec(b.trim());
    if (!m) { failures.push(`section ${t} bullet without evidence: ${b.trim().slice(0, 60)}`); continue; }
    const ref = (m[1] as string).replace(/`/g, "").trim();
    if (/^FL-\d+$/.test(ref)) {
      if (!flIds.has(ref)) failures.push(`section ${t} unknown ${ref}`);
      else evidence += 1;
    } else {
      if (!existsSync(ref)) failures.push(`section ${t} missing path ${ref}`);
      else evidence += 1;
    }
  }
}

// 5. Hello-world 1-6 numbered steps naming an existing script/doc.
for (const t of tools) {
  const body = sections.get(t) ?? "";
  const i = body.indexOf("### Zero to hello-world");
  const next = body.indexOf("### ", i + 1);
  const chunk = (next === -1 ? body.slice(i) : body.slice(i, next)).replace("### Zero to hello-world", "");
  const steps = chunk.split("\n").filter((l) => /^\d+\.\s/.test(l.trim()));
  if (steps.length < 1 || steps.length > 6) { failures.push(`section ${t} step count ${steps.length}`); continue; }
  const namesTarget = steps.some((s) => /scripts\/[\w-]+\.ts|design_documents\/[\w.-]+|JUDGES\.md|src\/[\w/-]+\.ts/.test(s) && (() => {
    const mm = /(scripts\/[\w-]+\.ts|design_documents\/[\w.-]+|JUDGES\.md|src\/[\w/-]+\.ts)/.exec(s);
    return mm !== null && existsSync(mm[1] as string);
  })());
  if (!namesTarget) failures.push(`section ${t} hello-world names nothing existing`);
}

// 6. AgentCore not-used + >= 10-word reason.
{
  const body = sections.get("Amazon Bedrock AgentCore") ?? "";
  const words = body.split(/\s+/).length;
  if (!/not used/.test(body) || words < 10) failures.push("agentcore not-used reason");
}

// AWS Builder + Other tools presence (structural; content checked by sb-03).
{
  if (!sections.has("AWS Builder")) failures.push("AWS Builder missing");
  if (!sections.has("Other tools")) failures.push("Other tools missing");
}

// Banned/TODO/{{ + absolute path.
{
  const { scanBanned } = await import("./lib/submission.js");
  if (scanBanned(["design_documents/submission/feedback.md"]).length > 0) failures.push("banned hit");
  if (/TODO|{{/.test(text)) failures.push("TODO/placeholder");
  if (/\/home\/|\/Users\/|C:[\\/]/.test(text) || text.includes("Bearer ")) failures.push("path/secret");
}

if (process.argv.includes("--final")) {
  const si = text.indexOf("<!-- live-check:start -->");
  const ei = text.indexOf("<!-- live-check:end -->");
  const block = si !== -1 && ei > si ? text.slice(si, ei) : "";
  if (/^\s*Pending:/m.test(block)) {
    console.log("feedback: live-check still pending");
    process.exit(1);
  }
}

if (failures.length > 0) {
  for (const f of failures) console.error(`FAIL ${f}`);
  process.exit(1);
}
console.log(`feedback: 8 tools, ${evidence} evidence links`);
