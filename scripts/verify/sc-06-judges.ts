// scripts/verify/sc-06-judges.ts — DP-SHOWCASE WU-SHOWCASE-06 (8 checks).
// Requirement IDs: FR-25 (part)
import { copyFileSync, mkdtempSync, readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createChecker } from "./ui-kit.js";
import { run } from "./e2e-kit.js";

const c = createChecker("sc-06-judges");

// 1. Render exits 0; JUDGES.md exists.
const render = run("npx", ["vite-node", "hee/src/showcase/cli.ts", "judge-kit", "render", "--entry", "."]);
const judges = readFileSync("JUDGES.md", "utf8");
c.ok(render.code === 0 && judges.length > 0, "judge-kit render exits 0, JUDGES.md exists");

// 2. Offline lint OK.
const off = run("npx", ["vite-node", "hee/src/showcase/cli.ts", "judge-kit", "lint", "--entry", "."]);
c.ok(off.code === 0 && off.out.includes("judge-kit: OK"), "offline lint OK");

// 3. Online lint OK.
const on = run("npx", ["vite-node", "hee/src/showcase/cli.ts", "judge-kit", "lint", "--entry", ".", "--online"]);
c.ok(on.code === 0 && on.out.includes("judge-kit: OK"), `online lint OK (${on.out.split("\n").map((l) => l.trim()).filter((l) => l.length > 0).pop() ?? "?"})`);

// 4. Live URL, three prompts, sixty-second steps verbatim.
const cfg = JSON.parse(readFileSync("design_documents/showcase.json", "utf8")) as {
  live_url?: string; try_prompts?: string[]; sixty_second_path?: { step?: string }[];
};
c.ok(
  typeof cfg.live_url === "string" && judges.includes(cfg.live_url) &&
    (cfg.try_prompts ?? []).every((p) => judges.includes(p)) &&
    (cfg.sixty_second_path ?? []).every((s) => typeof s.step === "string" && judges.includes(s.step)),
  "live URL + prompts + steps verbatim",
);

// 5. Device-free testing words.
c.ok(judges.includes("Playground token") && judges.includes("sample week"), "Playground token + sample week");

// 6. Hand-edit detection on a temp copy.
const tmp = mkdtempSync(join(tmpdir(), "sc06-"));
copyFileSync("JUDGES.md", join(tmp, "JUDGES.md"));
copyFileSync("design_documents/showcase.json", join(tmp, "showcase.json"));
try {
  const { mkdirSync } = await import("node:fs");
  mkdirSync(join(tmp, "design_documents"), { recursive: true });
  copyFileSync("design_documents/showcase.json", join(tmp, "design_documents", "showcase.json"));
} catch { /* ignore */ }
appendFileSync(join(tmp, "JUDGES.md"), "\nHand-edited line.\n", "utf8");
const tamper = run("npx", ["vite-node", "hee/src/showcase/cli.ts", "judge-kit", "lint", "--entry", tmp]);
c.ok(tamper.code === 1 && /hand-edited/i.test(tamper.out), "tampered copy fails naming hand-edited");

// 7. claims lint still OK (judge kit is a surface).
const lint = run("npx", ["vite-node", "hee/src/showcase/cli.ts", "claims", "lint", "--entry", "."]);
c.ok(lint.code === 0 && /claims: OK \(\d+ claims\)/.test(lint.out), "claims lint still OK");

// 8. Banned-words scan.
const banned = run("python3", ["../../hackathons/_useful/scripts/check_banned_words.py", "JUDGES.md"]);
c.ok(banned.code === 0, "banned-words scan exits 0");

c.done();
