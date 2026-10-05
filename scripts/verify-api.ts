// scripts/verify-api.ts — cross-platform runner for the eight at-* scripts.
// (§5.10 item 8 in DP-API-TRANSPORT is written as a sh for-loop; this repo also
// runs on Windows without bash/sh, so the runner is Node instead. Behaviour is
// identical: at-01 … at-08 in order, first failure stops the run.)
import { spawnSync } from "node:child_process";

const parts = ["01-app", "02-events", "03-ring", "04-webhook", "05-agent", "06-clients", "07-architecture", "08-integration"];
for (const p of parts) {
  const r = spawnSync("npx", ["vite-node", `scripts/verify/at-${p}.ts`], {
    cwd: process.cwd(),
    encoding: "utf8",
    shell: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  process.stdout.write(r.stdout ?? "");
  process.stderr.write(r.stderr ?? "");
  if ((r.status ?? 1) !== 0) process.exit(r.status ?? 1);
}
