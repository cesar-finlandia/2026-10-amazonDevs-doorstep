// Requirement IDs: HEE-KIT-02
import { describe, expect, it } from "vitest";
import { createTruthEngine } from "../../src/truth/truthEngine.js";
import type { Issue } from "../../src/truth/truthEngine.js";

describe("truthEngine", () => {
  it("dedupes duplicate issue ids with ~2, ~3 suffixes", () => {
    const engine = createTruthEngine<unknown>([
      {
        id: "r1",
        description: "first",
        check: () => [
          { id: "dup", severity: "error", entityIds: [], message: "one" },
          { id: "dup", severity: "warning", entityIds: [], message: "two" },
        ],
      },
      {
        id: "r2",
        description: "second",
        check: () => [{ id: "dup", severity: "error", entityIds: [], message: "three" } as Issue],
      },
    ]);
    const issues = engine.check({});
    expect(issues.map((i) => i.id)).toEqual(["dup", "dup~2", "dup~3"]);
    expect(engine.counts(issues)).toEqual({ errors: 2, warnings: 1 });
  });

  it("survives a crashing rule and keeps the others", () => {
    const engine = createTruthEngine<unknown>([
      {
        id: "bad",
        description: "crashes",
        check: () => {
          throw new Error("kaput");
        },
      },
      {
        id: "good",
        description: "fine",
        check: () => [{ id: "ok-issue", severity: "warning", entityIds: ["a"], message: "all good" }],
      },
    ]);
    const issues = engine.check({});
    expect(issues[0]).toMatchObject({
      id: "bad!crashed",
      severity: "error",
      message: "rule bad crashed: kaput",
    });
    expect(issues[1]?.id).toBe("ok-issue");
  });
});
