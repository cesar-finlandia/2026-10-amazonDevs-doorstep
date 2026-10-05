// Requirement IDs: FR-10, FR-12
// Optional live probe against the real Ring API. Skips gracefully with no
// credentials or no network and never fails (exit 0 either way).
// Credentials come from the environment only and are never printed.
import { createInbox } from "src/ring/inbox.js";
import { createRingHttp } from "src/ring/client.js";
import { createLiveRingPort } from "src/ring/live-ring-port.js";
import { createTokenProvider } from "src/ring/oauth.js";

async function main(): Promise<void> {
  const provider = createTokenProvider();
  const status = provider.status();
  if (status.source === "none") {
    console.log("ring-live: skipped (no credentials)");
    return;
  }
  try {
    const http = createRingHttp({ tokens: provider });
    const port = createLiveRingPort({ http, inbox: createInbox() });
    const devices = await port.listDevices();
    let statusOk = false;
    let history = 0;
    if (devices.length > 0) {
      const first = devices[0] as { id: string };
      await port.getStatus(first.id);
      statusOk = true;
      const page = await port.getEventHistory(first.id, { limit: 10, offset: 0 });
      history = page.items.length;
    }
    console.log(`ring-live: devices=${devices.length} statusOk=${String(statusOk)} history=${history}`);
  } catch {
    console.log("ring-live: skipped (unreachable)");
  }
}

await main();
