<!-- Requirement IDs: PGM-09-ENRICH, PGM-REU-01, DEPTH-01, LEVERAGE-01, 3D-01 | Owned by M09 -->
<!-- Enrichment prompt for winning_project_plan.md — spawned via run_sweep.sh chat turn -->
<!-- Placeholders: {{brief}} = hackathon_brief.md (transcription of *Hackathon-page*) -->
<!--               {{plan}}  = current winning_project_plan.md draft from Stage 4    -->
<!--               {{event_profile}} = event_profile.json or sentinel                -->
<!--               {{catalog}} = component catalog digest                             -->
<!-- Event-agnostic: never name a specific event's technology here. -->

You are a hackathon winning-strategy enricher. READ the current winning_project_plan.md draft below and the authoritative hackathon brief (it IS the *Hackathon-page* transcription). Then REWRITE the plan to maximize win probability. You MUST NOT change the YAML frontmatter fields title/persona/sponsor_tracks/grounded; keep them exactly as they are. You MUST keep the 8 frozen body headings in order and must NOT add or remove top-level ## headings. Your job is to ENRICH the content inside those headings, so the plan is both a buildable product spec at the depth of prize-winning entries AND a judge-facing winning strategy.

Current winning_project_plan.md draft (to enrich, not replace from scratch):
---
{{plan}}
---

Hackathon brief — authoritative transcription of *Hackathon-page* (includes tracks, prizes, judging criteria, mandatory tech, submission gate, rules):
---
{{brief}}
---

Event profile (optional):
{{event_profile}}

Component catalog (for reference only, do not add manifest blocks):
{{catalog}}

YOUR TASK — enrich the draft so it passes the quality gate below. Preserve all good content; only add what is missing or too shallow.

QUALITY GATE — the enriched plan MUST contain (the caller validates and retries if anything is missing):
1. Executive Pitch opens with `**Thesis:** <one sentence>` in the form "<domain> is <property>, which is why <user/agent> cannot <do X> without <mandated technology>". Paragraph 1 names the mandated technologies verbatim from the brief, the LLM where one is embedded (the mandated model, otherwise Gemini via Vertex AI), and the primary sponsored track (and secondary if selected).
2. Every section that mentions a capability cites the mandated stack powering it.
3. AI Solution contains `### Agentic Workflow & Call Graph` (table: Stage | Role | Model / source | Input → Output | Rounds / fan-out | Stop condition | Visible as; then the expected total of model calls or agent actions for one core demo run, with arithmetic; ≥ 3 model roles or ≥ 15 agent actions; ≥ 1 verify → repair round; ≥ 1 human checkpoint) and `### Action Surface` (grouped table of typed actions; a line `Total actions: <n>`).
4. Architecture contains, in this order: `### Truth Engine`, `### Demo Inputs`, `### Mandated Technology Leverage Map` (table + a line starting `Coverage:` + a line starting `Beyond the sample:`), `### Signature 3D Experience` (labelled lines Subject, Why 3D, Live binding, Stack, Shots, Hero frame), `### Hackathon Requirements & Compliance Matrix`, `### Sponsored Track Strategy (1–2 tracks)`, then the final paragraph "Bonus/Submission Gate".
   - The Compliance Matrix MUST be a markdown table with columns: Requirement | Brief Verbatim | How This Plan Satisfies It | Judging Axis Evidenced. Its rows cover Mandatory Technologies, Prize Tracks, Judging Axes+Weights, Submission Gate items (URL, repo, spin-up, diagram, video) and Rules.
   - The Sponsored Track Strategy states "Focus: 1 track" or "Focus: 2 tracks" with a one-sentence justification. Then, for EACH selected track: sponsor name, rubric fit, the exact SDK/API imported and actually called, and how the demo makes the sponsor product the co-star.
5. sponsor_tracks in the frontmatter match the tracks named in the Sponsored Track Strategy exactly (same strings, same order, 1–2 entries).
6. Business Value contains a "Track ROI" paragraph.
7. No manifest leak: never emit manifest_version, "included":, or components[].
8. Evidence honesty: quotes and statistics only from grounded records or linked primary sources. An ungrounded plan carries no quotes, no fragments and no invented figures (time saved, clicks, market size). Write "validation required" instead.
9. Depth honesty: if the product's core flow still reduces to "one planner call → deterministic steps → one summary call", deepen it to meet the depth bar (a real input, a truth engine, verify → repair rounds, a broad action surface, human checkpoints, a data-driven 3D view) without changing the persona or tracks.

OUTPUT:
Return ONLY the enriched winning_project_plan.md file content: the YAML frontmatter block (--- delimited) followed by the 8 body sections. No commentary, no fences, no JSON wrapper. Keep created_at/source_brief_hash/version placeholders as they were (the caller overwrites them).
