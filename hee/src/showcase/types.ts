// Requirement IDs: HEE-SHOW-01, HEE-SHOW-02, HEE-SHOW-03, HEE-SHOW-04, HEE-CLAIM-01
// DP-W09 §2 data shapes. The technology's name is data (showcase.json), never a literal here.

export type ClaimSource =
  | { type: "artifact"; path: string; pointer?: string; format?: string; contains?: string }
  | { type: "url"; url: string; evidence_quote: string; checked_at: string };

export interface Claim {
  id: string;
  match: string;
  text: string;
  kind: "number" | "comparison" | "fact" | "superlative";
  source: ClaimSource;
  ceiling: string;
  status: "verified" | "unverified" | "retracted";
  verified_at: string | null;
}

export interface ClaimLedger {
  version: "1.0.0";
  generated_at: string;
  surfaces: string[];
  claims: Claim[];
}

export interface ShowcaseConfig {
  version: "1.0.0";
  title: string;
  technology_name: string;
  license_name: string;
  live_url: string;
  video_url: string;
  repo_url: string;
  supported_runtimes: string[];
  known_gaps: string[];
  sixty_second_path: { step: string; expect: string }[];
  try_prompts: string[];
  axes: { criterion: string; evidence: { label: string; link: string }[] }[];
  surfaces?: string[];
}

export type DemoAction =
  | { route: string }
  | { click: string; role?: string }
  | { type: { label: string; value: string } }
  | { press: string }
  | { wait_ms: number }
  | { play3d: string }
  | { expect_text: string };

export interface DemoStep {
  id: string;
  title: string;
  actions: DemoAction[];
  settle_ms: number;
}

export interface DemoStill {
  id: string;
  after_step: string;
  selector: string | null;
  claim: string;
  claim_id: string | null;
  alt: string;
}

export interface DemoScenario {
  version: "1.0.0";
  base_url: string;
  viewport: { width: number; height: number };
  steps: DemoStep[];
  stills: DemoStill[];
  hero: { from_step: string; to_step: string } | null;
}

export interface CaptionEntry {
  file: string;
  caption: string;
  alt: string;
  claim_id: string | null;
  size: "gallery" | "readme" | "hero";
}

export interface LintResult {
  problems: string[];
  warnings: string[];
}

export interface ClaimsLint extends LintResult {
  count: number;
}

export interface VerifyResult {
  ok: boolean;
  detail: string;
}

// Minimal action-manifest shape needed for the README action table (DP-W06 contract).
export interface ActionManifestLike {
  actions: { name: string; group: string; description: string }[];
}
