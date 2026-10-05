// src/ui/state/useUiActions.ts — view selection through the store's set_ui action (DP-UI §3.2).
// NOTE (deviation): the plan phrases these as session.call("set_ui", …), but the
// registry only holds the 20 agent descriptors — "set_ui" is a store action, so
// an unknown-action call would change nothing. dispatch("set_ui", …, "human")
// is the same single mutation path with a human source, and notifies
// subscribers identically.
// Requirement IDs: FR-09
import { useMemo } from "react";
import { useApp } from "./SessionProvider.js";

export function useUiActions(): {
  selectDay(i: number | null): void;
  selectIncident(id: string | null): void;
  setShot(id: string): void;
  openLiveView(deviceId: string | null): void;
} {
  const { session } = useApp();
  return useMemo(
    () => ({
      selectDay(i: number | null): void {
        session.store.dispatch("set_ui", { selectedDay: i }, "human");
      },
      selectIncident(id: string | null): void {
        session.store.dispatch("set_ui", { selectedIncidentId: id }, "human");
      },
      setShot(id: string): void {
        session.store.dispatch("set_ui", { shotId: id }, "human");
      },
      openLiveView(deviceId: string | null): void {
        session.store.dispatch("set_ui", { liveViewDeviceId: deviceId }, "human");
      },
    }),
    [session],
  );
}
