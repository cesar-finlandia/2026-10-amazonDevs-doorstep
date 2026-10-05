// Requirement IDs: HEE-KIT-02
export type Source = "agent" | "human" | "system";

export interface StoreAction<M> {
  name: string;
  apply(model: M, args: unknown): { model: M; entityIds: string[]; summary: string };
}

export interface DomainStore<M> {
  getState(): M;
  revision(): number;
  dispatch(name: string, args: unknown, source: Source):
    | { ok: true; revision: number; entityIds: string[]; summary: string }
    | { ok: false; error: string };
  undo(): boolean;
  redo(): boolean;
  canUndo(): boolean;
  canRedo(): boolean;
  subscribe(fn: (e: { revision: number; actionName: string; source: Source; entityIds: string[] }) => void): () => void;
  snapshot(): { model: M; revision: number };
  restore(s: { model: M; revision: number }): void;
}

function clone<M>(model: M): M {
  return structuredClone(model);
}

export function createDomainStore<M>(opts: { initial: M; actions: StoreAction<M>[]; maxHistory?: number }): DomainStore<M> {
  const maxHistory = opts.maxHistory ?? 200;
  const byName = new Map(opts.actions.map((a) => [a.name, a]));
  let model = clone(opts.initial);
  let revision = 0;
  const undoStack: M[] = [];
  const redoStack: M[] = [];
  const listeners = new Set<(e: { revision: number; actionName: string; source: Source; entityIds: string[] }) => void>();

  function notify(actionName: string, source: Source, entityIds: string[]): void {
    for (const fn of listeners) fn({ revision, actionName, source, entityIds });
  }

  return {
    getState(): M {
      return model;
    },
    revision(): number {
      return revision;
    },
    dispatch(name: string, args: unknown, source: Source) {
      const action = byName.get(name);
      if (!action) return { ok: false as const, error: `unknown store action: ${name}` };
      let next: { model: M; entityIds: string[]; summary: string };
      try {
        next = action.apply(clone(model), args);
      } catch (e) {
        return { ok: false as const, error: (e as Error).message ?? String(e) };
      }
      undoStack.push(clone(model));
      if (undoStack.length > maxHistory) undoStack.shift();
      redoStack.length = 0;
      model = next.model;
      revision += 1;
      notify(name, source, next.entityIds);
      return { ok: true as const, revision, entityIds: next.entityIds, summary: next.summary };
    },
    undo(): boolean {
      if (undoStack.length === 0) return false;
      redoStack.push(clone(model));
      model = undoStack.pop() as M;
      revision += 1;
      notify("undo", "system", []);
      return true;
    },
    redo(): boolean {
      if (redoStack.length === 0) return false;
      undoStack.push(clone(model));
      model = redoStack.pop() as M;
      revision += 1;
      notify("redo", "system", []);
      return true;
    },
    canUndo(): boolean {
      return undoStack.length > 0;
    },
    canRedo(): boolean {
      return redoStack.length > 0;
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    snapshot() {
      return { model: clone(model), revision };
    },
    restore(s: { model: M; revision: number }): void {
      model = clone(s.model);
      revision = s.revision;
      notify("restore", "system", []);
    },
  };
}
