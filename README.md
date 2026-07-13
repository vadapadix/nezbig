# AntiPlug Text Forensics

TypeScript web app for checking pasted text or uploaded documents for likely plagiarism and AI-writing signals.

## Run Locally

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:5173/`.

The React client runs on port `5173`; the Express API runs on `8787`.

## Supported Inputs

- Pasted text
- `.txt`, `.md`, `.csv`, `.json`, `.rtf`
- `.docx`
- `.pdf`

## Notes

The plagiarism check covers the whole document, searches multiple open-web providers, hydrates promising pages, and compares them with n-grams, winnowing fingerprints, longest runs, and a local full-text index. It does not claim to crawl or index the entire internet locally.

AI detection is a transparent segment-based heuristic ensemble with a separate optional LLM opinion. Neither value is a definitive authorship verdict.

## Architecture

The Ukrainian diploma-style architecture description is available in [`docs/ARCHITECTURE_UA.md`](docs/ARCHITECTURE_UA.md).
