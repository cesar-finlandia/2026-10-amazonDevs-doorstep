// Requirement IDs: HEE-KIT-02
import { useState } from "react";
import type { Registry } from "../registry/types.js";
import { parseFieldValues, schemaToFields } from "./schemaToFields.js";

export interface ManualRunnerProps<M> {
  registry: Registry<M>;
  demoFocus?: string;
}

export function ManualRunner<M>({ registry, demoFocus }: ManualRunnerProps<M>): React.JSX.Element {
  const actions = registry.list();
  const [selected, setSelected] = useState<string>(actions[0]?.name ?? "");
  const [raw, setRaw] = useState<Record<string, string>>({});
  const [result, setResult] = useState<string>("");
  const descriptor = actions.find((a) => a.name === selected);
  const fields = schemaToFields((descriptor?.inputSchema ?? { properties: {} }) as Record<string, unknown>);

  async function run(): Promise<void> {
    if (!descriptor) {
      setResult("no action selected");
      return;
    }
    const parsed = parseFieldValues(fields, raw);
    if (!parsed.ok) {
      setResult(parsed.errors.join("; "));
      return;
    }
    const res = await registry.call(descriptor.name, parsed.args, { source: "human" });
    setResult(res.summary);
  }

  return (
    <div {...(demoFocus ? { "data-demo-focus": demoFocus } : {})}>
      <select
        aria-label="Action"
        value={selected}
        onChange={(ev) => { setSelected(ev.target.value); setRaw({}); setResult(""); }}
      >
        {actions.map((a) => (
          <option key={a.name} value={a.name}>
            {a.title}
          </option>
        ))}
      </select>
      {fields.map((f) => (
        <label key={f.name}>
          {f.label}
          {f.kind === "enum" ? (
            <select
              aria-label={f.label}
              value={raw[f.name] ?? ""}
              onChange={(ev) => setRaw((r) => ({ ...r, [f.name]: ev.target.value }))}
            >
              <option value="">—</option>
              {(f.options ?? []).map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          ) : f.kind === "boolean" ? (
            <select
              aria-label={f.label}
              value={raw[f.name] ?? ""}
              onChange={(ev) => setRaw((r) => ({ ...r, [f.name]: ev.target.value }))}
            >
              <option value="">—</option>
              <option value="true">true</option>
              <option value="false">false</option>
            </select>
          ) : (
            <input
              aria-label={f.label}
              value={raw[f.name] ?? ""}
              onChange={(ev) => setRaw((r) => ({ ...r, [f.name]: ev.target.value }))}
            />
          )}
        </label>
      ))}
      <button type="button" onClick={() => void run()}>
        Run
      </button>
      {result ? <p>{result}</p> : null}
    </div>
  );
}
