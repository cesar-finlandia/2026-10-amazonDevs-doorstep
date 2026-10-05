// src/server/start.ts
import type { Express } from "express";
import { createApp } from "src/server/app.js";
import { buildServerDeps } from "src/server/deps.js";
import type { BuildDepsOptions, ServerDeps } from "src/server/deps.js";

export interface RunningServer {
  url: string;
  port: number;
  app: Express;
  deps: ServerDeps;
  close(): Promise<void>;
}

export function startServer(opts?: BuildDepsOptions & { port?: number }): Promise<RunningServer> {
  const deps = buildServerDeps(opts);
  const app = createApp(deps);
  const listenPort = opts?.port ?? deps.config.port;
  return new Promise<RunningServer>((resolve, reject) => {
    const server = app.listen(listenPort, "0.0.0.0", () => {
      const addr = server.address() as { port: number } | null;
      const port = addr && typeof addr.port === "number" ? addr.port : listenPort;
      const url = `http://127.0.0.1:${port}`;
      let sweepTimer: ReturnType<typeof setInterval> | null = null;
      try {
        const sweep = (deps.sessions as { sweep?: () => number }).sweep;
        if (typeof sweep === "function") {
          sweepTimer = setInterval(() => {
            try {
              (deps.sessions as { sweep: () => number }).sweep();
            } catch {
              /* ignore */
            }
          }, 60000);
          if (typeof (sweepTimer as unknown as { unref?: () => void }).unref === "function") {
            (sweepTimer as unknown as { unref: () => void }).unref();
          }
        }
      } catch {
        /* sessions unbuilt in early units */
      }
      resolve({
        url,
        port,
        app,
        deps,
        close: async (): Promise<void> => {
          if (sweepTimer) clearInterval(sweepTimer);
          try {
            await (deps.hub as { close?: () => Promise<void> }).close?.();
          } catch {
            /* ignore */
          }
          try {
            (deps.cost as { close?: () => void }).close?.();
          } catch {
            /* ignore */
          }
          await new Promise<void>((done, failed) => {
            try {
              if (typeof (server as unknown as { closeAllConnections?: () => void }).closeAllConnections === "function") {
                (server as unknown as { closeAllConnections: () => void }).closeAllConnections();
              }
            } catch {
              /* ignore */
            }
            server.close((e?: Error) => {
              if (e) failed(e);
              else done();
            });
          });
        },
      });
    });
    server.on("error", reject);
  });
}
