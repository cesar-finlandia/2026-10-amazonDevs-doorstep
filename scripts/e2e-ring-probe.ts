// scripts/e2e-ring-probe.ts — optional live Ring probe (DP-E2E-BROWSER-TESTING
// WU-E2E-04 step 5). With RING_ACCESS_TOKEN unset prints
// `ring-probe: skipped (RING_ACCESS_TOKEN not set)` and exits 0; with it set,
// builds createLiveRingPort with the real base URL, calls listDevices() once
// and prints `ring-probe: <n> devices` (names and ids are never printed).
// Requirement IDs: FR-10
import { createInbox } from "src/ring/inbox.js";
import { createRingHttp } from "src/ring/client.js";
import { createLiveRingPort } from "src/ring/live-ring-port.js";
import { createTokenProvider } from "src/ring/oauth.js";

const token = process.env["RING_ACCESS_TOKEN"];
if (!token) {
  console.log("ring-probe: skipped (RING_ACCESS_TOKEN not set)");
  process.exit(0);
}
const provider = createTokenProvider();
if (provider.status().source === "none") {
  console.log("ring-probe: skipped (RING_ACCESS_TOKEN not set)");
  process.exit(0);
}
const http = createRingHttp({ tokens: provider });
const port = createLiveRingPort({ http, inbox: createInbox() });
const devices = await port.listDevices();
console.log(`ring-probe: ${devices.length} devices`);
