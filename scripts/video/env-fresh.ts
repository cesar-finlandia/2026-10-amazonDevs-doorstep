// scripts/video/env-fresh.ts — DP-LIVE-RUN-AND-VIDEO helper.
// The operator's User-scope environment postdates long-lived processes, so a
// script can start with stale (empty) values. rehydrateEnv() pulls the named
// values from HKCU\Environment into this process when they are missing here.
// It prints nothing and returns nothing: names only, never values.
import { execSync } from "node:child_process";

const NAMES = ["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "AWS_REGION",
  "AWS_BEARER_TOKEN_BEDROCK", "BEDROCK_MODEL_ID", "APPLIO_DIR", "APPLIO_PTH", "APPLIO_INDEX"];

export function rehydrateEnv(names: string[] = NAMES): void {
  for (const k of names) {
    if (process.env[k]) continue;
    try {
      const out = execSync(`reg query HKCU\\Environment /v ${k}`, { encoding: "utf8" });
      const m = /REG_SZ\s+(.+?)\s*$/.exec(out);
      if (m) process.env[k] = m[1]!.trim();
    } catch { /* absent: leave missing */ }
  }
}
