// Requirement IDs: FR-18
import { fit } from "src/context";
import type { Buffer as ContextBuffer } from "src/context";
import type { Content } from "src/kits/agent-workflow/src/llm/types.js";
/** Fits the actor's `contents` into the budget with the chassis `fit` (pinned first user turn, sliding window of the rest),
 *  never splitting a model functionCall turn from its functionResponse turn. Returns the same array when nothing is evicted. */
export function fitTurns(contents: Content[], opts?: { contextWindow?: number; reservedOutput?: number }): { contents: Content[]; evicted: number } {
  if (contents.length === 0) return { contents, evicted: 0 };
  // Group into units: unit 0 is the first user turn (pinned); thereafter each
  // model turn plus the user turn that answers it forms one unit.
  const units: Content[][] = [[contents[0] as Content]];
  for (let i = 1; i < contents.length; i++) {
    const turn = contents[i] as Content;
    if (turn.role === "model") {
      units.push([turn]);
    } else {
      (units[units.length - 1] as Content[]).push(turn);
    }
  }
  const buffer: ContextBuffer = units.map((turns, i) => ({
    role: "user",
    content: JSON.stringify({ i, turns }),
    metadata: { pinned: i === 0 },
  }));
  const res = fit(buffer, {
    model_profile: "generic-heuristic",
    context_window: opts?.contextWindow ?? 150000,
    reserved_output: opts?.reservedOutput ?? 4096,
    strategy: "sliding-window-pinned",
  });
  const kept = new Set<number>();
  for (const m of res.buffer) {
    try {
      const parsed = JSON.parse(m.content) as { i?: unknown };
      if (typeof parsed.i === "number") kept.add(parsed.i);
    } catch {
      /* ignore malformed survivors */
    }
  }
  if (kept.size === units.length) return { contents, evicted: 0 };
  const out: Content[] = [];
  units.forEach((turns, i) => {
    if (kept.has(i)) out.push(...turns);
  });
  return { contents: out, evicted: units.length - kept.size };
}
