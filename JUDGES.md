# Judges' guide

**Live:** https://doorstep-rhythm-7wndoy2fuq-uc.a.run.app
**Video:** https://doorstep-rhythm-7wndoy2fuq-uc.a.run.app/watch
**Repository:** https://github.com/cesar-finlandia/2026-10-amazonDevs-doorstep

## The 60-second path
1. Open the live page and press Load the sample week. — you should see: Seven days of Rosa's front door appear as a paper calendar.
2. Press Review the week. — you should see: The agent works through its steps and a request waits for you.
3. Press Approve when the request appears. — you should see: The review finishes and one moment is circled on its day.
4. Press Focus above the 3D view. — you should see: The camera frames the circled moment.
5. Open /watch and press Watch the agent do it. — you should see: A labelled replay of a recorded run plays.

## Three prompts to try
1. `Look through the week and put a note on the one moment that doesn't fit her usual routine.`
2. `Check the week over, fix anything that doesn't add up, and tell me in two sentences how it looks.`
3. `Please play a reassuring message through the door speaker so Mum knows someone is thinking of her.`

## Where it runs
Supported: Node 22 or newer, with a current Chromium for the browser tests, A container host (Google Cloud Run is the documented default)
Known gaps:
- Live Ring needs a Playground token; the sample week is bundled so the product opens without one.
- Webhooks cannot reach a hosted copy during a demo; signed, labelled simulated deliveries go through the same verifier.

## Criteria → evidence
| Criterion | Where to see it |
|---|---|
| Tech Implementation | [Architecture with runtime proof lines](architecture.json) · [Browser test results](design_documents/e2e-testing/results.md) · [Measured action-surface evaluation](evals/report.json) |
| Design | [Design brief](design_documents/design_brief.md) · [Hero recording](shots/showcase/hero.gif) |
| Potential Impact | [Who it is for and why it matters](design_documents/winning_project_plan.md) |
| Quality of the Idea | [The idea and the alternatives weighed](design_documents/pitch_candidates.md) |
