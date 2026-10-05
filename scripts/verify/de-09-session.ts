// Requirement IDs: FR-02, FR-07, FR-09
// WU-DOMAIN-ENGINE-09: the human checkpoint and consent boundary hold at the code level.
import type { ActionDescriptor } from "src/kits/agent-workflow/src/registry/types.js";
import { summarizeTrace } from "src/kits/agent-workflow/src/trace/summarize.js";
import { createBundleRingPort } from "src/domain/bundle-ring-port.js";
import { createSession } from "src/domain/session.js";
import type { WeekModel } from "src/domain/types.js";
import { buildBundle } from "src/domain/generator.js";
import { demoSeed } from "src/domain/seed.js";

function assert(cond: unknown, reason: string): void {
  if (!cond) {
    console.error(`FAIL: ${reason}`);
    process.exit(1);
  }
}

const sendNudge: ActionDescriptor<WeekModel> = {
  name: "send_nudge",
  title: "Send a nudge",
  group: "change",
  description: "Proposes a family message for a human to approve. Use it when an incident needs a visible note. Example: send_nudge({\"scope\":\"family_message\",\"text\":\"Heads up.\"}).",
  inputSchema: {
    type: "object",
    additionalProperties: false,
    properties: {
      scope: { type: "string", description: "Consent scope the nudge belongs to." },
      text: { type: "string", description: "Message text the family will read." },
    },
  },
  annotations: { readOnly: false, destructive: true, untrustedContent: false },
  summarize: (args) => {
    const a = args as { text: string };
    return `send a nudge ${JSON.stringify(a.text)}`;
  },
  handler: (args, ctx) => {
    const a = args as { scope: string; text: string };
    const r = ctx.store.dispatch("propose_nudge", { scope: a.scope, text: a.text }, ctx.source);
    return r.ok
      ? { ok: true as const, summary: r.summary, entityIds: r.entityIds }
      : { ok: false as const, error: r.error };
  },
};

const playChime: ActionDescriptor<WeekModel> = {
  name: "play_chime",
  title: "Play a chime",
  group: "change",
  description: "Plays an audio chime on a door device. Use it to acknowledge a visitor at the door. Example: play_chime({\"deviceId\":\"dev-door\",\"audioRef\":\"chime-default\"}).",
  inputSchema: {
    type: "object",
    additionalProperties: false,
    properties: {
      deviceId: { type: "string", description: "Target device id." },
      audioRef: { type: "string", description: "Audio slot to play." },
    },
  },
  annotations: { readOnly: false, destructive: true, untrustedContent: false },
  summarize: (args) => {
    const a = args as { deviceId: string; audioRef: string };
    return `play ${a.audioRef} on ${a.deviceId}`;
  },
  handler: (args) => {
    const a = args as { deviceId: string; audioRef: string };
    return { ok: true as const, summary: `Played ${a.audioRef} on ${a.deviceId}.` };
  },
};

const session = createSession({
  ring: createBundleRingPort(buildBundle()),
  registrar: (core) => {
    core.registry.register(sendNudge);
    core.registry.register(playChime);
    core.registerPreflight("play_chime", (model) =>
      model.consent.some((c) => c.scope === "chime_announcement" && c.granted)
        ? null
        : {
          message: "Consent for the chime is off. Ask the family member to turn it on.",
          next: "Ask the human to grant chime_announcement, then retry.",
        },
    );
    core.registerPreflight("play_chime", (model, args) => {
      const a = args as { deviceId: string };
      const device = model.devices.find((d) => d.id === a.deviceId);
      return device && device.chimeAudio
        ? null
        : {
          message: `The ${device?.description ?? a.deviceId} cannot play audio. Use the front door instead.`,
          next: "Call play_chime with deviceId dev-door.",
        };
    });
  },
});

assert(session.gate.isEnabled() && session.ring.mode === "bundle" && session.store.revision() === 0, "session defaults: gate on, bundle ring, revision 0");
assert(session.checkNow().counts.errors === 0, "checkNow is clean on the demo seed");

const held = session.call("send_nudge", { scope: "family_message", text: "Hi." }, { source: "agent" });
assert(session.gate.pending().length === 1, "agent destructive call is held at the gate");
session.gate.decide(session.gate.pending()[0]?.id as string, "approved");
const approved = await held;
assert(approved.ok && session.store.getState().nudges.length === 1, "approval lets the call through");
assert(
  session.trace.entries().some((e) => e.kind === "approval" && e.decision === "approved"),
  "trace records the approval",
);
const humanCall = await session.call("send_nudge", { scope: "family_message", text: "Yo." }, { source: "human" });
assert(humanCall.ok && session.gate.pending().length === 0, "human call bypasses the gate");
const chime = await session.call("play_chime", { deviceId: "dev-door", audioRef: "chime-default" }, { source: "agent" });
assert(
  !chime.ok && chime.error?.message === "Consent for the chime is off. Ask the family member to turn it on.",
  "chime without consent returns the preflight refusal",
);
assert(session.gate.pending().length === 0, "preflight refusal never touches the gate");
session.store.dispatch("set_consent", { scope: "chime_announcement", granted: true, actor: "human" }, "human");
const noCap = await session.call("play_chime", { deviceId: "dev-elite", audioRef: "chime-default" }, { source: "agent" });
assert(
  !noCap.ok && noCap.error?.message === "The Hall camera cannot play audio. Use the front door instead.",
  "capability refusal fires after consent passes",
);
const rejected = session.call("send_nudge", { scope: "family_message", text: "Nope." }, { source: "agent" });
const heldSecond = session.gate.pending().length === 1;
session.gate.decide(session.gate.pending()[0]?.id as string, "rejected");
const declined = await rejected;
assert(
  heldSecond && !declined.ok &&
    declined.error?.message === 'The human declined "send a nudge "Nope."". Ask what to do instead.',
  "second agent call is held; rejection returns the kit sentence",
);
assert(summarizeTrace(session.trace.entries()).human_checkpoints === 2, "trace counts two human checkpoints");
session.reset();
assert(
  session.store.revision() === 0 && session.trace.entries().length === 0 &&
    session.store.getState().events.length === demoSeed().events.length,
  "reset restores revision 0 and clears the trace",
);

console.log("de-09-session: 12 checks OK");
