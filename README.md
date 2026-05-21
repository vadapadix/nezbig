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

The plagiarism check performs web-wide search queries over document chunks and scores snippets returned by search results. It does not claim to crawl or index the entire internet locally. AI detection is a transparent heuristic estimate, not a definitive authorship verdict.
