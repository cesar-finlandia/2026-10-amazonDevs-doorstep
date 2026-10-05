// Requirement IDs: HEE-KIT-02
import type { StepFn } from "../adapters/inApp.js";

interface ScriptStep {
  calls?: { name: string; args: Record<string, unknown> }[];
  text?: string;
}

const SCRIPT: ScriptStep[] = [
  { calls: [{ name: "list_widgets", args: {} }] },
  { calls: [{ name: "add_widget", args: { name: "alpha", shelfId: "shelf-a", size: 1 } }] },
  { calls: [{ name: "add_widget", args: { name: "beta", shelfId: "shelf-a", size: 1 } }] },
  { calls: [{ name: "add_widget", args: { name: "gamma", shelfId: "shelf-a", size: 1 } }] },
  { calls: [{ name: "add_widget", args: { name: "delta", shelfId: "shelf-a", size: 1 } }] },
  { calls: [{ name: "add_widget", args: { name: "epsilon", shelfId: "shelf-a", size: 1 } }] },
  { calls: [{ name: "add_widget", args: { name: "zeta", shelfId: "shelf-a", size: 1 } }] },
  { calls: [{ name: "check_shelves", args: {} }] },
  { calls: [{ name: "move_widget", args: { name: "zeta", shelfId: "shelf-b" } }] },
  { calls: [{ name: "check_shelves", args: {} }] },
  { calls: [{ name: "remove_widget", args: { name: "epsilon" } }] },
  { text: "Stocked 6 widgets across Alpha and Beta, repaired the overflow, and removed epsilon." },
];

export function createScriptedStep(): StepFn {
  let index = 0;
  return async () => {
    const step = SCRIPT[index++] ?? { text: "Script exhausted." };
    if (step.calls) {
      return {
        ok: true,
        result: {
          text: "",
          functionCalls: step.calls.map((c) => ({ name: c.name, args: c.args })),
          usage: { promptTokens: 50, outputTokens: 20, totalTokens: 70 },
          model: "scripted",
          latencyMs: 5,
        },
      };
    }
    return {
      ok: true,
      result: {
        text: step.text ?? "",
        functionCalls: [],
        usage: { promptTokens: 50, outputTokens: 20, totalTokens: 70 },
        model: "scripted",
        latencyMs: 5,
      },
    };
  };
}
