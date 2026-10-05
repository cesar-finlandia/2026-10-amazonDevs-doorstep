// Requirement IDs: HEE-KIT-02
import type { ActionResult, Registry } from "../registry/types.js";

export interface ExternalAgentTransport {
  register(d: { name: string; title: string; description: string; inputSchema: object;
                annotations: { readOnly: boolean; destructive: boolean; untrustedContent: boolean } },
           execute: (args: unknown) => Promise<ActionResult>): void;
  unregister(name: string): void;
  onToolsChangedRequest?(fn: () => void): void;
}

export function bindRegistryToTransport<M>(
  registry: Registry<M>,
  transport: ExternalAgentTransport,
  signal: AbortSignal,
): () => void {
  if (signal.aborted) return () => undefined;
  const bound = new Set<string>();

  function sync(): void {
    const current = registry.list();
    const names = new Set(current.map((d) => d.name));
    for (const name of [...bound]) {
      if (!names.has(name)) {
        transport.unregister(name);
        bound.delete(name);
      }
    }
    for (const d of current) {
      if (!bound.has(d.name)) {
        const descriptor = d;
        transport.register(
          {
            name: descriptor.name,
            title: descriptor.title,
            description: descriptor.description,
            inputSchema: descriptor.inputSchema,
            annotations: { ...descriptor.annotations },
          },
          (args: unknown) => registry.call(descriptor.name, args, { source: "agent" }),
        );
        bound.add(d.name);
      }
    }
  }

  sync();
  const offChange = registry.onChange(() => sync());
  transport.onToolsChangedRequest?.(() => sync());
  let undone = false;
  const unbind = (): void => {
    if (undone) return;
    undone = true;
    offChange();
    for (const name of [...bound]) {
      transport.unregister(name);
      bound.delete(name);
    }
  };
  signal.addEventListener("abort", unbind, { once: true });
  return unbind;
}
