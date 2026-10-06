// scripts/verify/e2e-07-3d.ts — DP-E2E-BROWSER-TESTING WU-E2E-07 (10 checks).
// Requirement IDs: FR-20, NFR-07
// Proves the 3D acceptance scenario draws the week, matches the calendar,
// answers the shots and the agent, meets the frame and draw-call limits in the
// headless mode, and degrades to the flat replica without WebGL.
import { readFileSync } from "node:fs";
import { createChecker } from "./ui-kit.js";
import { run, wrapper } from "./e2e-kit.js";

const c = createChecker("e2e-07-3d");

const FILE = "e2e/scenarios/3d.spec.ts";
const text = readFileSync(FILE, "utf8");
const bodies = text.split('test("').slice(1);
const bodyOf = (id: string): string => bodies.find((b) => b.startsWith(`${id} `)) ?? "";

function listedTitles(): string[] {
  const r = run("npx", ["playwright", "test", FILE, "--list"]);
  return r.out
    .split("\n")
    .filter((l) => l.includes("›"))
    .map((l) => ((l.split("›").pop() as string) ?? "").trim())
    .filter((t) => t.length > 0);
}

// 1. --list shows five tests titled 3D-1 … 3D-5.
const titles = listedTitles();
c.ok(
  titles.length === 5 && ["3D-1", "3D-2", "3D-3", "3D-4", "3D-5"].every((p) => titles.some((t) => t.startsWith(p))),
  `--list of ${FILE} shows five tests starting 3D-1 … 3D-5 (got ${JSON.stringify(titles)})`,
);

// 3. Every test opens with quality=low and waits for the scene.
c.ok(
  text.includes("quality=low") && bodies.length === 5 && bodies.every((b) => b.includes("waitScene(")),
  "the file opens with quality=low and every test calls waitScene",
);

// 4. The scene probe API is read from window.__scene3d.
c.ok(
  text.includes("__scene3d") &&
    ["entityIds()", "drawCalls()", "frames()", "camera()"].every((s) => text.includes(s)),
  "the file reads entityIds(), drawCalls(), frames() and camera() from window.__scene3d",
);

// 5. 3D-5 carries the frame and draw-call budgets.
const b5 = bodyOf("3D-5");
c.ok(
  b5.length > 0 && ["40", "100", "300", "THREE_D_HEADED"].every((s) => b5.includes(s)),
  "3D-5 contains the literals 40, 100, 300 and THREE_D_HEADED",
);

// 6. The no-WebGL context is made with an init script, not a launch argument.
c.ok(
  text.includes("addInitScript") &&
    text.includes("getContext") &&
    !text.includes("chromium.launch") &&
    !text.includes("--disable-"),
  "the no-WebGL context overrides getContext through an init script, not a launch argument",
);

// 7. 3D-3 polls to 0.05 against the imported shot poses.
c.ok(
  bodyOf("3D-3").includes("0.05") &&
    text.includes("OVERVIEW") &&
    text.includes("WALK") &&
    /from\s*["']src\/3d\/shots["']/.test(text),
  "3D-3 contains 0.05 and imports OVERVIEW, WALK from src/3d/shots",
);

// 8. 3D-4 drives the by-hand panel, never the registry.
c.ok(
  bodyOf("3D-4").includes("Run an action by hand") && !text.includes("registry.call"),
  "3D-4 presses Run an action by hand and the file holds no registry.call",
);

// 10. The 3D acceptance runs against any URL: no simulated Ring.
c.ok(
  ["app.ring", "app.secrets", "mock-ring-server"].every((s) => !text.includes(s)),
  "the file contains no app.ring, app.secrets or mock-ring-server",
);

// 2. The five tests pass through the counting wrapper.
const three = wrapper("3d", [FILE]);
console.log(three.line);
c.ok(
  three.code === 0 && three.line === "3d: 5 passed, 0 failed, 0 skipped",
  "e2e-run prints 3d: 5 passed, 0 failed, 0 skipped",
);

// 9. The JSON report carries the 3D-1 variance annotation at or above 40.
interface Annotation {
  type: string;
  description?: string;
}
interface JsonTest {
  annotations?: Annotation[];
}
interface JsonSpec {
  title: string;
  tests?: JsonTest[];
}
interface JsonSuite {
  specs?: JsonSpec[];
  suites?: JsonSuite[];
}
function collect(node: JsonSuite, acc: JsonSpec[]): void {
  for (const s of node.specs ?? []) acc.push(s);
  for (const sub of node.suites ?? []) collect(sub, acc);
}
let variance = -1;
try {
  const report = JSON.parse(readFileSync("e2e/artifacts/report.json", "utf8")) as { suites?: JsonSuite[] };
  const specs: JsonSpec[] = [];
  for (const s of report.suites ?? []) collect(s, specs);
  const first = specs.find((s) => s.title.startsWith("3D-1"));
  const ann = (first?.tests ?? []).flatMap((t) => t.annotations ?? []).find((a) => a.type === "variance");
  variance = ann?.description !== undefined ? Number(ann.description) : -1;
} catch {
  variance = -1;
}
c.ok(
  Number.isFinite(variance) && (variance as number) >= 40,
  `the JSON report has a variance annotation on 3D-1 of at least 40 (got ${String(variance)})`,
);

c.done();
