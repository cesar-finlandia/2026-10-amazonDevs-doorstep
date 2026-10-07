// src/ui/panels/ConnectDialog.tsx — paste a Playground token (DP-UI §6.9, §6.13).
// The token lives in a local variable only: never in state that is rendered,
// never in storage, never logged. Opened through the "doorstep:open-connect"
// window event (ConnectPanel button, banner actions).
// Requirement IDs: FR-01
import { useEffect, useRef, useState } from "react";
import { RingError } from "src/domain/ring-port.js";
import { Dialog } from "../primitives/Dialog.js";
import { Message } from "../primitives/Message.js";
import { Button } from "../primitives/Button.js";
import { useApp } from "../state/SessionProvider.js";
import { ringError } from "../copy/templates.js";

export function requestConnectDialog(): void {
  window.dispatchEvent(new Event("doorstep:open-connect"));
}

export function ConnectDialog(): React.JSX.Element {
  const { ring } = useApp();
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState<{ title: string; detail: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    const show = (): void => {
      setNotice(null);
      setOpen(true);
    };
    window.addEventListener("doorstep:open-connect", show);
    return () => window.removeEventListener("doorstep:open-connect", show);
  }, []);
  const submit = async (): Promise<void> => {
    const token = (inputRef.current?.value ?? "").trim();
    if (token === "") {
      setNotice({ title: "Paste a token first.", detail: "The Playground token goes here before anything is connected." });
      return;
    }
    setBusy(true);
    try {
      await ring.setToken(token);
      // The server stores a token without testing it; the first call that uses it
      // answers 401 for a wrong one. Try it here so the answer lands in this dialog,
      // not as a banner that the fallback to the sample week clears a moment later.
      try {
        await ring.listDevices();
      } catch (e) {
        await ring.forgetToken().catch(() => undefined);
        throw e;
      }
      if (inputRef.current) inputRef.current.value = "";
      setNotice(null);
      setOpen(false);
    } catch (e) {
      if (inputRef.current) inputRef.current.value = "";
      const status = e instanceof RingError ? e.status : null;
      const msg = ringError(typeof status === "number" ? status : null);
      setNotice({ title: msg.title, detail: msg.detail });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open={open} onClose={() => setOpen(false)} label="Connect Ring">
      <h2 className="subject">Connect Ring</h2>
      <p className="support">The token stays in this tab&apos;s memory and is never written to a file.</p>
      <label className="field">
        Playground token
        <input ref={inputRef} type="password" autoComplete="off" className="mono" defaultValue="" />
      </label>
      {notice ? <Message tier="callout" tone={notice.title === "Paste a token first." ? "warning" : "danger"} title={notice.title} detail={notice.detail} /> : null}
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        <Button variant="primary" loading={busy} onClick={() => void submit()}>
          Use this token
        </Button>
        <Button variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </Dialog>
  );
}
