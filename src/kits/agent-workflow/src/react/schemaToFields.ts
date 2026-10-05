// Requirement IDs: HEE-KIT-02
export type Field = {
  name: string;
  label: string;
  kind: "string" | "number" | "integer" | "boolean" | "enum" | "json";
  required: boolean;
  options?: string[];
};

function labelFor(name: string): string {
  return name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function schemaToFields(schema: Record<string, unknown>): Field[] {
  const s = schema as {
    properties?: Record<string, { type?: string; enum?: unknown[]; description?: string }>;
    required?: string[];
  };
  const properties = s.properties ?? {};
  const required = new Set(s.required ?? []);
  return Object.entries(properties).map(([name, prop]) => {
    const type = prop.type ?? "string";
    let kind: Field["kind"] = "string";
    let options: string[] | undefined;
    if (Array.isArray(prop.enum)) {
      kind = "enum";
      options = prop.enum.map((v) => String(v));
    } else if (type === "number") kind = "number";
    else if (type === "integer") kind = "integer";
    else if (type === "boolean") kind = "boolean";
    else if (type === "object" || type === "array") kind = "json";
    return { name, label: labelFor(name), kind, required: required.has(name), options };
  });
}

export function parseFieldValues(
  fields: Field[],
  raw: Record<string, string>,
): { ok: true; args: Record<string, unknown> } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  const args: Record<string, unknown> = {};
  for (const field of fields) {
    const value = raw[field.name];
    if (value === undefined || value === "") {
      if (field.required) errors.push(`missing required field ${field.name}`);
      continue;
    }
    switch (field.kind) {
      case "string":
        args[field.name] = value;
        break;
      case "enum":
        if (field.options && !field.options.includes(value)) {
          errors.push(`field ${field.name}: expected one of ${field.options.join(", ")}`);
        } else {
          args[field.name] = value;
        }
        break;
      case "number": {
        const n = Number(value);
        if (!Number.isFinite(n)) errors.push(`field ${field.name}: expected a number`);
        else args[field.name] = n;
        break;
      }
      case "integer": {
        const n = Number(value);
        if (!Number.isInteger(n)) errors.push(`field ${field.name}: expected an integer`);
        else args[field.name] = n;
        break;
      }
      case "boolean": {
        const lower = value.toLowerCase();
        if (lower === "true") args[field.name] = true;
        else if (lower === "false") args[field.name] = false;
        else errors.push(`field ${field.name}: expected true or false`);
        break;
      }
      case "json":
        try {
          args[field.name] = JSON.parse(value) as unknown;
        } catch (e) {
          errors.push(`field ${field.name}: invalid JSON: ${(e as Error).message ?? String(e)}`);
        }
        break;
    }
  }
  return errors.length > 0 ? { ok: false, errors } : { ok: true, args };
}
