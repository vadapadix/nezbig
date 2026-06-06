# Humanizer And File-First Scan Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an editor-style text humanizer and make uploaded documents scan as files instead of being pasted into the visible text field.

**Architecture:** The server owns document extraction, prose filtering, scan scoring, file metadata notes, and deterministic humanization. The client keeps pasted text and uploaded files as separate input modes, sends files through multipart endpoints, and renders humanization output in a separate result panel.

**Tech Stack:** TypeScript, Express, Multer memory uploads, React, Vitest, existing text extraction and scoring modules.

---

## File Structure

- `src/server/humanizer.ts`: deterministic humanization rules, pattern evidence, and change summaries.
- `src/server/humanizer.test.ts`: regression tests for removing AI writing patterns while preserving meaning.
- `src/server/textExtraction.ts`: expose extraction metadata helpers so file-first endpoints can identify how a file was read.
- `src/server/app.ts`: add `/api/scan-file`, `/api/ai-opinion-file`, `/api/humanize`, and `/api/humanize-file`.
- `src/shared/types.ts`: add humanizer request/result and file evidence report fields.
- `src/client/App.tsx`: keep uploaded files in state, submit multipart scans, add humanizer UI and result panel.
- `src/client/styles.css`: add compact file-mode and humanizer panels.

## Tasks

### Task 1: Humanizer module and tests

- [ ] Add `humanizeText(text)` in `src/server/humanizer.ts`.
- [ ] Cover Ukrainian and English AI-pattern cleanup in `src/server/humanizer.test.ts`.
- [ ] Verify with `npm test -- src/server/humanizer.test.ts`.

### Task 2: File-first server flow

- [ ] Add file evidence types in `src/shared/types.ts`.
- [ ] Refactor extraction to return metadata without changing existing `/api/extract`.
- [ ] Add `/api/scan-file` and `/api/ai-opinion-file` in `src/server/app.ts`.
- [ ] Add scan note showing file name, type, size, extraction method, and extracted word count.

### Task 3: Humanizer API

- [ ] Add JSON `/api/humanize` for pasted text.
- [ ] Add multipart `/api/humanize-file` for uploaded files.
- [ ] Reject inputs under 20 words so results are not noisy.

### Task 4: Client UI

- [ ] Store selected `File` separately from textarea text.
- [ ] Do not populate textarea when a file is selected.
- [ ] Send file scans through `/api/scan-file`.
- [ ] Add "Олюднити текст" action and render revised text plus change list.

### Task 5: Verification and cleanup

- [ ] Run `npm test`.
- [ ] Run `npm run build`.
- [ ] Review diff for unrelated churn and commit with Lore trailers.

## Self-Review

- Spec coverage: humanizer, file-first upload, tests, and UI are covered.
- Placeholder scan: no TBD or deferred implementation steps.
- Type consistency: shared types drive both server and client.
