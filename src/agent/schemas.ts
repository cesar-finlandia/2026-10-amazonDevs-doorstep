// Requirement IDs: FR-06, FR-18
import { z } from "zod";
export const ExtractedEventSchema = z.object({
  rawId: z.string().describe("The id of the input record this event came from, copied exactly."),
  deviceId: z.string(),
  componentId: z.number().int().min(0).max(8),
  type: z.enum(["motion_detected", "button_press", "device_online", "device_offline"]),
  subType: z.enum(["human"]).nullable(),
  tsMs: z.number().int().positive().describe("UTC milliseconds since 1970."),
  requestId: z.string(),
});
export const ExtractorOutputSchema = z.object({
  events: z.array(ExtractedEventSchema),
  skipped: z.array(z.object({ rawId: z.string(), reason: z.string().max(120) })),
});
export const ReviewPlanSchema = z.object({
  steps: z.array(z.object({
    order: z.number().int().min(1).max(8),
    goal: z.string().min(8).max(160),
    actions: z.array(z.string()).min(1).max(6),
    why: z.string().min(8).max(200),
  })).min(3).max(8),
  focusDays: z.array(z.number().int().min(7).max(13)).max(7),
  watchFor: z.array(z.string().max(120)).max(6),
});
export const NarrationSchema = z.object({
  incidentId: z.string(),
  title: z.string().min(4).max(80),
  explanation: z.string().min(20).max(320),
  tone: z.enum(["calm", "check_in"]),
  suggestedNudge: z.string().max(200).nullable(),
});
export const ROLE_SCHEMAS = { extractor: ExtractorOutputSchema, planner: ReviewPlanSchema, narrator: NarrationSchema } as const;
export const ROLE_MODEL_TIER = { extractor: "fast", planner: "balanced", narrator: "fast" } as const;
export type RoleName = "extractor" | "planner" | "narrator";
export interface ExtractorInput { kind: "webhook_inbox" | "history_page"; deviceId: string; records: { rawId: string; record: unknown }[] }
export interface PlannerInput { goal: string; household: { name: string; age: number; caretaker: string; quietHours: string }; baseline: { dwellP90Min: number; visitsPerDay: number }; dayCounts: { day: number; label: string; events: number }[]; actions: { name: string; purpose: string }[] }
export interface NarratorInput { incident: { id: string; kind: string; title: string; whenLocal: string; durationMin?: number; facts: string[] }; household: { name: string; caretaker: string }; baseline: { dwellP90Min: number } }
export interface RoleInput { extractor: ExtractorInput; planner: PlannerInput; narrator: NarratorInput }
export type ExtractorOutput = z.infer<typeof ExtractorOutputSchema>;
export type ReviewPlan = z.infer<typeof ReviewPlanSchema>;
export type Narration = z.infer<typeof NarrationSchema>;
export interface RoleOutput { extractor: ExtractorOutput; planner: ReviewPlan; narrator: Narration }
