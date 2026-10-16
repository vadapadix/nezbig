# Results page design contract

Goal: help an author understand verified text matches, inspect evidence, and interpret AI indicators without confusing the measures.

Evidence: repository screenshots `06_report_metrics_verdict.png`, `07_report_matches_sources.png`, `08_report_ai_signals_diagnostics.png`; existing Actay typography and teal/forest brand. UIZZE catalogue HTML was reachable but catalogue screens and live browser access were denied. No external reference screens are claimed as reviewed.

Direction: an editorial research report, with a quiet dark frame, a single dominant verbatim-coverage number, a compact evidence summary and readable source excerpts. Preserve the brand, routes, exports, report data and retry actions.

Hierarchy: document/date and export; verbatim coverage with explicit limits; strongest match and local AI status as separate secondary measures; sources/AI/method tabs; source evidence first, algorithm diagnostics collapsed.

Allowed: typography, separators, restrained teal selection, amber limitations, rose only for actual elevated indicators; native details for explanation. Forbidden: gradient numerals, glowing dots, four interchangeable metric cards, ornamental bars, unconditional claims of originality and combined plagiarism/AI verdicts.

Required states: verified matches; search leads only; no matches; failed/partial search; unknown legacy coverage; insufficient AI evidence; pending/failed/returned AI opinion; long filenames; mobile stacking; keyboard tabs; reduced motion. URL retains selected report tab.

Implementation: replace ReportView presentation; add a scoped report stylesheet; refine source cards and their evidence disclosures. Keep editor and humanizer redesign out of this change following the user's priority.

Verification: component tests exercise source/AI/method navigation, evidence details, safe empty states, copy failures, and source filters; run TypeScript/build/lint/unit tests. Browser screenshot review remains blocked by explicit origin-permission denials and must not be bypassed through other browser tools.

Finish status: implementation may be tested in the DOM, but visual finish approval must remain pending until rendered browser access is available.

Validation: 173 unit/integration tests passed across 33 files, including eight new report interaction tests. Production build and TypeScript checks passed; ESLint passed without warnings. Existing browser-test assertions were updated to the new report structure but browser tests were not executed because local browser access was denied. The user explicitly granted local viewing afterward; the browser gate still rejected it because a saved permission/managed setting blocks that origin. No alternate browser tool was used to bypass this restriction.
