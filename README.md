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

Word formatting is retained for rich clipboard paste/copy. Humanized uploaded `.docx` files can be downloaded again as real OOXML documents while keeping the original package styles, tables, media, and layout metadata.

## Notes

The plagiarism check covers the whole document, searches multiple open-web providers, hydrates promising pages, and compares them with n-grams, winnowing fingerprints, longest runs, and a local full-text index. It does not claim to crawl or index the entire internet locally.

AI detection is a transparent segment-based heuristic ensemble with a separate optional LLM opinion. Neither value is a definitive authorship verdict.

`Match strength` is the strongest verified source match on a 0–100 scale. It is not the percentage of plagiarized words. `Verified verbatim coverage` separately unions exact matching word intervals across sources and overlapping chunks, divided by all words in the prepared document (after title/bibliography exclusions). It is a conservative lower bound; it does not measure paraphrases or undiscovered sources. Legacy reports without coverage display it as unavailable.

Humanization uses automatic style replacement rules. Before/after scores come from the same local detector, may increase, and do not prove text quality or authorship. The calibration corpus is small and synthetic, suitable for regression checks rather than real-world accuracy claims.

## Authentication and retention

- Production requires a random `JWT_SECRET` of at least 32 characters. Missing, short and example secrets prevent startup. Development without a configured secret uses a process-local random secret, so sessions reset on restart.
- Set `CLIENT_URL` to the public HTTPS frontend origin. Optional `AUTH_ALLOWED_ORIGINS` is a comma-separated list of additional exact HTTPS origins. OAuth uses only these return origins, a signed browser-bound state cookie, and the explicit `GOOGLE_REDIRECT_URI`; credentials are never returned in URLs.
- Login uses HTTP-only cookies (`Secure` in production). Old URL-token login is no longer accepted. Use HTTPS for public deployments and a stable secret shared by application instances.
- Account reports are private. UUID knowledge or a copied private URL does not grant access. Anonymous reports remain in bounded memory for up to 30 minutes; guest job polling also requires the submitting browser's cookie. Guest jobs are not durable across restarts or different instances; serverless scans return their results synchronously.
- Signed-in scans and imported browser reports are stored in account history, including matching excerpts and up to 100,000 source characters. Files remain until deletion; Redis/KV report copies expire after 30 days. Set `NEZBIG_DATA_DIR` to a durable private directory/volume for local or Docker deployments. Account credentials require durable file storage or configured Redis; ephemeral serverless files alone cannot provide durable password accounts.
- Deleting history deletes report payloads from files, process memory and configured remote stores, and clears account result caches. Completed account jobs store metadata rather than duplicated report content. Deletion errors are displayed so users can retry. Browser history is scoped by account; guest history is imported on login.
- Imported browser reports receive fresh server IDs, preventing client IDs from overwriting or claiming another account's report. Existing account history remains owner-gated, including legacy records associated with that account.
- Web search, optional Cohere reranking and optional AI opinion transmit document excerpts to external providers. Search-query caches can contain excerpts and have a separate lifetime from report history. See the in-app privacy policy for data handling details.

After upgrading, configure production secrets/origins before restart and sign in again if previous development sessions used the old fallback secret. Historical shared links now require the owner's account.

## Architecture

The Ukrainian diploma-style architecture description is available in [`docs/ARCHITECTURE_UA.md`](docs/ARCHITECTURE_UA.md).

## E2E Testing

Playwright is configured to store browser binaries on drive `D:` to save space on `C:`. 
To run tests locally, you must specify the `PLAYWRIGHT_BROWSERS_PATH` environment variable:

```powershell
$env:PLAYWRIGHT_BROWSERS_PATH="D:\playwright-browsers"; npx playwright test
```
