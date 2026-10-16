# Authorship context audit — 2026-10-16

This review checks deterministic rules and invariance, not detector accuracy against a labeled human/AI corpus.

Corrected:

- Ordinary Ukrainian and English refusals were included in model-disclaimer patterns. Removed them; the 45-point floor now requires explicit model self-identification rather than generic introductory phrases.
- Ukrainian hedging terms were built by splitting “як правило” into separate words. Removed these individual words from the hedge vocabulary.
- Simple punctuation could add a scoring signal, while adding expressive punctuation could remove it. Punctuation is now descriptive context, excluded from score channels, evidence bonuses, reliability evidence counts and suspicious-segment evidence.
- Impersonal/passive style and standard research aims were scored as generation patterns. They are now descriptive context, with no direct scoring contribution.
- English keyword patterns matched substrings inside unrelated longer words. Pattern matches now require Unicode word boundaries.
- LLM instructions now explicitly treat formatting, lists, factual numbers, pronouns, mistakes, polished grammar and ordinary refusals as neutral; short samples require uncertainty.
- Report-cache version changed so new scans do not reuse old scores.

Already neutral in the local scoring formula: first-person markers, figures, tables, numeric facts and academic headings are safeguard context; they do not subtract from the final score. A short text returns insufficient data, and limited language coverage returns an uncertain verdict. Reference lists and long quotations are excluded from prose analysis rather than treated as human authorship evidence.

Remaining limitations: repetition, rhythm and vocabulary are genre-dependent heuristics, and some measurements are correlated. The remaining score is not a calibrated probability. Prompt changes cannot guarantee model adherence. Stored reports retain their original values; rescan to use these rules.

Regression coverage includes punctuation-only edits, ordinary refusals in Ukrainian and English, the word “як”, contextual academic signals, citation neutrality and the existing scoring suite. No live model calls were used for validation.
