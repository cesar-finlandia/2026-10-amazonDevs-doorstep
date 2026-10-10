// scripts/verify/sk-02-ledger.ts — DP-SCRIPT WU-02 (10 checks).
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { check, done, runNode } from "../video/lib.js";
import { PROJECT } from "../video/lib.js";

const failures: string[] = [];
let n = 0;
const t = (ok: boolean, label: string): void => {
  n += 1;
  check(n, ok, label, failures);
};
const ledger = JSON.parse(readFileSync(`${PROJECT}/fact-ledger.json`, "utf8")) as {
  version?: string; rung?: string; runsAgree?: boolean; narrationMayNameBedrock?: boolean;
  rows?: { id?: string; claim?: string; value?: unknown; kind?: string; quote?: string; range?: [number, number]; source?: { file?: string; pointer?: string; command?: string } }[];
};
const harvest = JSON.parse(readFileSync(`${PROJECT}/video/facts/harvest.json`, "utf8")) as { rung?: string; runsAgree?: boolean };

// 1. Ledger header matches harvest; bedrock naming only on bedrock+bedrock.
{
  const s1 = JSON.parse(readFileSync(`${PROJECT}/video/facts/run-1/status.json`, "utf8")) as { agent?: { kind?: string } };
  const s2 = JSON.parse(readFileSync(`${PROJECT}/video/facts/run-2/status.json`, "utf8")) as { agent?: { kind?: string } };
  const norm = (k: string): string => {
    const l = (k ?? "").toLowerCase();
    if (l.includes("bedrock") && !l.includes("not bedrock")) return "bedrock";
    return l;
  };
  const expectNaming = ledger.rung === "bedrock" && norm(s1.agent?.kind ?? "") === "bedrock" && norm(s2.agent?.kind ?? "") === "bedrock";
  t(
    ledger.version === "1.0.0" && ledger.rung === harvest.rung && ledger.runsAgree === harvest.runsAgree &&
      ledger.narrationMayNameBedrock === expectNaming,
    "ledger header + bedrock rule",
  );
}

// 2. Eleven ids unique.
{
  const ids = (ledger.rows ?? []).map((r) => r.id);
  const want = ["F-roles", "F-actions-called", "F-verify-passes", "F-errors-first", "F-errors-last", "F-checkpoints", "F-featured-hour", "F-actions-total", "F-bundle-days", "F-bundle-events", "F-rung"];
  t(want.every((id) => ids.includes(id)) && new Set(ids).size === ids.length, "eleven unique ids");
}

// 3. Row shapes; sources exist.
{
  const { existsSync } = await import("node:fs");
  let ok = true;
  for (const r of ledger.rows ?? []) {
    if (!r.claim || !["measured", "constant", "static", "modelled"].includes(r.kind ?? "") || !["exact", "range", "none"].includes(r.quote ?? "")) ok = false;
    const f = r.source?.file ?? "";
    const p = f.startsWith("video/") || f === "fact-ledger.json" ? `${PROJECT}/${f}` : f;
    if (!existsSync(p)) ok = false;
  }
  t(ok, "row shapes + sources exist");
}

// 4. Range discipline.
{
  let ok = true;
  for (const r of ledger.rows ?? []) {
    if (r.quote === "range" && !(Array.isArray(r.range) && (r.range[0] as number) < (r.range[1] as number))) ok = false;
    if (r.quote === "exact" && r.range !== undefined) ok = false;
  }
  t(ok, "range discipline");
}

// 5. Static cross-checks.
{
  const facts = JSON.parse(readFileSync("design_documents/showcase-facts.json", "utf8")) as { actions?: number };
  const bundle = JSON.parse(readFileSync("data/bundle/doorstep-14d.json", "utf8")) as {
    inbox?: { timestamp?: string }[]; history?: Record<string, { items?: { timestamp?: string }[] }[]>;
  };
  let events = (bundle.inbox ?? []).length;
  const dates = new Set<string>();
  for (const p of bundle.inbox ?? []) if (p.timestamp !== undefined) dates.add(p.timestamp.slice(0, 10));
  for (const pages of Object.values(bundle.history ?? {})) {
    for (const page of pages ?? []) {
      for (const it of page.items ?? []) {
        events += 1;
        if (it.timestamp !== undefined) dates.add(it.timestamp.slice(0, 10));
      }
    }
  }
  const byId = new Map((ledger.rows ?? []).map((r) => [r.id, r]));
  t(
    (byId.get("F-actions-total")?.value as number) === facts.actions &&
      (byId.get("F-bundle-events")?.value as number) === events &&
      (byId.get("F-bundle-days")?.value as number) === dates.size,
    `statics cross-check (events=${events} days=${dates.size})`,
  );
}

// 6. check-ledger holds.
{
  const r = runNode(["scripts/video/check-ledger.ts"]);
  t(r.code === 0 && /ledger: \d+ facts hold/.test(r.out), "check-ledger holds");
}

// 7. Tampered copy differs loudly; real ledger hashed stable.
{
  const before = createHash("sha256").update(readFileSync(`${PROJECT}/fact-ledger.json`)).digest("hex");
  const copy = JSON.parse(JSON.stringify(ledger)) as typeof ledger;
  const num = copy.rows?.find((r) => r.quote === "exact" && typeof r.value === "number");
  let ok = num !== undefined;
  if (num !== undefined) {
    num.value = (num.value as number) + 1;
    const { writeFileSync } = await import("node:fs");
    writeFileSync(`${PROJECT}/video/facts/ledger-tampered.json`, JSON.stringify(copy), "utf8");
    const r = runNode(["scripts/video/check-ledger.ts", "--ledger", `${PROJECT}/video/facts/ledger-tampered.json`]);
    ok = r.code === 1 && r.out.includes(`ledger: ${num.id} differs`);
    const { rmSync } = await import("node:fs");
    rmSync(`${PROJECT}/video/facts/ledger-tampered.json`, { force: true });
  }
  const after = createHash("sha256").update(readFileSync(`${PROJECT}/fact-ledger.json`)).digest("hex");
  t(ok && before === after, "tamper detected, ledger stable");
}

// 8. screen-reality steps + regions.
{
  const sr = JSON.parse(readFileSync(`${PROJECT}/video/facts/screen-reality.json`, "utf8")) as Record<string, { regions?: Record<string, unknown> }>;
  const ids = Object.keys(sr);
  const regionCount = new Set(Object.values(sr).flatMap((r) => Object.keys(r.regions ?? {}))).size;
  const want = ["open", "week", "review", "approve", "circle", "walk", "focus", "dusk"];
  t(want.every((id) => ids.includes(id)) && regionCount >= 8, `screen-reality 8 steps, ${regionCount} regions`);
}

// 9. Regions have text or rect; approval-bar at approve.
{
  const sr = JSON.parse(readFileSync(`${PROJECT}/video/facts/screen-reality.json`, "utf8")) as Record<string, { regions?: Record<string, { text?: string; rect?: { x: number; y: number; width: number; height: number } | null }> }>;
  let ok = true;
  for (const [id, entry] of Object.entries(sr)) {
    void id;
    for (const r of Object.values(entry.regions ?? {})) {
      const rect = r.rect;
      const rectOk = rect !== null && rect !== undefined && rect.width > 0 && rect.height > 0 && rect.x + rect.width <= 1920 && rect.y + rect.height <= 1080;
      if (!((r.text ?? "") !== "" || rectOk)) ok = false;
    }
  }
  const approve = sr["approve"]?.regions ?? {};
  t(ok && "approval-bar" in approve, "regions have text/rect; approval-bar at approve");
}

// 10. PNGs 1920x1080 and > 10 kB.
{
  const { default: sharp } = await import("sharp");
  let ok = true;
  for (const id of ["open", "week", "review", "approve", "circle", "walk", "focus", "dusk"]) {
    try {
      const meta = await (sharp as (p: string) => { metadata(): Promise<{ width?: number; height?: number }> })(`${PROJECT}/video/facts/reality/${id}.png`).metadata();
      const { statSync } = await import("node:fs");
      if (meta.width !== 1920 || meta.height !== 1080 || statSync(`${PROJECT}/video/facts/reality/${id}.png`).size <= 10000) ok = false;
    } catch {
      ok = false;
    }
  }
  t(ok, "PNGs 1920x1080 >10kB");
}

done("sk-02-ledger", n, failures);
