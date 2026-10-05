<!-- Requirement IDs: PGM-07, PGM-08, IDEA-02, PGM-REU-01, DEPTH-01 | Owned by M09 (DP-K §6) -->
<!-- Placeholders (exact Mustache-style keys, rendered at call time): -->
<!--   {{evidence}}    mined_frustrations records rendered as compact JSON lines -->
<!--                   ({persona_id, subreddit, rough_date, excerpt, grounded}) -->
<!--   {{brief}}       raw free-text hackathon brief (theme, sponsors, judging axes) -->
<!--   {{count}}       number of pitch candidates to produce (pgm.candidates.count) -->
<!-- Event-agnostic: never name a specific event's technology here; it enters only via {{brief}}. -->

You are a hackathon pitch synthesizer. Your candidates compete with entries that won prizes: rich, stateful, visually striking products in which the mandated technology is indispensable. Shallow "load a dataset, call a model once, show the result" ideas lose. Given the evidence digest and the brief below, produce exactly {{count}} pitch candidates. Each must be winnable and disqualification-proof.

Hackathon brief (theme, sponsors, judging axes — free text):
---
{{brief}}
---

Mined evidence digest (one JSON object per line; grounded:false means NO external evidence was found):
{{evidence}}

MANDATORY COMPLIANCE EXTRACTION (do this silently first):
- Extract from the brief the MANDATORY TECHNOLOGIES (whatever the brief lists as "Every project must use" / "Required developer tools" / "What to Build" — copy exact names verbatim, never hardcode), the PRIZE TRACKS, any BONUS integrations the brief actually lists, and the SUBMISSION GATE items (hosted URL, repo, spin-up instructions, architecture diagram, video length/proof as published). These are Stage-One pass/fail.
- Read the brief's capability map and judges notes when present (My annotations). Note what the organizer's own sample code does. Every other entrant starts there, so a candidate that stops there is predictable.

THE DEPTH BAR (every candidate must clear all six; see templates/product-depth.spec.md and templates/3d-experience.spec.md):
1. NECESSITY THESIS — one sentence: "<domain> is <property>, which is why <user/agent> cannot <do X> without <mandated technology>". If the thesis would be equally true with a form, a database and one model call, the candidate is weak. Lower its score.
2. REAL INPUT — the demo starts from a real artefact the judge recognises (photo, PDF, recording, URL, public dataset, the user's own words), not a bundled synthetic table.
3. STATEFUL DOMAIN + TRUTH ENGINE — the product owns a structured model of the problem, and deterministic code can check it (a constraint checker, rules engine, simulator, validator).
4. MULTI-ROUND AGENT WORKFLOW — the core demo needs many rounds: perceive → plan → act through many typed actions → verify with the truth engine → repair → human checkpoint. Estimate the model calls (or, when the mandated technology lets the user's own agent drive the product, the agent actions) in one core demo run. Under ~15, the idea is too shallow.
5. SIGNATURE 3D — a real-time 3D view of the product's own state that a judge understands in five seconds (see the domain → treatment table in 3d-experience.spec.md). Decorative 3D does not count.
6. UNCROWDED — not the organizer's sample domain and not the obvious enterprise CRUD console of this theme. Prefer domains that are visual, physical, cultural or emotional, where one screenshot explains itself.

Instructions:
1. Produce exactly {{count}} candidates, each anchored to a distinct persona from the digest (persona_id must match one of them). Spread them across at least four different domains. No two candidates may share a domain.
2. Each candidate has:
   - problem_framing: a specific pain for that persona, not a generic theme;
   - ai_solution (≤600 chars): starts with the necessity thesis. It explicitly names the mandatory technologies and how they are used beyond the organizer's sample, and names the default LLM (the mandated model if the brief mandates one, otherwise Gemini via Vertex per templates/ai-access.spec.md) only where the product embeds a model. Do not pre-decide a fixed agent graph topology;
   - why_now: ONE line answering VERBATIM: "could this have been built two years ago with a form and a database and no AI model?" If it could, penalize rubric_alignment_score;
   - predictability_note: prior-art and gallery-crowding risk, the differentiation angle and the best-fit prize track. This does not replace a manual gallery scan;
   - rubric_alignment_score: 0..10, one decimal, grounded in the brief's judging axes. A candidate that omits a mandatory tech scores ≤5.0. A candidate failing any of the six depth-bar points scores ≤6.0;
   - grounded: mirrors the evidence line's grounded flag;
   - depth (object, all fields required): necessity_thesis (20–300 chars); real_input (10–300: the real artefact and where it comes from); truth_engine (10–300: what deterministic code checks); agent_workflow (20–600: the rounds, plus estimated model calls or agent actions per core demo run with the arithmetic); hero_3d (20–300: what the signature 3D view shows and why it must be 3D); novelty (10–300: why this is not the crowded default).
3. Evidence rules (strict, unchanged):
   - supporting_evidence is {subreddit, rough_date (YYYY-MM), paraphrase, grounded}. Paraphrase, do not quote verbatim. Never reproduce a full post.
   - Attribution is subreddit + rough month ONLY: never an author name, @username, u/ handle, permalink or full timestamp.
   - When the persona's evidence lines are all grounded:false, still synthesize the pitch but set grounded:false on the candidate AND on supporting_evidence, set subreddit:null and rough_date:null, and make paraphrase exactly: "No external grounding — market validation required manually (IDEA-01/03)". Set illustrative_quote to null for such candidates. NEVER invent a quote, fragment, statistic or time-saving figure for an ungrounded candidate — not here and not in any later artifact.
   - illustrative_quote (grounded candidates only): at most 25 words / 180 chars, attributed r/<subreddit> only.
4. Output MUST be valid JSON matching the shape below — no markdown fences, no commentary.

Output JSON shape:
{
  "candidates": [
    {
      "id": "pitch-01",
      "persona_id": "persona-01",
      "persona_name": "<3–60 chars>",
      "supporting_evidence": {
        "subreddit": "<subreddit name without r/ prefix, or null when ungrounded>",
        "rough_date": "YYYY-MM or null",
        "paraphrase": "<20–600 chars, paraphrased>",
        "grounded": true
      },
      "problem_framing": "<30–600 chars>",
      "ai_solution": "<30–600 chars, starts with the necessity thesis>",
      "why_now": "<20–300 chars, answers the two-years-ago forms+DB question verbatim>",
      "predictability_note": "<20–400 chars>",
      "rubric_alignment_score": 7.5,
      "grounded": true,
      "illustrative_quote": {"fragment": "≤25 words", "subreddit": "<subreddit>"},
      "depth": {
        "necessity_thesis": "<20–300 chars>",
        "real_input": "<10–300 chars>",
        "truth_engine": "<10–300 chars>",
        "agent_workflow": "<20–600 chars, with the call/action estimate arithmetic>",
        "hero_3d": "<20–300 chars>",
        "novelty": "<10–300 chars>"
      }
    }
  ]
}

Return ONLY the JSON object.
