# Deep Review Implementation Plan

> **For agentic workers:** Execute these tasks inline, sequentially, with regression checks. The user requested implementation and documentation, not a separate planning handoff.

**Goal:** Correct document preprocessing and report evidence inconsistencies, improve report navigation, and align operational documentation with the implementation.

**Architecture:** Keep the existing React/Express architecture. Extract narrowly scoped match selection and bibliography-boundary helpers where reuse prevents inconsistent decisions. Preserve source-first results and the existing brand.

**Tech Stack:** TypeScript, React, Express, Vitest, Vite, Vercel.

### Task 1: Deterministic correctness

- [x] Test that verified hydration supersedes a stronger snippet for the same source/chunk and that displayed evidence agrees with coverage.
- [x] Inspect preprocessing for accidental truncation at prose mentions of references and for loss of paragraph boundaries.
- [x] Implement shared helpers and run targeted regression suites.

### Task 2: Report usability

- [x] Preserve overview → sources → AI explanation hierarchy. Add direct section navigation and show how many matches are omitted, if any.
- [x] Correct async export feedback so buttons remain busy until the operation settles and errors are visible.
- [x] Check semantic navigation, mobile styles and existing component interactions. Rendered finish gate remains pending while browser policy blocks the origin; do not bypass it.

### Task 3: Documentation

- [x] Rewrite README for Nezbig, explaining setup, metrics, limitations, storage and checks.
- [x] Rewrite Ukrainian architecture with actual search providers, scoring weights, preprocessing, evidence limits and UI order.
- [x] Add Vercel/environment and report interpretation guides. Update `.env.example` from runtime variable usage.
- [x] Record findings and distinguish unit-regression evidence from measured real-world accuracy.

### Task 4: Delivery

- [x] Run all unit/integration tests, production build, lint and staged diff checks.
- [x] Commit only application/documentation changes and push main under the existing authorization. Preserve unrelated thesis edits.

Validation: 197 tests passed across 39 files. Production build, TypeScript and lint completed successfully. Browser rendering and live external-provider flows remain unverified because the saved browser policy blocks access.
