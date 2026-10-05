// scripts/verify/ui-01-brief.ts — DP-UI WU-UI-01 (9 checks).
// Requirement IDs: FR-19, FR-23
import { readFileSync } from "node:fs";
import { bannedHits } from "src/llm/guard.js";
import { createChecker, sh } from "./ui-kit.js";

const c = createChecker("ui-01-brief");
const brief = readFileSync("design_documents/design_brief.md", "utf8");
const lines = brief.split("\n");

// 1. The first line of the brief is the title.
c.eq(lines[0], "# Design brief — Doorstep Rhythm", "1 first line is the title");

// 2. The chassis lint exits 0 and reports concept OK.
{
  const r = sh("npx", [
    "vite-node",
    "../../hackathons/scripts/hee-lint-design-brief.ts",
    "design_documents/design_brief.md",
    "--plan",
    "design_documents/winning_project_plan.md",
  ]);
  c.ok(r.code === 0 && r.out.includes("design brief concept OK"), "2 chassis lint passes");
}

// 3. The slogan line appears exactly once.
{
  const needle = "Slogan, identical everywhere it appears: Know her day without calling.";
  const count = brief.split(needle).length - 1;
  c.eq(count, 1, "3 slogan line exactly once");
}

// 4. Exactly nine "- Defect N" lines, numbered 1 to 9 in order.
{
  const found = lines.filter((l) => l.startsWith("- Defect ")).map((l) => l.slice("- Defect ".length).split(" ")[0]);
  c.eq(found, ["1", "2", "3", "4", "5", "6", "7", "8", "9"], "4 nine defects in order");
}

// 5. Exactly five "- Check N" lines, numbered 1 to 5 in order.
{
  const found = lines.filter((l) => l.startsWith("- Check ")).map((l) => (l.slice("- Check ".length).split(" ")[0] as string).replace(/:$/, ""));
  c.eq(found, ["1", "2", "3", "4", "5"], "5 five checks in order");
}

// 6. No banned words in the brief.
c.eq(bannedHits(brief), [], "6 brief has no banned words");

// 7. The concept sentence is one sentence: exactly one full stop, at end of line.
{
  const line = lines.find((l) => l.startsWith("**Concept sentence:**")) ?? "";
  const after = line.replace("**Concept sentence:**", "").trim();
  const stops = (after.match(/\./g) ?? []).length;
  c.ok(stops === 1 && after.endsWith("."), "7 concept sentence is one sentence");
}

// 8. Theme-toggle placement section mentions 1024 px.
{
  const idx = lines.findIndex((l) => l.startsWith("## Placement of the theme toggle"));
  const section = idx >= 0 ? lines.slice(idx).join("\n") : "";
  c.ok(idx >= 0 && section.includes("1024 px"), "8 theme toggle placement names 1024 px");
}

// 9. No absolute paths or secret-looking tokens.
c.ok(
  !brief.includes("/home/") &&
    !brief.includes("/Users/") &&
    !brief.includes("C:\\") &&
    !/(sk-|AKIA)[A-Za-z0-9]{8,}/.test(brief),
  "9 no paths or secrets",
);

c.done();
