# Security and report correctness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Close report and OAuth access vulnerabilities, make retention truthful, isolate cached scans, and distinguish match strength from document coverage.

**Architecture:** Keep account reports private and use an HTTP-only guest session for temporary jobs. Store report ownership with the report, remap imported reports rather than trusting client identifiers, and remove report payloads from completed job records. Cache results in bounded process memory with full settings and principal isolation, and invalidate them when history is deleted. Retain account history explicitly, document retention and third-party processing honestly, and never persist anonymous reports.

**Tech Stack:** TypeScript, Express, React, Vitest, Playwright, Redis/Vercel KV.

---

### Task 1: Authentication

Files: `src/server/auth.ts`, new `src/server/security.ts`, `src/server/authRoutes.ts`, `src/client/hooks/useAuth.tsx`, `.env.example`.

- [x] Reject missing/weak production JWT secrets, use ephemeral development secrets, and secure production cookies.
- [x] Create signed OAuth state bound to a random HTTP-only cookie, enforce configured return origins, consume state before token exchange, and return via cookie with no URL token.
- [x] Add credential schemas and authentication throttling; make cookie-only Google login work on refresh and history synchronization.
- [x] Test invalid origins, missing/mismatched/replayed state, safe callback, secrets and cookies.

### Task 2: Private storage and retention

Files: `src/server/db.ts`, `src/server/historyRoutes.ts`, `src/server/jobStore.ts`, `src/server/app.ts`, storage/security tests.

- [x] Save explicit account ownership, check ownership before reads and AI writes, reject path-shaped identifiers.
- [x] Copy imported report payloads to fresh server IDs; never overwrite or claim another account's ID through sync.
- [x] Persist only authenticated scans. Keep guest jobs/results in bounded memory under a guest cookie. Persist account jobs without full report payloads.
- [x] Delete report files, memory entries and remote values when removing history; invalidate result caches and reject updates after deletion.
- [x] Test cross-account reads/writes/jobs/sync and complete report deletion.

### Task 3: Cache and metrics

Files: `src/server/jobStore.ts`, `src/server/app.ts`, `src/server/plagiarismScoring.ts`, `src/server/scoring.ts`, `src/shared/types.ts`, reporting components/exports.

- [x] Key reusable results by principal, canonical settings, input filename, file evidence and text; issue a fresh report ID and timestamp on reuse.
- [x] Store source word intervals for verified verbatim evidence; union intervals before dividing by all analyzed words. Keep coverage separate from strongest-match risk and label unknown legacy coverage explicitly.
- [x] Test changed settings/files/users, overlapping sources, and a short copied passage in a long document.
- [x] Remove unsupported certainty claims about AI detection and humanization in report copy.

### Task 4: Validation and deployment

Files: `src/client/pages/Privacy.tsx`, `README.md`, `.github/workflows/ci.yml`, `playwright.config.ts`, lint warning locations.

- [x] Explain account/local history, retention, deletion, search providers and optional AI processing in both languages.
- [x] Fix development CORS methods/origin and existing lint warnings. Include unit tests in CI.
- [x] Run `npm test`, `npm run lint`, `npm run build`, `npm run calibrate`, and bounded `npx playwright test --reporter=line`.
- [x] Restore only test artifacts changed by validation; preserve pre-existing thesis edits. Report external OAuth/provider validation limitations.

## Validation result

- 165 unit/integration tests passed across 32 files.
- 10 Chromium browser scenarios passed, including a real cookie-only account registration and reload.
- Production build and TypeScript checks passed.
- ESLint completed without warnings or errors.
- Synthetic calibration completed; its scores remain regression diagnostics rather than real-world accuracy evidence.
- Tested OAuth with mocked Google responses; no live Google authorization or paid search/AI-provider requests were made.
- Added remote-storage simulations for stale-replica reads and concurrent deletion during an AI update. No live Redis/KV deployment was modified.
- Restored the three tracked browser-test artifacts; preserved pre-existing thesis changes.
- Deployment requires a strong JWT_SECRET, HTTPS CLIENT_URL and explicit GOOGLE_REDIRECT_URI. No deployment was performed.
