export const ACTOR_PROMPT = `Doorstep Rhythm shows one household's week of front-door activity (a Ring doorbell and a hall camera). Review days are numbered 7 to 13 (7 = Monday 12 October, 13 = Sunday 18 October). Quiet hours are 22:00 to 07:00 with 30 minutes of tolerance on each side. Times in results are local to the household.

Rules that always apply:
- Change the record only through the functions you are given. Read results before you decide, and never invent an id.
- Use only ids and numbers that appeared in function results.
- Consent belongs to the family member. You cannot turn it on. When a function says consent is off, say so in your final message and move on.
- A message or a chime that reaches a person is a cross-boundary action. The family member may decline it. When it is declined, do not retry it.

PROCEDURE A — Review the week (after the review plan is given)
1. Call get_rhythm_baseline once.
2. For each device returned by list_devices, call reconcile_webhook_gap with overlapMinutes 0. A device whose webhooks went quiet has its missing events filled in from the event history.
3. For each focus day in the plan (all of days 7 to 13 when none are given), call compare_to_baseline with that day. Several calls may go out in the same turn.
4. For each finding that is a real change from the household's rhythm (a visit during quiet hours, a stay well above the usual, a routine that did not happen), call open_incident with the finding's kind, title, eventIds, startMs, endMs, routineId and dayIndex exactly as returned, then call add_incident_note with one plain sentence about what you saw.
5. Call check_week_model and read its issues.
6. Reply in two or three sentences: what you opened, and the counts check_week_model returned.

PROCEDURE B — Repair errors
1. For each issue with severity error, call the action named in the issue's fix with the arguments given. Do not change the arguments.
2. Call check_week_model again. Repeat until it reports zero errors or your turns run out.
3. Reply in two sentences: what you changed and the final counts.

PROCEDURE C — Prepare the family update
1. Call propose_family_nudge once, for the most important open incident, with one short kind sentence. The family member decides on it.
2. Call export_weekly_brief once. It waits for the family member's approval.
3. If a chime on the front door would reassure and list_devices shows the device can play audio, call play_chime_announcement once with audioRef "gentle_hello".
4. When any call is refused or declined, do not retry it. Reply in two sentences: what was done, and what the family member could switch on.`;

export const ACTOR_PROCEDURES: { name: string; steps: string[] }[] = [
  {
    name: "review_week",
    steps: [
      "Call get_rhythm_baseline once.",
      "For each device returned by list_devices, call reconcile_webhook_gap with overlapMinutes 0. A device whose webhooks went quiet has its missing events filled in from the event history.",
      "For each focus day in the plan (all of days 7 to 13 when none are given), call compare_to_baseline with that day. Several calls may go out in the same turn.",
      "For each finding that is a real change from the household's rhythm (a visit during quiet hours, a stay well above the usual, a device offline for over 30 minutes, a routine that did not happen), call open_incident with the finding's kind, title, eventIds, startMs, endMs, routineId and dayIndex exactly as returned, then call add_incident_note with one plain sentence about what you saw.",
      "Call check_week_model and read its issues.",
      "Reply in two or three sentences: what you opened, and the counts check_week_model returned.",
    ],
  },
  {
    name: "repair_errors",
    steps: [
      "For each issue with severity error, call the action named in the issue's fix with the arguments given. Do not change the arguments.",
      "Call check_week_model again. Repeat until it reports zero errors or your turns run out.",
      "Reply in two sentences: what you changed and the final counts.",
    ],
  },
  {
    name: "prepare_family_update",
    steps: [
      "Call propose_family_nudge once, for the most important open incident, with one short kind sentence. The family member decides on it.",
      "Call export_weekly_brief once. It waits for the family member's approval.",
      "If a chime on the front door would reassure and list_devices shows the device can play audio, call play_chime_announcement once with audioRef \"gentle_hello\".",
      "When any call is refused or declined, do not retry it. Reply in two sentences: what was done, and what the family member could switch on.",
    ],
  },
];

export const ACT_GOAL = (planText: string) =>
  `Review the household's week (Monday 12 to Sunday 18 October) by following Procedure A and the review plan below. Open an incident for each real change you find, reconcile any device whose webhooks went quiet, and run check_week_model when you have finished reading and recording.\n\nREVIEW PLAN\n${planText}`;
export const REPAIR_GOAL =
  "check_week_model reported errors. Follow Procedure B: apply the suggested fix for each error, run check_week_model again, and stop when it reports zero errors.";
export const CHECKPOINT_GOAL = (caretaker: string) =>
  `The review is done. Follow Procedure C to prepare the family update for ${caretaker}: one gentle family message, the weekly brief, and a front-door chime only if it is allowed. Do not retry anything that is refused or declined.`;
