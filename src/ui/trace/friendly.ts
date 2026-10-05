// src/ui/trace/friendly.ts — plain-words view over the run trace (DP-UI §3.2, §6.7).
// Requirement IDs: FR-09
import type { TraceEntry, TraceWriter } from "src/kits/agent-workflow/src/trace/types.js";
import type { Registry } from "src/kits/agent-workflow/src/registry/types.js";

export interface FriendlyEntry {
  seq: number;
  badge: "AGENT" | "YOU" | "SYSTEM";
  actor: "Reader" | "Planner" | "Agent" | "Writer" | "You" | "System";
  title: string;
  detail: string;
  ok: boolean;
  entityIds: string[];
}

const ROLE_PHRASE: Record<string, { actor: FriendlyEntry["actor"]; title: string }> = {
  extractor: { actor: "Reader", title: "Reader read the records" },
  planner: { actor: "Planner", title: "Planner drew up the review" },
  actor: { actor: "Agent", title: "Agent chose the next step" },
  narrator: { actor: "Writer", title: "Writer wrote it up" },
};

function prettify(name: string): string {
  const spaced = name.replace(/_/g, " ").trim();
  return spaced === "" ? "Step" : spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** Renders registry summaries and model output readable: snake_case tokens
 *  (channel names such as webhook_inbox, action names such as check_week_model)
 *  become plain words so no raw identifier reaches the feed. */
function plain(text: string): string {
  return text.replace(/([A-Za-z])_([A-Za-z])/g, "$1 $2");
}

export function friendlyEntry(e: TraceEntry, titles: Record<string, string>): FriendlyEntry {
  const badge = e.source === "agent" ? "AGENT" : e.source === "human" ? "YOU" : "SYSTEM";
  let actor: FriendlyEntry["actor"];
  let title: string;
  if (e.kind === "approval") {
    actor = e.source === "human" ? "You" : e.source === "system" ? "System" : "Agent";
    title = `Approval · ${typeof e.decision === "string" && e.decision !== "" ? e.decision : "waiting"}`;
  } else if (e.kind === "model") {
    const phrase = ROLE_PHRASE[e.name];
    if (e.source === "human") {
      actor = "You";
      title = titles[e.name] ?? prettify(e.name);
    } else if (e.source === "system") {
      actor = "System";
      title = titles[e.name] ?? prettify(e.name);
    } else if (phrase) {
      actor = phrase.actor;
      title = phrase.title;
    } else {
      actor = "Agent";
      title = titles[e.name] ?? prettify(e.name);
    }
  } else {
    actor = e.source === "human" ? "You" : e.source === "system" ? "System" : "Agent";
    title = titles[e.name] ?? prettify(e.name);
  }
  const parts: string[] = [];
  if (typeof e.output_ref === "string" && e.output_ref.trim() !== "") parts.push(plain(e.output_ref.trim()));
  if (e.state_change && e.state_change.revision_after > e.state_change.revision_before) {
    const n = e.state_change.entity_ids.length;
    parts.push(`changed ${n} ${n === 1 ? "item" : "items"}`);
  }
  if (e.truth) parts.push(`${e.truth.errors} errors, ${e.truth.warnings} warnings`);
  const detail = parts.length > 0 ? parts.join(" · ") : e.ok ? "Finished." : "Did not finish.";
  return {
    seq: e.seq,
    badge,
    actor,
    title,
    detail,
    ok: e.ok,
    entityIds: e.state_change ? [...e.state_change.entity_ids] : [],
  };
}

/** The same shape as TraceWriter, with friendly names and detail, for the kit ActivityFeed. */
export function createFriendlyTrace(trace: TraceWriter, registry: Registry<unknown>): TraceWriter {
  const titles: Record<string, string> = {};
  for (const d of registry.list()) titles[d.name] = d.title;
  const convert = (e: TraceEntry): TraceEntry => {
    const f = friendlyEntry(e, titles);
    const { state_change: _sc, truth: _tr, ...rest } = e;
    void _sc;
    void _tr;
    return { ...rest, name: f.title, output_ref: f.detail };
  };
  return {
    record: (e) => trace.record(e),
    entries: () => trace.entries().map(convert),
    snapshot: () => {
      const s = trace.snapshot();
      return { ...s, entries: s.entries.map(convert) };
    },
    reset: () => trace.reset(),
    subscribe: (fn) => trace.subscribe(fn),
  };
}
