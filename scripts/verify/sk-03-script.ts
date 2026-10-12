// scripts/verify/sk-03-script.ts — DP-SCRIPT WU-03 (12 checks).
import { readFileSync } from "node:fs";
import { check, done, runNode, runPy } from "../video/lib.js";
import { PROJECT } from "../video/lib.js";

const failures: string[] = [];
let n = 0;
const t = (ok: boolean, label: string): void => {
  n += 1;
  check(n, ok, label, failures);
};
const md = readFileSync(`${PROJECT}/demo-video-script.md`, "utf8").replace(/\r/g, "");

// 1. Nine ## N. headings in order.
{
  const heads = md.split("\n").filter((l) => /^## [1-9]\. /.test(l)).map((l) => l.replace(/^## /, ""));
  const want = ["1. Header", "2. Fact-check status", "3. Delivery budget", "4. The sections", "5. Fact Ledger", "6. Judging-axis coverage", "7. Corrections applied", "8. Production notes", "9. Graphical assets"];
  t(JSON.stringify(heads) === JSON.stringify(want), "nine sections in order");
}

// 2. Header verbatim bits.
{
  const head = md.slice(0, md.indexOf("## 2. Fact-check status"));
  const style = "Confident documentary narrator. Warm, clear and brisk, around one hundred fifty-five words per minute. A short pause between sentences; no pauses inside short sentences.";
  t(
    head.includes("under 3 minutes (judges not required to watch past 3:00)") && head.includes("Iapetus") &&
      head.includes(style) && head.includes("Know her day without calling."),
    "header cap/voice/style/slogan",
  );
}

// 3. Timed sections consecutive with Visual + counted markers.
{
  const blocks = md.slice(md.indexOf("## 4. The sections"), md.indexOf("## 5. Fact Ledger"));
  const heads = [...blocks.matchAll(/^### \[(\d+:\d+) – (\d+:\d+)\] (.+)$/gm)].map((m) => ({ from: m[1] as string, to: m[2] as string }));
  const toSec = (s: string): number => {
    const [a, b] = s.split(":").map(Number);
    return (a as number) * 60 + (b as number);
  };
  let consec = heads.length === 13 && heads[0]?.from === "0:00";
  for (let i = 1; i < heads.length; i++) {
    if (heads[i]?.from !== heads[i - 1]?.to) consec = false;
  }
  const markers = [...blocks.matchAll(/^\*\((\d+) words — (\d+:\d+)\)\*$/gm)];
  const visual = (blocks.match(/^\*\*\[Visual:/gm) ?? []).length;
  let markersOk = markers.length === 13 && visual === 13;
  // N equals the spoken words of its block (visual/marker/seg lines excluded).
  const proseBlocks = blocks.split(/^<!-- seg: \S+ -->/m).slice(1);
  if (proseBlocks.length === markers.length) {
    for (let i = 0; i < markers.length; i++) {
      const spoken = (proseBlocks[i] ?? "").split("\n").filter((l) => {
        const x = l.trim();
        return x !== "" && !x.startsWith("**[Visual:") && !x.startsWith("*(") && !x.startsWith("<!--") && !x.startsWith("###");
      }).join(" ");
      const words = spoken.split(/\s+/).filter((w) => w !== "").length;
      if (words !== Number(markers[i]?.[1])) markersOk = false;
    }
  } else {
    markersOk = false;
  }
  t(consec && markersOk, `timed sections consecutive, markers counted (${markers.length})`);
}

// 4. Chassis script lint.
{
  const r = runNode(["scripts/lint-script-v2.ts", "hackathon-projects/2026-10-amazonDevs"], "../../hackathons");
  t(r.code === 0, "lint-script-v2 exits 0");
}

// 5. Banned video preset.
{
  const r = runPy(["../../hackathons/_useful/scripts/check_banned_words.py", "--preset", "video", PROJECT]);
  t(r.code === 0, "video banned scan exits 0");
}

// 6. Spoken numbers all ledger-backed (two..twenty+, not "one"). No count
// cap: the operator-demanded orchestration sentence added backed numbers, so
// the gate enforces backing, not brevity (F-model-turns backs nineteen).
{
  const sec4 = md.slice(md.indexOf("## 4. The sections"), md.indexOf("## 5. Fact Ledger"));
  const spoken = sec4.split("\n").filter((l) => {
    const x = l.trim();
    return x !== "" && !x.startsWith("**[Visual:") && !x.startsWith("*(") && !x.startsWith("<!--") && !x.startsWith("###") && !x.startsWith("## ");
  }).join(" ");
  const ledger = JSON.parse(readFileSync(`${PROJECT}/fact-ledger.json`, "utf8")) as { rows?: { claim?: string; value?: unknown }[] };
  const hay = (ledger.rows ?? []).map((r) => `${r.claim ?? ""} ${String(r.value ?? "")}`).join("\n").toLowerCase();
  const spelled = ["two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety", "hundred", "thousand", "zero"];
  const found: string[] = [];
  for (const m of spoken.matchAll(/\d[\d,.]*/g)) found.push(m[0].toLowerCase());
  for (const w of spelled) {
    const re = new RegExp(`\\b${w}\\b`, "gi");
    let mm: RegExpExecArray | null;
    while ((mm = re.exec(spoken)) !== null) found.push(mm[0].toLowerCase());
  }
  t(found.length > 0 && found.every((w) => hay.includes(w)), `numbers backed (${found.join(",") || "none"})`);
}

// 7. No sponsor-service naming (golden rung); no "live" about the agent.
{
  const sec4 = md.slice(md.indexOf("## 4. The sections"), md.indexOf("## 5. Fact Ledger"));
  const ledger = JSON.parse(readFileSync(`${PROJECT}/fact-ledger.json`, "utf8")) as { narrationMayNameBedrock?: boolean; rung?: string };
  const namesBedrock = /bedrock/i.test(sec4);
  const liveAgent = /live (agent|review|run|triage)/i.test(sec4);
  t(
    (!namesBedrock || ledger.narrationMayNameBedrock === true) &&
      (ledger.rung === "bedrock" || !liveAgent),
    "no unbacked naming",
  );
}

// 8. Section 5 rows mirror the ledger + modelled block.
{
  const sec5 = md.slice(md.indexOf("## 5. Fact Ledger"), md.indexOf("## 6. Judging-axis coverage"));
  const ledger = JSON.parse(readFileSync(`${PROJECT}/fact-ledger.json`, "utf8")) as { rows?: { id?: string }[] };
  const ids = (ledger.rows ?? []).map((r) => r.id);
  t(ids.every((id) => sec5.includes(`\`${id}\``)) && sec5.includes("Assumptions and modelled figures") && sec5.includes("None."), "ledger table + modelled block");
}

// 9. Axis quotes verbatim in section 4.
{
  const sec4 = md.slice(md.indexOf("## 4. The sections"), md.indexOf("## 5. Fact Ledger"));
  const sec6 = md.slice(md.indexOf("## 6. Judging-axis coverage"), md.indexOf("## 7. Corrections applied"));
  const quoted = [...sec6.matchAll(/"([^"]+)"/g)].map((m) => m[1] as string).filter((q) => q.length > 10);
  t(quoted.length >= 5 && quoted.every((q) => sec4.includes(q)), `axis quotes verbatim (${quoted.length})`);
}

// 10. Visual regions known.
{
  const sec4 = md.slice(md.indexOf("## 4. The sections"), md.indexOf("## 5. Fact Ledger"));
  const visuals = [...sec4.matchAll(/^\*\*\[Visual:([^*]*)\]/gm)].map((m) => m[1] as string);
  const sr = JSON.parse(readFileSync(`${PROJECT}/video/facts/screen-reality.json`, "utf8")) as Record<string, { regions?: Record<string, unknown> }>;
  const knownRegions = new Set(Object.values(sr).flatMap((r) => Object.keys(r.regions ?? {})));
  const scenes = new Set(["Stage3D", "Statement", "Mechanism", "ArchScene", "ScreenScene", "EndCard"]);
  const regionIds = ["approval-bar", "week-ribbon", "week strip", "check-panel", "incident-card", "activity-feed", "scene-3d", "live-view", "open-checks", "agent-chip", "evidence"];
  let ok = visuals.length > 0;
  for (const v of visuals) {
    if ([...scenes].some((s) => v.includes(s))) continue;
    if (!regionIds.some((r) => v.toLowerCase().includes(r))) ok = false;
  }
  t(ok, `visuals known (${visuals.length})`);
}

// 11. Banned-vocabulary contract via the checker's own list.
{
  const list = runPy(["../../hackathons/_useful/scripts/check_banned_words.py", "--list"]);
  const words = list.out.split("\n").map((l) => l.trim().toLowerCase()).filter((l) => /^[a-z][a-z -]*$/.test(l) && l.length >= 3);
  const low = md.toLowerCase();
  const hits = words.filter((w) => new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(low));
  t(hits.length === 0, `contract words absent (${hits.slice(0, 3).join(",") || "clean"})`);
}

// 12. No path/secret; production notes rule out voiceover plans.
{
  const noUrls = md.replace(/https?:\/\/\S+/g, "URL");
  const prod = md.slice(md.indexOf("## 8. Production notes"));
  t(
    !/[A-Za-z]:[\\/]/.test(noUrls) && !md.includes("Bearer ") &&
      /no manual voiceover/i.test(prod) && !/record (your|my) voice/i.test(prod),
    "no path/secret; notes rule out voiceover",
  );
}

done("sk-03-script", n, failures);
