// scripts/make-capture-script.ts — DP-SUBMISSION WU-08 (§3.8).
// Maps design_documents/demo-scenario.json to the demodrive script schema.
// Prints `capture script: <n> steps`.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { readDemoScenario } from "../hee/src/showcase/scenario.js";

export function toCaptureScript(scenario: unknown, baseUrl: string): { script: object; notes: string[] } {
  const s = scenario as {
    steps: { id: string; actions: Record<string, unknown>[] }[];
    viewport?: { width: number; height: number };
  };
  const notes: string[] = [];
  const steps = s.steps.map((st) => {
    const actions: Record<string, unknown>[] = [];
    for (const a of st.actions) {
      if ("route" in a) actions.push({ action: "navigate", value: `${baseUrl}${a.route as string}` });
      // Driver clicks assert visibility on a 5 s budget; the capture host
      // renders slower, so every click is preceded by a 30 s visibility wait
      // on the same selector (returns instantly when already visible).
      // The Approve/incident deviations below keep runStep's scoping.
      else if ("click" in a && (a.click as string) === "Approve") {
        const sel = `[data-result-region="approval-bar"] >> :text-is("Approve")`;
        actions.push({ action: "wait_for", selector: sel, timeout_ms: 30000 });
        actions.push({ action: "click", selector: sel });
      }
      // DEVIATION: like Approve, incident buttons repeat per incident while the
      // driver clicks strictly. runStep clicks the first DOM match, so mirror
      // it with nth-match (the scenario opens an incident, any current one).
      else if ("click" in a && (a.click as string) === "Open incident") {
        // Icon-only buttons: no text content to match, but aria-labels read
        // "Open incident: <title>". Attribute-prefix + nth-match mirrors
        // runStep's first-match on the accessible name.
        const sel = `:nth-match(button[aria-label^="Open incident"], 1)`;
        actions.push({ action: "wait_for", selector: sel, timeout_ms: 30000 });
        actions.push({ action: "click", selector: sel });
      }
      else if ("click" in a) {
        const sel = `getByRole('${(a.role as string) ?? "button"}', {name: '${a.click as string}'})`;
        actions.push({ action: "wait_for", selector: sel, timeout_ms: 30000 });
        actions.push({ action: "click", selector: sel });
      }
      // DEVIATION from §3.8 (`text=`): the driver's text= form is a strict
      // substring match and the landing page holds the button text twice (a
      // paragraph contains it). :text-is() matches one element exactly and
      // passes through page.locator() verbatim.
      else if ("expect_text" in a) actions.push({ action: "wait_for", selector: `:text-is("${(a.expect_text as string).replace(/"/g, "'")}")` });
      // DEVIATION from §3.8 (wait_ms verbatim): the review step's fixed wait
      // becomes sleeps plus a bounded wait for the approval. The review loop
      // is UI-driven turn by turn, and under video recording each turn costs
      // seconds; a cold local server needs longer than any fixed sleep the
      // schema's 30 s action cap allows, and wait_for polls instead of
      // sleeping blind. wait_ms values are uncapped, so three 60 s sleeps plus
      // the 30 s poll cover about 210 s after the click.
      else if ("wait_ms" in a && st.id === "review") {
        actions.push({ action: "wait_ms", value: "60000" });
        actions.push({ action: "wait_ms", value: "60000" });
        actions.push({ action: "wait_ms", value: "60000" });
        actions.push({ action: "wait_for", selector: `[data-result-region="approval-bar"] >> :text-is("Approve")`, timeout_ms: 30000 });
      }
      else if ("wait_ms" in a) actions.push({ action: "wait_ms", value: String(a.wait_ms) });
      else if ("play3d" in a) actions.push({ action: "wait_ms", value: "1500" });
      else if ("type" in a) actions.push({ action: "fill", ...(a.type as Record<string, unknown>) });
      else if ("press" in a) notes.push(`step ${st.id}: press ${a.press as string} has no capture equivalent and was dropped`);
      else notes.push(`step ${st.id}: unknown action ${Object.keys(a).join(",")} dropped`);
    }
    // DEVIATION (cold-start settle): the capture runs against a fresh local
    // server where the sample-week stream lands slower than on the deployed
    // host, and a review started mid-stream chases moving data instead of
    // converging (FIX-12). Give it room after Load before the review starts;
    // the shared scenario file keeps its own timings for stills and tests.
    if (st.id === "week") actions.push({ action: "wait_ms", value: "45000" });
    return { id: st.id, actions };
  });
  const script = {
    version: "1.0.0",
    base_url: baseUrl,
    // Small viewport AND small video: the capture browser renders under
    // software rasterization while recording, and the review loop is driven
    // turn by turn from that same thread. Quarter pixels keep turns fast;
    // the scenario file keeps 1280x720 for stills and tests.
    viewport: { width: 640, height: 360, device_scale_factor: 1 },
    // Small fast capture video: the browser records under software rendering
    // and the encode competes with the app for CPU; 640x360 h264 keeps the
    // evidence legible while leaving the review loop responsive.
    video: { enabled: true, codec: "h264", size: { width: 640, height: 360 } },
    layout: "single-focus",
    data_source: { kind: "cache", cache_key: "doorstep-meta", mock_script: null },
    steps,
  };
  return { script, notes };
}

// CLI body (also runs on import; importers overwrite deterministically).
const scenario = readDemoScenario("design_documents/demo-scenario.json");
const portArg = process.argv.indexOf("--port");
const port = portArg === -1 ? 44201 + Math.floor(Math.random() * 1000) : Number(process.argv[portArg + 1]);
const built = toCaptureScript(scenario, `http://127.0.0.1:${port}`);
mkdirSync("design_documents/submission/capture", { recursive: true });
writeFileSync("design_documents/submission/capture/capture-script.json", JSON.stringify(built.script, null, 2) + "\n", "utf8");
console.log(`capture script: ${(built.script.steps as unknown[]).length} steps`);
for (const n of built.notes) console.log(`capture note: ${n}`);
console.log(`capture port: ${port}`);
