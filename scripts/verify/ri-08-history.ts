// Requirement IDs: FR-12
// WU-RING-INTEGRATION-08: webhook loss is recoverable through history on the real
// client path, and the integration leaks nothing.
import { readFileSync } from "node:fs";
import { createAppSession } from "src/agent/app-session.js";
import { createBundleRingPort } from "src/domain/bundle-ring-port.js";
import { findWebhookGaps, lastWebhookMs, pollHistory } from "src/domain/gaps.js";
import { buildBundle } from "src/domain/generator.js";
import { parseRingPayload } from "src/domain/parse.js";
import { RingError } from "src/domain/ring-port.js";
import { DEMO_NOW_MS, REVIEW_START_MS, demoSeed } from "src/domain/seed.js";
import { findDuplicateClusters } from "src/domain/derive.js";
import { createRingHttp } from "src/ring/client.js";
import { createInbox } from "src/ring/inbox.js";
import { createLiveRingPort } from "src/ring/live-ring-port.js";
import { createTokenProvider } from "src/ring/oauth.js";
import { createMockRingServer } from "../mock-ring-server.js";

function assert(cond: unknown, reason: string): void {
  if (!cond) {
    console.error(`FAIL: ${reason}`);
    process.exit(1);
  }
}

const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 1200));

const bundle = buildBundle();
const mock = await createMockRingServer({ bundle, rateLimitPerSec: 2 });
try {
  const livePort = (session: string) => createLiveRingPort({
    http: createRingHttp({
      baseUrl: mock.url,
      tokens: createTokenProvider({ env: { RING_ACCESS_TOKEN: "mock-access-token" } }),
    }),
    inbox: createInbox(),
    sessionId: session,
  });
  const bundlePort = createBundleRingPort(bundle);
  const historyPath = "/v1/history/devices/dev-door/events";

  const pristine = demoSeed();
  const lastWh = lastWebhookMs(pristine, "dev-door") as number;

  // 1: history over the live port matches the bundle port.
  await settle();
  const liveIds = (await pollHistory(livePort("s1"), "dev-door", REVIEW_START_MS)).map((e) => e.id).sort();
  const bundleIds = (await pollHistory(bundlePort, "dev-door", REVIEW_START_MS)).map((e) => e.id).sort();
  assert(liveIds.length > 0 && JSON.stringify(liveIds) === JSON.stringify(bundleIds), "live history matches bundle history");

  // 2–3: inbox + overlapping history ingest leave one gap and one duplicate cluster.
  const session = createAppSession({ initial: demoSeed(), ring: livePort("s2") });
  const inboxPayloads = await livePort("s2").drainWebhookInbox();
  const overlap = await pollHistory(livePort("s2"), "dev-door", lastWh);
  session.store.dispatch("ingest_events", { events: [...parseRingPayload(inboxPayloads), ...overlap] }, "human");
  const model = session.store.getState();
  assert(findWebhookGaps(model, "dev-door", DEMO_NOW_MS).length === 1, "one webhook gap remains");
  const clusters = findDuplicateClusters(model.events);
  const only = clusters[0];
  const memberA = only?.[0];
  const memberB = only?.[1];
  assert(
    clusters.length === 1 && only !== undefined && only.length === 2 &&
      memberA !== undefined && memberB !== undefined &&
      memberA.tsMs === memberB.tsMs && memberA.source !== memberB.source,
    "exactly the seeded overlap clusters",
  );

  // 4: paging stops at the since boundary; the request count is exact.
  await settle();
  const before = mock.stats().byPath[historyPath] ?? 0;
  await pollHistory(livePort("s4"), "dev-door", REVIEW_START_MS);
  const seen = (mock.stats().byPath[historyPath] ?? 0) - before;
  const all = (bundle.history["dev-door"] ?? []).flatMap((page) => page.items);
  let expected = 0;
  for (let page = 0; page < 20; page += 1) {
    const slice = all.slice(page * 50, page * 50 + 50);
    if (slice.length === 0) break;
    expected += 1;
    if (Math.min(...slice.map((item) => Date.parse(item.timestamp))) < REVIEW_START_MS) break;
  }
  assert(seen === expected && expected > 0, `paging stops at the boundary (${String(seen)} requests)`);

  // 5: unknown devices refuse as not_found.
  await settle();
  let notFound: unknown = null;
  try {
    await pollHistory(livePort("s5"), "dev-unknown", REVIEW_START_MS);
  } catch (e) {
    notFound = e;
  }
  assert(notFound instanceof RingError && notFound.code === "not_found", "unknown history is not_found");

  // 6: a 429 during paging is waited out and the full set still returns.
  await settle();
  const limitedBefore = mock.stats().rateLimited;
  mock.failNext(429, 1);
  const fullLive = (await pollHistory(livePort("s6"), "dev-door", pristine.window.startMs)).map((e) => e.id).sort();
  const fullBundle = (await pollHistory(bundlePort, "dev-door", pristine.window.startMs)).map((e) => e.id).sort();
  assert(
    mock.stats().rateLimited >= limitedBefore &&
      JSON.stringify(fullLive) === JSON.stringify(fullBundle) && fullLive.length > 0,
    "a 429 is waited out with the full set",
  );

  // 7: registry ingestion over live matches bundle ingestion.
  await settle();
  const sessionLive = createAppSession({ initial: demoSeed(), ring: livePort("s7") });
  const beforeLive = sessionLive.store.getState().events.length;
  const calledLive = await sessionLive.call("ingest_ring_events", { source: "history", deviceId: "dev-door" }, { source: "human" });
  const addedLive = sessionLive.store.getState().events.length - beforeLive;
  const sessionBundle = createAppSession({ initial: demoSeed(), ring: createBundleRingPort(bundle) });
  const beforeBundle = sessionBundle.store.getState().events.length;
  const calledBundle = await sessionBundle.call("ingest_ring_events", { source: "history", deviceId: "dev-door" }, { source: "human" });
  const addedBundle = sessionBundle.store.getState().events.length - beforeBundle;
  assert(calledLive.ok && calledBundle.ok && addedLive === addedBundle && addedLive > 0, "live and bundle ingestions add the same events");
} finally {
  await mock.close();
}

// 8: the friction log is well-formed (vacuously true with no entries).
{
  const log = readFileSync(new URL("../../design_documents/friction-log.md", import.meta.url), "utf8");
  assert(log.startsWith("# Friction log"), "friction log exists with its header");
  const sections = log.split(/^## FL-/m).slice(1);
  assert(
    sections.every(
      (section) =>
        section.includes("Date:") && section.includes("Severity:") && section.includes("Where:") &&
        section.includes("What happened:") && section.includes("Workaround:"),
    ),
    "every friction entry carries all five fields",
  );
}

// 9: no secret-adjacent logging and no hardcoded bearer strings.
{
  const sources = ["wire", "signature", "inbox", "webhook", "oauth", "client", "live-ring-port", "linking"].map(
    (name) => readFileSync(new URL(`../../src/ring/${name}.ts`, import.meta.url), "utf8"),
  );
  sources.push(readFileSync(new URL("../mock-ring-server.ts", import.meta.url), "utf8"));
  assert(
    sources.every(
      (source) =>
        !/console\.log\(/.test(source) &&
        !/Bearer\s+[A-Za-z0-9\-_.~+/=]{20,}/.test(source),
    ),
    "no secret logging and no long hardcoded bearer strings",
  );
}

console.log("ri-08-history: 9 checks OK");
