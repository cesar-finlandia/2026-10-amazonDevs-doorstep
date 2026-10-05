// Requirement IDs: FR-11
// WU-RING-INTEGRATION-01: the signature gate is constant-time and strict,
// and the wire facts the rest of the plan relies on are written down in one file.
import { readFileSync } from "node:fs";
import { parseRingPayload } from "src/domain/parse.js";
import { signPayload, verifySignature } from "src/ring/signature.js";
import { WIRE, WIRE_SAMPLES } from "src/ring/wire.js";

function assert(cond: unknown, reason: string): void {
  if (!cond) {
    console.error(`FAIL: ${reason}`);
    process.exit(1);
  }
}

const secret = "test-webhook-secret-01";
const body = JSON.stringify(WIRE_SAMPLES.webhookMotion);

assert(verifySignature(Buffer.from(body, "utf8"), signPayload(Buffer.from(body, "utf8"), secret), secret) === true, "buffer body verifies");
assert(verifySignature(body, signPayload(body, secret), secret) === true, "string body verifies");
assert(verifySignature(body, signPayload(body, secret), "another-secret") === false, "different secret fails");
assert(verifySignature(body + " ", signPayload(body, secret), secret) === false, "changed body fails");
assert(verifySignature(body, undefined, secret) === false, "undefined header fails");
assert(verifySignature(body, signPayload(body, secret).slice("sha256=".length), secret) === false, "missing prefix fails");
assert(verifySignature(body, signPayload(body, secret).toUpperCase().replace("SHA256=", "sha256="), secret) === true, "upper-case hex verifies");
assert(verifySignature(body, "sha256=" + "ab".repeat(31), secret) === false, "63-char hex fails");
assert(verifySignature(body, "sha256=" + "ab".repeat(32) + "c", secret) === false, "65-char hex fails");
assert(verifySignature(body, signPayload(body, secret), "") === false, "empty secret fails");
assert(verifySignature("x", {} as unknown as string, "s") === false, "non-string header returns false");

const source = readFileSync(new URL("../../src/ring/signature.ts", import.meta.url), "utf8");
assert(source.includes("timingSafeEqual"), "signature.ts calls timingSafeEqual");
assert(
  source.split("\n").filter((line) => /==/.test(line) || /!=/.test(line)).every((line) => /typeof/.test(line)),
  "no equality comparison except typeof guards (digests compared only via timingSafeEqual)",
);

assert(
  WIRE.whepSessions("a b") === "/v1/devices/a%20b/media/streaming/whep/sessions" &&
    WIRE.history("dev-door") === "/v1/history/devices/dev-door/events",
  "builders encode ids",
);

const motion = parseRingPayload(WIRE_SAMPLES.webhookMotion);
assert(
  motion.length === 1 && motion[0]?.type === "motion_detected" &&
    (motion[0] as { subType?: string }).subType === "human" && motion[0]?.id === "evt:req-0001",
  "canonical motion payload parses with human subType",
);
// FL-1: the committed tolerant parser requires meta.request_id and a timestamp, so the
// organizer's bare flat shape is skipped. The sample stays literal; pin the behaviour.
assert(parseRingPayload(WIRE_SAMPLES.webhookFlat).length === 0, "flat shape without request id is skipped by the committed parser (FL-1)");

console.log("ri-01-signature: 14 checks OK");
