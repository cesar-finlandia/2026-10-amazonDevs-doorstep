// src/ui/help/helpContent.ts — one module for every help text (DP-UI §5.6A).
// Requirement IDs: FR-19
export type HelpRegionId =
  | "week-ribbon" | "open-checks" | "check-panel" | "incident-card" | "nudge-card"
  | "activity-feed" | "approval-bar" | "baseline" | "scene-3d" | "live-view"
  | "ring-status" | "agent-status" | "consent" | "quiet-hours";

export const helpContent: Record<HelpRegionId, { label: string; body: string }> = {
  "week-ribbon": {
    label: "What is the week calendar?",
    body: "One column per day, from midnight at the top to midnight at the bottom. Each pencil tick is something at the door; a circle means the usual rhythm broke there. Shaded bands are quiet hours.",
  },
  "open-checks": {
    label: "What does the open checks number mean?",
    body: "How many things the checker still wants a person to look at, counting errors and warnings from the latest check. A calm week reads 0.",
  },
  "check-panel": {
    label: "What is the check panel?",
    body: "A fixed set of rules runs over the week every time anything changes: quiet hours, long visits, a device that went quiet, consent and duplicate events. Each line says what it found, in minutes.",
  },
  "incident-card": {
    label: "What is an incident?",
    body: "A moment that broke the usual rhythm, written up in plain words. The agent drafts it, a person reads it, and nothing leaves this app until a person says so.",
  },
  "nudge-card": {
    label: "What is a suggested message?",
    body: "A short note the agent proposes to send. It stays a suggestion until you approve it, and only reaches channels you have switched on.",
  },
  "activity-feed": {
    label: "What is the activity feed?",
    body: "Every step in order: who did it (AGENT, YOU or SYSTEM), what it was and whether it worked. The same list is saved as the run trace.",
  },
  "approval-bar": {
    label: "What is the approval bar?",
    body: "Anything that reaches outside this app waits here until you press Approve or Reject. If you reject, the agent is told and asks what to do instead.",
  },
  baseline: {
    label: "What is the usual rhythm?",
    body: "The household's own normal, learned from the earlier days: how long visits usually last and when the door is busy. Each day is compared with it.",
  },
  "scene-3d": {
    label: "What is the doorway view?",
    body: "The same week drawn as a doorway with a column for each day. Pillars mark events and rise as new ones arrive. Pick one to see it in the calendar.",
  },
  "live-view": {
    label: "What is live view?",
    body: "A short look through the camera, opened only when you press the button and closed by itself after 30 seconds.",
  },
  "ring-status": {
    label: "What does the Ring status show?",
    body: "Whether this page is reading the sample week or a real Ring account, and how long a pasted token has left.",
  },
  "agent-status": {
    label: "What does the agent status show?",
    body: "Which model is doing the thinking right now and how much of the demo budget is used. If it falls back to another model, this says so.",
  },
  consent: {
    label: "What are the consent switches?",
    body: "Each outgoing channel is off until a person turns it on here. The agent cannot switch these on.",
  },
  "quiet-hours": {
    label: "What are quiet hours?",
    body: "The hours when activity at the door is unusual for this house. They start as 10 pm to 7 am with a 30-minute margin on each side.",
  },
};

export const explainerCopy: {
  title: string;
  what: string;
  who: string;
  flow: string[];
  read: string;
  tryIt: string;
} = {
  title: "How Doorstep Rhythm works",
  what: "Doorstep Rhythm turns a doorway's comings and goings into a calm week you can read at a glance, and points out only the moments that broke the household's usual rhythm.",
  who: "Someone who lives far from a parent who lives alone. A daily check-in call can feel like surveillance; the doorway can answer the same question without a call.",
  flow: [
    "Events from the Ring doorbell and camera arrive and are placed on the week.",
    "An agent reads the week, opens an incident for each broken rhythm and runs the checker.",
    "It fixes what the checker finds, then explains each incident in plain words.",
    "Anything that would leave the app, such as a message or a chime, waits for your approval.",
  ],
  read: "Ticks are events. A pencil circle is a moment worth a look. The number at the top is how many checks are still open; the goal is zero.",
  tryIt: "Review the sample week",
};
