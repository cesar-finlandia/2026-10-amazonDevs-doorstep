// src/ui/copy/banner.ts — banner types and the priority table (DP-UI §3.1, §6.3 item 6).
// Requirement IDs: FR-21
import { actionError, backupModel, budgetWarning, recordedRun, ringError, runningByHand, sampleWeek, tokenWarning } from "./templates.js";

export type Tone = "info" | "success" | "warning" | "danger" | "degraded";

export interface BannerSpec {
  id: string;
  tone: Tone;
  title: string;
  detail: string;
  items?: { step: string; text: string }[];
  action?: { label: string; key: "use-sample" | "retry" | "connect" | "show-details" | "open-actions" | "paste-token" };
}

export interface BannerInput {
  ringMode: "bundle" | "live";
  ringDegraded: boolean;
  ringError: { status?: number } | null;
  agentKind: "bedrock" | "vertex-fallback" | "golden" | "manual";
  recordedDate?: string | null;
  tokenMinutes: number | null;
  usedPct: number;
  runError: string | null;
}

/** One banner at a time. Priority: ring error > run error > manual > golden >
 *  vertex-fallback > ring degraded to the sample week > token ending >
 *  budget ≥ 80 > null. Every branch is total (DP-UI §6.3 item 6). */
export function pickBanner(i: BannerInput): BannerSpec | null {
  const ring = i.ringError !== null && typeof i.ringError === "object" ? i.ringError : null;
  if (ring !== null) {
    const m = ringError(typeof ring.status === "number" ? ring.status : null);
    return { id: "ring-error", tone: "danger", title: m.title, detail: m.detail, action: { label: "Use the sample week", key: "use-sample" } };
  }
  if (typeof i.runError === "string" && i.runError !== "") {
    const m = actionError(i.runError);
    return { id: "run-error", tone: "danger", title: m.title, detail: m.detail, action: { label: "Show details", key: "show-details" } };
  }
  if (i.agentKind === "manual") {
    const m = runningByHand();
    return { id: "manual", tone: "degraded", title: m.title, detail: m.detail, action: { label: "Open the action list", key: "open-actions" } };
  }
  if (i.agentKind === "golden") {
    const m = recordedRun(typeof i.recordedDate === "string" ? i.recordedDate : null);
    return { id: "recorded", tone: "degraded", title: m.title, detail: m.detail };
  }
  if (i.agentKind === "vertex-fallback") {
    const m = backupModel();
    return { id: "backup", tone: "degraded", title: m.title, detail: m.detail, action: { label: "Show details", key: "show-details" } };
  }
  if (i.ringDegraded === true) {
    const m = sampleWeek();
    return { id: "sample", tone: "degraded", title: m.title, detail: m.detail, action: { label: "Connect Ring", key: "connect" } };
  }
  if (typeof i.tokenMinutes === "number" && Number.isFinite(i.tokenMinutes) && i.tokenMinutes <= 5) {
    const m = tokenWarning(i.tokenMinutes);
    return { id: "token", tone: "warning", title: m.title, detail: m.detail, action: { label: "Paste a new token", key: "paste-token" } };
  }
  const pct = typeof i.usedPct === "number" && Number.isFinite(i.usedPct) ? i.usedPct : 0;
  if (pct >= 80) {
    const m = budgetWarning(i.usedPct);
    return { id: "budget", tone: "warning", title: m.title, detail: m.detail };
  }
  return null;
}
