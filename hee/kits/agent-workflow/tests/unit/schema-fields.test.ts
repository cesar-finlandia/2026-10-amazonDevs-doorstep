// Requirement IDs: HEE-KIT-02
import { describe, expect, it } from "vitest";
import { parseFieldValues, schemaToFields } from "../../src/react/schemaToFields.js";

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    name: { type: "string", description: "Widget name" },
    colour: { type: "string", enum: ["red", "blue"], description: "Colour choice" },
    size: { type: "number", description: "Size in units" },
    count: { type: "integer", description: "How many" },
    active: { type: "boolean", description: "Is active" },
    filter: { type: "object", description: "Filter document" },
    tags: { type: "array", description: "Tag list" },
  },
  required: ["name", "size"],
};

describe("schemaToFields", () => {
  it("maps string fields", () => {
    const fields = schemaToFields(SCHEMA);
    expect(fields.find((f) => f.name === "name")).toMatchObject({ kind: "string", required: true, label: "Name" });
  });

  it("maps enums with options", () => {
    const fields = schemaToFields(SCHEMA);
    expect(fields.find((f) => f.name === "colour")).toMatchObject({ kind: "enum", options: ["red", "blue"] });
  });

  it("maps numbers", () => {
    expect(schemaToFields(SCHEMA).find((f) => f.name === "size")).toMatchObject({ kind: "number", required: true });
  });

  it("maps integers", () => {
    expect(schemaToFields(SCHEMA).find((f) => f.name === "count")).toMatchObject({ kind: "integer", required: false });
  });

  it("maps booleans", () => {
    expect(schemaToFields(SCHEMA).find((f) => f.name === "active")).toMatchObject({ kind: "boolean" });
  });

  it("maps objects and arrays to json", () => {
    expect(schemaToFields(SCHEMA).find((f) => f.name === "filter")).toMatchObject({ kind: "json" });
    expect(schemaToFields(SCHEMA).find((f) => f.name === "tags")).toMatchObject({ kind: "json" });
  });
});

describe("parseFieldValues", () => {
  it("converts every type", () => {
    const fields = schemaToFields(SCHEMA);
    const res = parseFieldValues(fields, {
      name: "alpha",
      colour: "red",
      size: "2.5",
      count: "3",
      active: "true",
      filter: '{"a":1}',
      tags: '["x"]',
    });
    expect(res).toEqual({
      ok: true,
      args: { name: "alpha", colour: "red", size: 2.5, count: 3, active: true, filter: { a: 1 }, tags: ["x"] },
    });
  });

  it("reports missing required fields", () => {
    const res = parseFieldValues(schemaToFields(SCHEMA), { size: "1" });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errors.join(" ")).toMatch(/missing required field name/);
  });

  it("reports invalid JSON", () => {
    const res = parseFieldValues(schemaToFields(SCHEMA), { name: "a", size: "1", filter: "{oops" });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errors.join(" ")).toMatch(/field filter: invalid JSON/);
  });

  it("reports bad numbers, integers and booleans", () => {
    const bad = parseFieldValues(schemaToFields(SCHEMA), { name: "a", size: "lots", count: "2.5", active: "maybe" });
    expect(bad.ok).toBe(false);
    if (!bad.ok) {
      expect(bad.errors.join(" ")).toMatch(/field size: expected a number/);
      expect(bad.errors.join(" ")).toMatch(/field count: expected an integer/);
      expect(bad.errors.join(" ")).toMatch(/field active: expected true or false/);
    }
  });
});
