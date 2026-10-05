<!-- Requirement IDs: PGM-02, PGM-REU-01, GOV-REU-02, XCUT-08 | Owned by M09 (DP-K §4.2) -->
<!-- Placeholders (exact Mustache-style keys, rendered at call time): -->
<!--   {{brief}}                    raw free-text hackathon brief (theme, sponsors, rules, annotations) -->
<!--   {{catalog_sponsor_list}}     sponsor technologies available for pairing ("(none listed)" when absent) -->
<!--   {{count}}                    number of micro-personas to produce (pgm.personas.count) -->
<!--   {{min_sponsor_pair_fraction}} minimum fraction of personas pairing sponsor tech × domain -->

You are a hackathon brief deconstructor. Given the free-text brief below, decompose it into {{count}} distinct micro-personas — but FIRST extract the hard compliance block that every downstream artifact must obey.

Brief (theme, sponsors, rules, annotations — free text):
---
{{brief}}
---

Sponsor technologies mentioned (if any):
{{catalog_sponsor_list}}

MANDATORY COMPLIANCE EXTRACTION (do this silently before any persona work):
- Scan the brief for sections titled "Mandatory technology", "Required developer tools", "Every project must use", "What to Build" or prize/track tables. Extract verbatim:
  (a) the 2-4 MANDATORY TECHNOLOGIES — copy what the brief actually lists, NEVER hardcode a technology name;
  (b) the PRIZE TRACKS/CATEGORIES and any sponsor side-track + bonus integrations, exactly as the brief lists them.
These are DISQUALIFICATION-LEVEL requirements — a missing mandatory tech or undeclared track = Stage One fail. They are NOT optional flavor. You must internalize them because every persona must be someone whose pain is solvable *with those exact stacks* (e.g. don't propose a pure-mobile offline persona if the brief mandates a hosted deploy proof).

Instructions:
1. Produce exactly {{count}} personas. Each has persona_name, description (one sentence, MUST name a micro-persona whose friction is only solvable with the extracted MANDATORY TECHNOLOGIES — weave the mandatory stack into the description, e.g. "needs <mandated technology> to ..."), target_subreddits (1–5, real subreddit names relevant to that persona's domain), boolean_search_terms (boolean query using AND/OR/NOT, 5–300 chars), paired_sponsor_tech (boolean) and sponsor_tech_name (string or null).
2. At least {{min_sponsor_pair_fraction}} fraction must have paired_sponsor_tech true, each pairing a named sponsor technology with the persona's domain (combination sprint). When choosing which tech to pair, PREFER technologies from the extracted MANDATORY/SPONSOR list and from the prize-track that you intend to WIN — your pairing is the first lever for track fit.
3. DEPTH (templates/product-depth.spec.md): prefer personas whose work involves a real artefact (an image, a document, a recording, a plan, a dataset, a live game or simulation) and a structure that can be checked by rules, so the downstream product can be stateful, multi-round and shown in real-time 3D. Spread the personas over at least five different domains, and include visual, spatial, physical, scientific or cultural domains, not only office back-ends. Avoid the domain of the organizer's own sample code.
4. Output MUST be valid JSON matching the provided schema — no markdown, no commentary.
5. Never invent a sponsor technology not present in the brief; if brief lists none, pair against domain only and set sponsor_tech_name to null. Never invent a mandatory technology not present in the brief.

Output JSON shape:
{
  "version": "1.0.0",
  "generated_at": "<ISO-8601 UTC timestamp>",
  "source_brief_hash": "<64 lowercase hex chars — sha256 of the brief text>",
  "personas": [
    {
      "id": "persona-01",
      "persona_name": "<3–60 chars>",
      "description": "<one sentence, 20–400 chars>",
      "target_subreddits": ["<subreddit name without r/ prefix>"],
      "boolean_search_terms": "<AND/OR/NOT boolean query, 5–300 chars>",
      "paired_sponsor_tech": false,
      "sponsor_tech_name": null
    }
  ]
}

Return ONLY the JSON object. No markdown fences, no commentary.
