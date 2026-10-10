// scripts/build-devpost-fields.ts — DP-SUBMISSION WU-02 (§3.7).
// Writes design_documents/submission/devpost-fields.json mapping the ten
// Devpost fields to real files and values. Prints `fields: <n> of 10 present`.
// A field whose source is missing is written as { missing } and lowers the count.
import { writeFileSync } from "node:fs";
import { readShowcase } from "./lib/submission.js";

const TESTING_ACCESS = "The product is free to use and needs no account. Open the live address, press Load the sample week, then Review the week. The sample week is bundled with the app, so a Ring device is not needed. To read a real Ring account, paste a short-lived token from the Ring Developer Playground into the box on the page. The page stays up through the judging period. JUDGES.md in the repository repeats these steps.";

const fields: Record<string, unknown> = {};
let present = 0;
const put = (key: string, value: unknown, missing?: string): void => {
  if (missing !== undefined) fields[key] = { missing };
  else {
    fields[key] = value;
    present += 1;
  }
};

let showcase: ReturnType<typeof readShowcase> | null = null;
try {
  showcase = readShowcase();
} catch {
  showcase = null;
}

put("1_description", { file: "design_documents/submission_description.md" });
if (showcase !== null) {
  put("2_repository", { url: showcase.repo_url, licence: "MIT", licence_file: "LICENSE", run_instructions: "README.md" });
} else {
  put("2_repository", null, "showcase.json unreadable");
}
if (showcase !== null && showcase.video_url !== "") {
  put("3_video", { url: showcase.video_url });
} else {
  put("3_video", null, "video address not set");
}
put("4_feedback", { file: "design_documents/submission/feedback.md" });
put("5_primary_track", "Ring");
put("6_mini_challenges", [
  { name: "AWS Builder", services: ["Amazon Bedrock"], also_used: ["Strands Agents SDK"], how: "design_documents/submission/feedback.md#aws-builder" },
]);
put("7_delta", { file: "design_documents/submission/delta.md" });
put("8_feature_requests", { file: "design_documents/submission/feature-requests.md" });
put("9_friction_log", { file: "design_documents/submission/friction-log-devpost.md" });
if (showcase !== null && showcase.live_url !== "") {
  put("10_testing_access", { url: showcase.live_url, judge_kit: "JUDGES.md", text: TESTING_ACCESS });
} else {
  put("10_testing_access", null, "live address not set");
}

writeFileSync(
  "design_documents/submission/devpost-fields.json",
  JSON.stringify({ version: "1.0.0", fields }, null, 2) + "\n",
  "utf8",
);
console.log(`fields: ${present} of 10 present`);
