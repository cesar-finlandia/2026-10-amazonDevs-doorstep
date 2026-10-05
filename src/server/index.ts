// src/server/index.ts
import { startServer } from "src/server/start.js";

startServer()
  .then((s) => {
    s.deps.log.info("listening", {
      url: s.url,
      build: s.deps.buildMarker,
      ring: (() => {
        try {
          return s.deps.sessions.ringMode();
        } catch {
          return "bundle";
        }
      })(),
      agent: (() => {
        try {
          return s.deps.agent.state().kind;
        } catch {
          return "unknown";
        }
      })(),
    });
    const shutdown = (): void => {
      void s.close().then(() => process.exit(0));
    };
    process.on("SIGTERM", shutdown);
    process.on("SIGINT", shutdown);
  })
  .catch((e: unknown) => {
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
  });
