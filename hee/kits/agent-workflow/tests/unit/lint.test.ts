// Requirement IDs: HEE-KIT-02
import { describe, expect, it } from "vitest";
import { lintDescriptor } from "../../src/registry/lint.js";
import type { ActionDescriptor } from "../../src/registry/types.js";

function valid(): ActionDescriptor<unknown> {
  return {
    name: "add_widget",
    title: "Add widget",
    group: "change",
    description: "Adds a widget to a shelf. Sizes are whole units. Example: add_widget({\"name\": \"a\"}).",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: { name: { type: "string", description: "Widget name" } },
      required: ["name"],
    },
    annotations: { readOnly: false, destructive: false, untrustedContent: false },
    handler: () => ({ ok: true, summary: "added" }),
  };
}

describe("lintDescriptor", () => {
  it("accepts a valid descriptor", () => {
    expect(lintDescriptor(valid())).toEqual([]);
  });

  it("rule 1: bad names fail", () => {
    const d = valid();
    d.name = "AddWidget";
    expect(lintDescriptor(d).join(" ")).toMatch(/name/);
  });

  it("rule 2: empty titles fail", () => {
    const d = valid();
    d.title = "";
    expect(lintDescriptor(d).join(" ")).toMatch(/title/);
  });

  it("rule 3: short descriptions without Example fail", () => {
    const d = valid();
    d.description = "Does a thing.";
    expect(lintDescriptor(d).join(" ")).toMatch(/Example/);
  });

  it("rule 4: schemas without additionalProperties:false fail", () => {
    const d = valid();
    d.inputSchema = { type: "object", properties: {} };
    expect(lintDescriptor(d).join(" ")).toMatch(/additionalProperties/);
  });

  it("rule 5: properties without descriptions fail", () => {
    const d = valid();
    d.inputSchema = {
      type: "object",
      additionalProperties: false,
      properties: { name: { type: "string" } },
    };
    expect(lintDescriptor(d).join(" ")).toMatch(/property name/);
  });

  it("rule 6: closed id-like props need enums or human names", () => {
    const d = valid();
    d.inputSchema = {
      type: "object",
      additionalProperties: false,
      properties: { target: { type: "string", description: "The target shelf id" } },
    };
    expect(lintDescriptor(d).join(" ")).toMatch(/property target/);
    const ok = valid();
    ok.inputSchema = {
      type: "object",
      additionalProperties: false,
      properties: { target: { type: "string", description: "The target shelf id or name" } },
    };
    expect(lintDescriptor(ok)).toEqual([]);
  });

  it("rule 7: read needs readOnly, destructive forbids it", () => {
    const read = valid();
    read.group = "read";
    read.annotations = { readOnly: false, destructive: false, untrustedContent: false };
    expect(lintDescriptor(read).join(" ")).toMatch(/readOnly/);
    const dest = valid();
    dest.annotations = { readOnly: true, destructive: true, untrustedContent: false };
    expect(lintDescriptor(dest).join(" ")).toMatch(/readOnly/);
  });
});
