// src/ui/panels/LiveViewPanel.tsx — the WHEP live view (DP-UI §6.8).
// Requirement IDs: FR-13, FR-14
import { useEffect, useRef, useState } from "react";
import { Surface } from "../primitives/Surface.js";
import { Metric } from "../primitives/Metric.js";
import { Message } from "../primitives/Message.js";
import { Button } from "../primitives/Button.js";
import { useModel } from "../state/hooks.js";
import { useApp } from "../state/SessionProvider.js";
import { useUiActions } from "../state/useUiActions.js";

type Phase = "starting" | "simulated" | "live" | "failed";

export function LiveViewPanel(): React.JSX.Element | null {
  const model = useModel();
  const { ring } = useApp();
  const actions = useUiActions();
  const deviceId = model.ui.liveViewDeviceId;
  const [phase, setPhase] = useState<Phase>("starting");
  const [remaining, setRemaining] = useState<number | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const done = useRef(false);

  useEffect(() => {
    if (!deviceId) return;
    done.current = false;
    setPhase("starting");
    setRemaining(null);
    setStream(null);
    let pc: RTCPeerConnection | null = null;
    let whep: { sessionId: string } | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;
    let alive = true;
    // The peer connection closes synchronously; the stop request follows
    // best-effort. (Awaiting the stop first loses the teardown race: the
    // panel is gone from the DOM before close() runs.)
    const finish = (): void => {
      try {
        pc?.close();
      } catch {
        /* ignore */
      }
      pc = null;
      const id = whep?.sessionId ?? null;
      whep = null;
      if (id) {
        try {
          void ring.stopWhep(deviceId, id).catch(() => undefined);
        } catch {
          /* ignore */
        }
      }
    };
    (async () => {
      try {
        pc = new RTCPeerConnection();
        pc.addTransceiver("video", { direction: "recvonly" });
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        const session = await ring.startWhep(deviceId, offer.sdp ?? "");
        if (!alive) {
          try {
            pc?.close();
          } catch {
            /* ignore */
          }
          pc = null;
          try {
            void ring.stopWhep(deviceId, session.sessionId).catch(() => undefined);
          } catch {
            /* ignore */
          }
          return;
        }
        whep = { sessionId: session.sessionId };
        const total = typeof session.maxSeconds === "number" && session.maxSeconds > 0 ? Math.floor(session.maxSeconds) : 30;
        setRemaining(total);
        timer = setInterval(() => {
          setRemaining((r) => (typeof r === "number" && r > 0 ? r - 1 : r));
        }, 1000);
        if (session.answerSdp.includes("SIMULATED")) {
          setPhase("simulated");
          return;
        }
        await pc.setRemoteDescription({ type: "answer", sdp: session.answerSdp });
        pc.ontrack = (ev) => {
          if (!alive) return;
          const first = (ev.streams as MediaStream[])[0];
          if (first) {
            setStream(first);
            setPhase("live");
          }
        };
        setPhase("live");
      } catch {
        if (!alive) return;
        try {
          pc?.close();
        } catch {
          /* ignore */
        }
        pc = null;
        whep = null;
        if (timer) clearInterval(timer);
        setPhase("failed");
      }
    })();
    return () => {
      alive = false;
      if (timer) clearInterval(timer);
      finish();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceId]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = stream;
  }, [stream, phase]);

  useEffect(() => {
    if (remaining === 0 && !done.current) {
      done.current = true;
      actions.openLiveView(null);
    }
  }, [remaining, actions]);

  useEffect(() => {
    if (!deviceId) return;
    const onKey = (ev: KeyboardEvent): void => {
      if (ev.key === "Escape") {
        actions.openLiveView(null);
        const trigger = document.querySelector('[data-slot="incident"] button') as HTMLElement | null;
        const live = [...(document.querySelectorAll('[data-slot="incident"] button') as unknown as HTMLElement[])].find((b) =>
          (b.textContent ?? "").includes("Live view"),
        );
        (live ?? trigger)?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [deviceId, actions]);

  if (!deviceId) return null;
  const device = model.devices.find((d) => d.id === deviceId);
  const label = device?.description && device.description !== "" ? device.description : deviceId;
  const snaps = model.media
    .filter((m) => m.deviceId === deviceId && m.kind === "snapshot")
    .sort((a, b) => b.tsMs - a.tsMs);
  const snap = snaps[0] ?? model.media.filter((m) => m.kind === "snapshot").sort((a, b) => b.tsMs - a.tsMs)[0] ?? null;

  const close = (): void => {
    actions.openLiveView(null);
  };

  return (
    <div data-slot="live">
      <Surface eyebrow={`Live · ${label}`} help="live-view" resultRegion="live-view">
        <div data-live-view="">
          <Metric label="Remaining" value={remaining} unit="s left" size="md" loading={remaining === null && phase === "starting"} />
          {phase === "simulated" ? (
            <>
              <Message
                tier="callout"
                tone="info"
                title="Simulated live view"
                detail="Simulated live view — the sample week has no camera stream."
              />
              {snap ? (
                <figure className="evidence">
                  <img src={`data:${snap.contentType};base64,${snap.dataBase64}`} alt={`Snapshot from ${snap.label}`} />
                  <figcaption className="support">{snap.label}</figcaption>
                </figure>
              ) : null}
            </>
          ) : null}
          {phase === "live" || phase === "starting" ? (
            <div className="evidence">
              <video
                ref={(el) => {
                  videoRef.current = el;
                  // React sets muted as a property only; the streaming
                  // attributes must exist literally for the audit to read.
                  if (el) {
                    el.setAttribute("autoplay", "");
                    el.setAttribute("playsinline", "");
                    el.setAttribute("muted", "");
                    if (stream) el.srcObject = stream;
                  }
                }}
                autoPlay
                playsInline
                muted
              />
            </div>
          ) : null}
          {phase === "failed" ? (
            <Message tier="callout" tone="danger" title="Live view didn't start" detail="Ring didn't answer. Try again in a moment." />
          ) : null}
          <Button variant="ghost" onClick={close}>
            Close
          </Button>
        </div>
      </Surface>
    </div>
  );
}
