# Antiplagiarism Web App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a TypeScript web app that accepts uploaded documents or pasted text, checks likely plagiarism through web-wide search, estimates AI-generated writing risk, and presents actionable reports.

**Architecture:** Use a Vite React client for the document-checking workspace and an Express TypeScript API for parsing files, chunking text, querying web search, scoring matches, and returning a structured report. The app will support large texts by chunking and limiting concurrent search requests instead of enforcing a word cap in the UI.

**Tech Stack:** TypeScript, React, Vite, Express, Multer, Mammoth, pdf-parse, Cheerio, Vitest, Testing Library, CSS modules via plain CSS.

---

## File Structure

- `package.json` - scripts, dependencies, and dev dependencies for the full-stack TypeScript app.
- `tsconfig.json` - shared TypeScript configuration.
- `vite.config.ts` - Vite React dev server plus `/api` proxy to Express.
- `index.html` - app shell and metadata.
- `src/shared/types.ts` - request and response types shared by client and server.
- `src/server/index.ts` - Express server, upload endpoint, report endpoint.
- `src/server/textExtraction.ts` - file-to-text parsing for `.txt`, `.md`, `.csv`, `.docx`, and `.pdf`.
- `src/server/chunking.ts` - deterministic chunking for unlimited-length inputs.
- `src/server/webSearch.ts` - DuckDuckGo HTML search adapter and candidate extraction.
- `src/server/scoring.ts` - plagiarism similarity scoring and AI-writing heuristics.
- `src/client/main.tsx` - React entry.
- `src/client/App.tsx` - primary application workflow.
- `src/client/styles.css` - production UI styling, responsive states, accessibility focus states.
- `src/client/App.test.tsx` - smoke tests for core UI states.
- `src/server/scoring.test.ts` - scoring tests.

## Tasks

### Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `index.html`

- [ ] Create the TypeScript/Vite/Express package configuration with scripts: `dev`, `dev:server`, `build`, `test`, `preview`.
- [ ] Add strict TypeScript settings and Vite proxy from `/api` to `http://localhost:8787`.
- [ ] Run: `npm install`.
- [ ] Run: `npm run build`.

### Task 2: Shared Report Contract

**Files:**
- Create: `src/shared/types.ts`

- [ ] Define `ScanRequest`, `ScanReport`, `PlagiarismMatch`, `AiSignal`, and `ScanSettings`.
- [ ] Keep the contract serializable so the browser and API can share it without adapters.
- [ ] Run: `npm run build`.

### Task 3: Server Text Pipeline

**Files:**
- Create: `src/server/textExtraction.ts`
- Create: `src/server/chunking.ts`
- Create: `src/server/index.ts`

- [ ] Implement upload parsing with Multer memory storage.
- [ ] Extract plain text from text-like files, DOCX via Mammoth, and PDF via pdf-parse.
- [ ] Add chunking by word count with overlap so long documents remain searchable.
- [ ] Expose `POST /api/extract` and `POST /api/scan`.
- [ ] Run: `npm run build`.

### Task 4: Search & Scoring

**Files:**
- Create: `src/server/webSearch.ts`
- Create: `src/server/scoring.ts`
- Create: `src/server/scoring.test.ts`

- [ ] Query DuckDuckGo HTML search for quoted chunk excerpts and parse result URLs, titles, and snippets.
- [ ] Score candidate snippets against source chunks with normalized token overlap and longest common word sequence.
- [ ] Estimate AI risk with transparent heuristics: sentence rhythm, lexical diversity, transition density, punctuation regularity, and hedging density.
- [ ] Add tests for plagiarism scoring and AI risk boundaries.
- [ ] Run: `npm test`.

### Task 5: Frontend Workspace

**Files:**
- Create: `src/client/main.tsx`
- Create: `src/client/App.tsx`
- Create: `src/client/styles.css`
- Create: `src/client/App.test.tsx`

- [ ] Build the first screen as the actual checker, not a landing page.
- [ ] Support paste input, file upload, settings, progress, result cards, source links, AI signals, and empty/error states.
- [ ] Use semantic controls, labels, focus-visible rings, skip link, aria-live progress, and keyboard-friendly actions.
- [ ] Add a smoke test confirming the checker renders.
- [ ] Run: `npm test`.

### Task 6: Design Review & Verification

**Files:**
- Modify: `src/client/App.tsx`
- Modify: `src/client/styles.css`

- [ ] Review UI against the fetched Web Interface Guidelines.
- [ ] Fix missing labels, focus states, content overflow, motion preferences, and typography issues.
- [ ] Start the dev server.
- [ ] Open the local app and verify the page renders.

## Self-Review

- Spec coverage: paste text, upload files, plagiarism search, AI detection, large text chunking, and full report UI are each mapped to tasks.
- Placeholder scan: no task depends on undefined files or “do later” placeholders.
- Type consistency: shared names are defined once in `src/shared/types.ts` and referenced by server and client.
