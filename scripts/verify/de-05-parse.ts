// Requirement IDs: FR-11, FR-12
// WU-DOMAIN-ENGINE-05: tolerant parsers and BundleRingPort.
import { createBundleRingPort } from "src/domain/bundle-ring-port.js";
import { parseHistoryPage, parseRingPayload } from "src/domain/parse.js";
import { runRingPortContract } from "./ring-port-contract.js";

function assert(cond: unknown, reason: string): void {
  if (!cond) {
    console.error(`FAIL: ${reason}`);
    process.exit(1);
  }
}

const documented = {
  event_id: "wh-1",
  timestamp: "2026-10-12T14:50:05.000Z",
  type: "motion_detected",
  device_id: "dev-door",
  attributes: { sub_type: "human", component_ids: [0] },
  meta: { request_id: "req-1" },
  simulated: true,
};
const single = parseRingPayload(documented);
assert(
  single.length === 1 && single[0]?.id === "evt:req-1" && single[0]?.source === "webhook" &&
    single[0]?.subType === "human" && single[0]?.tsMs === Date.parse("2026-10-12T14:50:05.000Z"),
  "webhook single documented payload",
);
const pair = parseRingPayload([documented, { ...documented, meta: { request_id: "req-2" } }]);
assert(pair.length === 2 && pair[0]?.id === "evt:req-1" && pair[1]?.id === "evt:req-2", "webhook array keeps input order");
const flat = parseRingPayload({
  event_type: "ding",
  timestamp: Math.floor(Date.parse("2026-10-12T14:50:05.000Z") / 1000),
  device_id: "dev-door",
  sub_type: "visitor",
  component_ids: [0],
  meta: { request_id: "req-3" },
});
assert(
  flat.length === 1 && flat[0]?.type === "button_press" && flat[0]?.subType === undefined &&
    flat[0]?.tsMs === Date.parse("2026-10-12T14:50:05.000Z"),
  "webhook flat shape with seconds timestamp",
);
assert(parseRingPayload({ ...documented, type: "teleport" }).length === 0, "unknown webhook type skipped");
assert(parseRingPayload({ type: "motion_detected" }).length === 0, "malformed webhook payload skipped");

const pageShape = {
  items: [
    { id: "7", eventType: "motion_detected", timestamp: "2026-10-12T14:50:05.000Z", subType: "human", componentIds: [0] },
    { id: "8", eventType: "ding", timestamp: "2026-10-12T14:51:05.000Z", componentIds: [0] },
  ],
  limit: 50,
  offset: 0,
  total: 2,
};
const fromPage = parseHistoryPage(pageShape, "dev-door");
assert(
  fromPage.length === 2 && fromPage[0]?.id === "hist:7" && fromPage[0]?.source === "history" &&
    fromPage[1]?.type === "button_press",
  "history page shape",
);
const fromItems = parseHistoryPage(pageShape.items, "dev-door");
assert(fromItems.length === 2 && fromItems[0]?.requestId === "hist:7", "history items-array shape");
const jsonApi = {
  data: [
    { attributes: { event_type: "motion", timestamp: "2026-10-12T14:50:05.000Z", sub_type: "human", component_ids: [1], id: "9" } },
  ],
};
const fromJsonApi = parseHistoryPage(jsonApi, "dev-elite");
assert(
  fromJsonApi.length === 1 && fromJsonApi[0]?.id === "hist:9" && fromJsonApi[0]?.type === "motion_detected" &&
    fromJsonApi[0]?.componentId === 1,
  "history JSON:API shape",
);
assert(parseHistoryPage({ items: [{ id: "x", eventType: "warp", timestamp: "2026-10-12T14:50:05.000Z", componentIds: [0] }], limit: 50, offset: 0, total: 1 }, "dev-door").length === 0, "unknown history type skipped");

await runRingPortContract(createBundleRingPort());
assert(true, "bundle port passes runRingPortContract");
{
  const port = createBundleRingPort();
  const p1 = await port.getEventHistory("dev-door", { limit: 50, offset: 0 });
  const p2 = await port.getEventHistory("dev-door", { limit: 50, offset: 50 });
  const p3 = await port.getEventHistory("dev-door", { limit: 50, offset: 100 });
  const all = [...p1.items, ...p2.items, ...p3.items];
  assert(p1.items.length === 50 && p2.offset === 50 && all.length === p1.total, "bundle history paginates");
}

console.log("de-05-parse: 11 checks OK");
