// Requirement IDs: HEE-KIT-02
import { createDomainStore } from "../store/domainStore.js";
import type { Source } from "../store/domainStore.js";
import { createTruthEngine } from "../truth/truthEngine.js";
import { createApprovalGate } from "../gate/approvalGate.js";
import { createTraceWriter } from "../trace/traceWriter.js";
import { createRegistry } from "../registry/registry.js";
import type { Registry } from "../registry/types.js";

export interface Shelf {
  id: string;
  name: string;
  capacity: number;   // widget units
}

export interface Widget {
  id: string;
  name: string;
  shelfId: string;
  size: number;       // widget units
}

export interface ShelfNote {
  id: string;
  text: string;
}

export interface ShelfModel {
  shelves: Shelf[];
  widgets: Widget[];
  notes: ShelfNote[];
}

export function initialShelfModel(): ShelfModel {
  return {
    shelves: [
      { id: "shelf-a", name: "Alpha", capacity: 5 },
      { id: "shelf-b", name: "Beta", capacity: 10 },
    ],
    widgets: [],
    notes: [],
  };
}

let noteCounter = 0;
let selectedWidgetId: string | null = null;

export function setSelectedWidget(id: string | null): void {
  selectedWidgetId = id;
}

export function getSelectedWidget(): string | null {
  return selectedWidgetId;
}

export const shelfTruth = createTruthEngine<ShelfModel>([
  {
    id: "shelf_capacity",
    description: "No shelf holds more widget units than its capacity.",
    check: (model) => {
      const issues: { id: string; severity: "error"; entityIds: string[]; message: string; fix: { action: string; args: Record<string, unknown> } }[] = [];
      for (const shelf of model.shelves) {
        const onShelf = model.widgets.filter((w) => w.shelfId === shelf.id);
        const units = onShelf.reduce((n, w) => n + w.size, 0);
        if (units > shelf.capacity) {
          const other = model.shelves.find((s) => s.id !== shelf.id);
          issues.push({
            id: `capacity-${shelf.id}`,
            severity: "error",
            entityIds: onShelf.map((w) => w.id),
            message: `Shelf ${shelf.name} holds ${units} widget units but its capacity is ${shelf.capacity} units.`,
            fix: {
              action: "move_widget",
              args: { name: onShelf[onShelf.length - 1]?.id ?? "", shelfId: other?.id ?? "" },
            },
          });
        }
      }
      return issues;
    },
  },
  {
    id: "unique_widget_names",
    description: "Widget names are unique so the agent and the human mean the same thing.",
    check: (model) => {
      const seen = new Map<string, number>();
      for (const w of model.widgets) seen.set(w.name, (seen.get(w.name) ?? 0) + 1);
      return [...seen.entries()]
        .filter(([, n]) => n > 1)
        .map(([name]) => ({
          id: `dup-name-${name}`,
          severity: "warning" as const,
          entityIds: model.widgets.filter((w) => w.name === name).map((w) => w.id),
          message: `2 widgets share the name "${name}"; rename one so names stay unique.`,
        }));
    },
  },
]);

const OBJ = { type: "object", additionalProperties: false } as const;

function nameProp(desc: string): Record<string, unknown> {
  return { type: "string", description: desc };
}

export function createShelfDemo(): {
  registry: Registry<ShelfModel>;
  store: ReturnType<typeof createDomainStore<ShelfModel>>;
  gate: ReturnType<typeof createApprovalGate>;
  trace: ReturnType<typeof createTraceWriter>;
} {
  noteCounter = 0;
  selectedWidgetId = null;
  const store = createDomainStore<ShelfModel>({
    initial: initialShelfModel(),
    actions: [
      {
        name: "add_widget",
        apply(model, args) {
          const { name, shelfId, size } = args as { name: string; shelfId: string; size: number };
          if (model.widgets.some((w) => w.id === name)) throw new Error(`widget ${name} already exists`);
          if (!model.shelves.some((s) => s.id === shelfId)) throw new Error(`unknown shelf ${shelfId}`);
          const widget = { id: name, name, shelfId, size };
          return { model: { ...model, widgets: [...model.widgets, widget] }, entityIds: [name], summary: `added ${name} to ${shelfId}` };
        },
      },
      {
        name: "move_widget",
        apply(model, args) {
          const { name, shelfId } = args as { name: string; shelfId: string };
          const widget = model.widgets.find((w) => w.id === name || w.name === name);
          if (!widget) throw new Error(`unknown widget ${name}`);
          if (!model.shelves.some((s) => s.id === shelfId)) throw new Error(`unknown shelf ${shelfId}`);
          const widgets = model.widgets.map((w) => (w.id === widget.id ? { ...w, shelfId } : w));
          return { model: { ...model, widgets }, entityIds: [widget.id], summary: `moved ${widget.id} to ${shelfId}` };
        },
      },
      {
        name: "remove_widget",
        apply(model, args) {
          const { name } = args as { name: string };
          const widget = model.widgets.find((w) => w.id === name || w.name === name);
          if (!widget) throw new Error(`unknown widget ${name}`);
          return {
            model: { ...model, widgets: model.widgets.filter((w) => w.id !== widget.id) },
            entityIds: [widget.id],
            summary: `removed ${widget.id}`,
          };
        },
      },
      {
        name: "add_note",
        apply(model, args) {
          const { text } = args as { text: string };
          noteCounter += 1;
          const note = { id: `note-${noteCounter}`, text };
          return { model: { ...model, notes: [...model.notes, note] }, entityIds: [note.id], summary: `noted ${note.id}` };
        },
      },
    ],
  });
  const gate = createApprovalGate();
  const trace = createTraceWriter({ runId: "shelf-demo" });
  const registry = createRegistry({
    store,
    gate,
    trace,
    truth: shelfTruth,
    procedures: [{ name: "stock-shelf", steps: ["list_widgets", "add_widget", "check_shelves", "move_widget"] }],
  });

  const dispatchChange = async (
    action: "add_widget" | "move_widget" | "remove_widget" | "add_note",
    args: unknown,
    source: Source,
  ): Promise<{ ok: true; summary: string; entityIds: string[] } | { ok: false; error: string }> => {
    const r = store.dispatch(action, args, source);
    if (!r.ok) return { ok: false, error: (r as { error: string }).error };
    return { ok: true, summary: (r as { summary: string }).summary, entityIds: (r as { entityIds: string[] }).entityIds };
  };

  registry.register({
    name: "list_widgets",
    title: "List widgets",
    group: "read",
    description:
      "Lists every widget on every shelf with its size in units. Call this before changing anything. Example: list_widgets({}).",
    inputSchema: { ...OBJ, properties: {} },
    annotations: { readOnly: true, destructive: false, untrustedContent: false },
    handler: (_args, ctx) => {
      const m = ctx.store.getState() as ShelfModel;
      return { ok: true, summary: `${m.widgets.length} widgets`, data: m.widgets.map((w) => w.id) };
    },
  });
  registry.register({
    name: "get_widget",
    title: "Get widget",
    group: "read",
    description:
      "Reads one widget by id or name with its shelf and size in units. Accepts a human name as well as an id. Example: get_widget({\"name\": \"alpha\"}).",
    inputSchema: {
      ...OBJ,
      properties: { name: nameProp("Widget id or human name") },
      required: ["name"],
    },
    annotations: { readOnly: true, destructive: false, untrustedContent: false },
    handler: (args, ctx) => {
      const m = ctx.store.getState() as ShelfModel;
      const { name } = args as { name: string };
      const w = m.widgets.find((x) => x.id === name || x.name === name);
      if (!w) return { ok: false, error: `unknown widget ${name}`, next: "Call list_widgets, then retry." };
      return { ok: true, summary: `${w.id} on ${w.shelfId}`, data: w, entityIds: [w.id] };
    },
  });
  registry.register({
    name: "get_shelf",
    title: "Get shelf",
    group: "read",
    description:
      "Reads one shelf by id or name with its capacity in units. Accepts a human name as well as an id. Example: get_shelf({\"shelf\": \"shelf-a\"}).",
    inputSchema: {
      ...OBJ,
      properties: { shelf: nameProp("Shelf id or human name") },
      required: ["shelf"],
    },
    annotations: { readOnly: true, destructive: false, untrustedContent: false },
    handler: (args, ctx) => {
      const m = ctx.store.getState() as ShelfModel;
      const { shelf } = args as { shelf: string };
      const s = m.shelves.find((x) => x.id === shelf || x.name === shelf);
      if (!s) return { ok: false, error: `unknown shelf ${shelf}`, next: "Call list_widgets, then retry." };
      return { ok: true, summary: `${s.name} holds capacity ${s.capacity}`, data: s, entityIds: [] };
    },
  });
  registry.register({
    name: "add_widget",
    title: "Add widget",
    group: "change",
    description:
      "Adds a widget to a shelf. Sizes are whole units; check capacity with check_shelves afterwards. Example: add_widget({\"name\": \"alpha\", \"shelfId\": \"shelf-a\", \"size\": 1}).",
    inputSchema: {
      ...OBJ,
      properties: {
        name: nameProp("New widget name, unique across shelves"),
        shelfId: { type: "string", description: "Target shelf id" },
        size: { type: "integer", description: "Size in whole units" },
      },
      required: ["name", "shelfId", "size"],
    },
    annotations: { readOnly: false, destructive: false, untrustedContent: false },
    handler: async (args, ctx) => {
      const r = await dispatchChange("add_widget", args, ctx.source);
      return r.ok ? { ok: true, summary: r.summary, entityIds: r.entityIds } : { ok: false, error: r.error };
    },
  });
  registry.register({
    name: "move_widget",
    title: "Move widget",
    group: "change",
    description:
      "Moves a widget to another shelf. Use the fix action from check_shelves for overflows. Example: move_widget({\"name\": \"alpha\", \"shelfId\": \"shelf-b\"}).",
    inputSchema: {
      ...OBJ,
      properties: {
        name: nameProp("Widget id or human name"),
        shelfId: { type: "string", description: "Destination shelf id" },
      },
      required: ["name", "shelfId"],
    },
    annotations: { readOnly: false, destructive: false, untrustedContent: false },
    handler: async (args, ctx) => {
      const r = await dispatchChange("move_widget", args, ctx.source);
      return r.ok ? { ok: true, summary: r.summary, entityIds: r.entityIds } : { ok: false, error: r.error };
    },
  });
  registry.register({
    name: "remove_widget",
    title: "Remove widget",
    group: "change",
    description:
      "Removes a widget from its shelf for good. This needs the human's approval. Example: remove_widget({\"name\": \"alpha\"}).",
    inputSchema: {
      ...OBJ,
      properties: { name: nameProp("Widget id or human name to remove") },
      required: ["name"],
    },
    annotations: { readOnly: false, destructive: true, untrustedContent: false },
    summarize: (args) => `remove ${(args as { name: string }).name}`,
    handler: async (args, ctx) => {
      const r = await dispatchChange("remove_widget", args, ctx.source);
      return r.ok ? { ok: true, summary: r.summary, entityIds: r.entityIds } : { ok: false, error: r.error };
    },
  });
  registry.register({
    name: "check_shelves",
    title: "Check shelves",
    group: "verify",
    description:
      "Runs the truth engine over the shelves and reports capacity errors with units. Repair with the suggested fix actions. Example: check_shelves({}).",
    inputSchema: { ...OBJ, properties: {} },
    annotations: { readOnly: true, destructive: false, untrustedContent: false },
    handler: (_args, ctx) => {
      const issues = shelfTruth.check(ctx.store.getState() as ShelfModel);
      const counts = shelfTruth.counts(issues);
      return {
        ok: true,
        summary: `${counts.errors} errors, ${counts.warnings} warnings`,
        data: { issues: issues.map((i) => i.id) },
      };
    },
  });
  registry.register({
    name: "focus_widget",
    title: "Focus widget",
    group: "navigate",
    description:
      "Shows a widget to the human by selecting it in the view. Selecting reveals the move_selected_widget action. Example: focus_widget({\"name\": \"alpha\"}).",
    inputSchema: {
      ...OBJ,
      properties: { name: nameProp("Widget id or human name to show") },
      required: ["name"],
    },
    annotations: { readOnly: false, destructive: false, untrustedContent: false },
    handler: (args, ctx) => {
      const m = ctx.store.getState() as ShelfModel;
      const { name } = args as { name: string };
      const w = m.widgets.find((x) => x.id === name || x.name === name);
      if (!w) return { ok: false, error: `unknown widget ${name}`, next: "Call list_widgets, then retry." };
      setSelectedWidget(w.id);
      return { ok: true, summary: `focused ${w.id}`, entityIds: [w.id] };
    },
  });
  registry.register({
    name: "add_note",
    title: "Add note",
    group: "collaborate",
    description:
      "Adds a human-readable note to the shelf log. Use it to hand context to the human. Example: add_note({\"text\": \"Alpha is full.\"}).",
    inputSchema: {
      ...OBJ,
      properties: { text: { type: "string", description: "Note text for the log" } },
      required: ["text"],
    },
    annotations: { readOnly: false, destructive: false, untrustedContent: true },
    handler: async (args, ctx) => {
      const r = await dispatchChange("add_note", args, ctx.source);
      return r.ok ? { ok: true, summary: r.summary, entityIds: r.entityIds } : { ok: false, error: r.error };
    },
  });
  registry.register({
    name: "import_shelf_plan",
    title: "Import shelf plan",
    group: "cross_boundary",
    description:
      "Imports widgets from a plan produced by another service or origin. Each name becomes a widget on the given shelf. Example: import_shelf_plan({\"shelfId\": \"shelf-b\", \"names\": [\"g1\", \"g2\"]}).",
    inputSchema: {
      ...OBJ,
      properties: {
        shelfId: { type: "string", description: "Destination shelf id" },
        names: { type: "array", description: "Widget names to create", items: { type: "string" } },
      },
      required: ["shelfId", "names"],
    },
    annotations: { readOnly: false, destructive: false, untrustedContent: true },
    handler: async (args, ctx) => {
      const { shelfId, names } = args as { shelfId: string; names: string[] };
      const ids: string[] = [];
      for (const name of names) {
        const r = await dispatchChange("add_widget", { name, shelfId, size: 1 }, ctx.source);
        if (!r.ok) return { ok: false, error: r.error };
        ids.push(...r.entityIds);
      }
      return { ok: true, summary: `imported ${ids.length} widgets to ${shelfId}`, entityIds: ids };
    },
  });
  registry.register({
    name: "rename_widget",
    title: "Rename widget",
    group: "change",
    description:
      "Renames a widget, keeping its shelf and size. The new name must be unique. Example: rename_widget({\"name\": \"alpha\", \"newName\": \"alpha-2\"}).",
    inputSchema: {
      ...OBJ,
      properties: {
        name: nameProp("Current widget id or human name"),
        newName: nameProp("New unique widget name"),
      },
      required: ["name", "newName"],
    },
    annotations: { readOnly: false, destructive: false, untrustedContent: false },
    handler: async (args, ctx) => {
      const m = ctx.store.getState() as ShelfModel;
      const { name, newName } = args as { name: string; newName: string };
      const w = m.widgets.find((x) => x.id === name || x.name === name);
      if (!w) return { ok: false, error: `unknown widget ${name}`, next: "Call list_widgets, then retry." };
      if (m.widgets.some((x) => x.name === newName)) {
        return { ok: false, error: `widget ${newName} already exists`, next: "Pick another name and retry." };
      }
      const removed = await dispatchChange("remove_widget", { name: w.id }, ctx.source);
      if (!removed.ok) return { ok: false, error: removed.error };
      const added = await dispatchChange("add_widget", { name: newName, shelfId: w.shelfId, size: w.size }, ctx.source);
      if (!added.ok) return { ok: false, error: added.error };
      return { ok: true, summary: `renamed ${w.id} to ${newName}`, entityIds: [newName] };
    },
  });
  registry.register({
    name: "move_selected_widget",
    title: "Move selected widget",
    group: "change",
    description:
      "Moves the currently selected widget to another shelf. Exists only while a widget is selected. Example: move_selected_widget({\"shelfId\": \"shelf-b\"}).",
    inputSchema: {
      ...OBJ,
      properties: { shelfId: { type: "string", description: "Destination shelf id" } },
      required: ["shelfId"],
    },
    annotations: { readOnly: false, destructive: false, untrustedContent: false },
    dynamicWhile: () => getSelectedWidget() !== null,
    handler: async (args, ctx) => {
      const selected = getSelectedWidget();
      if (!selected) return { ok: false, error: "no widget is selected", next: "Call focus_widget first." };
      const r = await dispatchChange("move_widget", { name: selected, ...(args as { shelfId: string }) }, ctx.source);
      return r.ok ? { ok: true, summary: r.summary, entityIds: r.entityIds } : { ok: false, error: r.error };
    },
  });

  return { registry, store, gate, trace };
}
