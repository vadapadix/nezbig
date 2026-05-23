import "dotenv/config";
import cors from "cors";
import express from "express";
import multer from "multer";
import { chunkText, countWords } from "./chunking.js";
import { prepareDocumentText } from "./documentPreprocess.js";
import { analyzeWithLlmProviders } from "./llmOpinion.js";
import { detectAiSignals, scoreCandidate, summarizeReport } from "./scoring.js";
import { extractTextFromUpload } from "./textExtraction.js";
import { hydrateSearchCandidates, searchWebCandidates } from "./webSearch.js";
import type { LlmOpinionRequest, PlagiarismMatch, ScanReport, ScanRequest, ScanSettings } from "../shared/types.js";

export const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }
});

const defaultSettings: ScanSettings = {
  maxChunks: 14,
  chunkWords: 120,
  overlapWords: 32,
  sensitivity: "balanced"
};

function sanitizeSettings(settings?: Partial<ScanSettings>): ScanSettings {
  const sensitivity = settings?.sensitivity ?? defaultSettings.sensitivity;
  const maxBySensitivity = sensitivity === "deep" ? 48 : sensitivity === "quick" ? 8 : 14;

  return {
    maxChunks: Math.min(Math.max(Number(settings?.maxChunks ?? maxBySensitivity), 1), 2000),
    chunkWords: Math.min(Math.max(Number(settings?.chunkWords ?? defaultSettings.chunkWords), 70), 520),
    overlapWords: Math.min(Math.max(Number(settings?.overlapWords ?? defaultSettings.overlapWords), 0), 180),
    sensitivity
  };
}

function fullCoverageSettings(settings: ScanSettings, wordCount: number): ScanSettings {
  const chunkWords =
    wordCount > 20000
      ? 520
      : wordCount > 10000
        ? 460
        : wordCount > 5000
          ? 380
          : wordCount > 2000
            ? Math.max(settings.chunkWords, 240)
            : settings.chunkWords;
  const overlapWords = Math.min(Math.floor(chunkWords * 0.18), Math.max(settings.overlapWords, wordCount > 5000 ? 56 : 32));
  const step = Math.max(60, chunkWords - overlapWords);
  const chunksNeeded = Math.max(1, Math.ceil(Math.max(1, wordCount - overlapWords) / step));

  return {
    ...settings,
    chunkWords,
    overlapWords,
    maxChunks: chunksNeeded
  };
}

function thresholdFor(settings: ScanSettings): number {
  if (settings.sensitivity === "quick") return 38;
  if (settings.sensitivity === "deep") return 24;
  return 32;
}

async function mapWithConcurrency<T, R>(items: T[], concurrency: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;

  async function runWorker(): Promise<void> {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => runWorker()));
  return results;
}

function uniqueMatches(matches: PlagiarismMatch[]): PlagiarismMatch[] {
  const bestByUrl = new Map<string, PlagiarismMatch>();
  for (const match of matches) {
    const key = `${match.url.replace(/#.*$/, "").replace(/\/$/, "")}:${match.chunkIndex}`;
    const current = bestByUrl.get(key);
    if (!current || match.score > current.score) bestByUrl.set(key, match);
  }
  return [...bestByUrl.values()];
}

type ChunkMatch = {
  chunkText: string;
  match: PlagiarismMatch;
};

async function runScan(request: ScanRequest): Promise<ScanReport> {
  const prepared = prepareDocumentText(request.text);
  const text = prepared.text;
  if (text.length < 120) {
    throw new Error("Додайте щонайменше 120 символів тексту для надійної перевірки.");
  }

  const wordCount = countWords(text);
  const settings = fullCoverageSettings(sanitizeSettings(request.settings), wordCount);
  const chunks = chunkText(text, settings.chunkWords, settings.overlapWords, settings.maxChunks);
  const longDocumentMode = wordCount > 2000 || chunks.length > 18;
  const veryLongDocumentMode = wordCount > 8000 || chunks.length > 45;
  const searchLimit = settings.sensitivity === "deep" ? (veryLongDocumentMode ? 5 : longDocumentMode ? 7 : 12) : veryLongDocumentMode ? 3 : longDocumentMode ? 4 : 8;
  const concurrency = veryLongDocumentMode ? 8 : settings.sensitivity === "deep" ? 4 : 5;
  const matchedByChunk = await mapWithConcurrency(chunks, concurrency, async (chunk) => {
    try {
      const candidates = await searchWebCandidates(chunk.text, searchLimit, settings.sensitivity === "deep", {
        hydrateLimit: longDocumentMode ? 0 : undefined,
        includeAcademic: settings.sensitivity === "deep" && !veryLongDocumentMode,
        queryLimit: veryLongDocumentMode ? 1 : longDocumentMode ? 2 : undefined
      });
      return candidates.map((candidate): ChunkMatch => ({ chunkText: chunk.text, match: scoreCandidate(chunk.text, candidate, chunk.index) }));
    } catch (error) {
      console.warn(error);
      return [];
    }
  });
  const preliminaryMatches = matchedByChunk.flat();
  const hydrationTargets = preliminaryMatches
    .filter(({ match }) => match.confidence === "snippet" && (match.score >= thresholdFor(settings) - 10 || match.longestRun >= 7))
    .sort((a, b) => b.match.score - a.match.score || b.match.longestRun - a.match.longestRun)
    .slice(0, veryLongDocumentMode ? 32 : longDocumentMode ? 48 : 80);
  const hydratedCandidates = await hydrateSearchCandidates(
    hydrationTargets.map(({ match }) => match),
    hydrationTargets.length
  );
  const hydratedMatches = hydratedCandidates.map((candidate, index) => scoreCandidate(hydrationTargets[index].chunkText, candidate, hydrationTargets[index].match.chunkIndex));
  const allMatches = [...preliminaryMatches.map(({ match }) => match), ...hydratedMatches];

  const matches = uniqueMatches(allMatches)
    .filter((match) => match.score >= thresholdFor(settings) || match.longestRun >= 10)
    .sort((a, b) => b.score - a.score || b.longestRun - a.longestRun)
    .slice(0, 24);

  const weightedTop = matches.slice(0, 8);
  const plagiarismScore =
    weightedTop.length === 0
      ? 0
      : Math.round(
          weightedTop.reduce((sum, match, index) => {
            const weight = Math.max(0.35, 1 - index * 0.08);
            return sum + match.score * weight;
          }, 0) / weightedTop.reduce((sum, _match, index) => sum + Math.max(0.35, 1 - index * 0.08), 0)
        );
  const localAi = detectAiSignals(text);
  const scanNotes = [...prepared.notes];
  if (longDocumentMode) {
    scanNotes.push(`Повне покриття: перевірено ${chunks.length} фрагментів, включно з кінцем документа.`);
    scanNotes.push("Для довгого тексту застосовано двофазний пошук: швидкий прохід по всіх фрагментах і точне дочитування найсильніших збігів.");
  }

  return {
    id: crypto.randomUUID(),
    fileName: request.fileName || "Вставлений текст",
    checkedAt: new Date().toISOString(),
    wordCount,
    chunksChecked: chunks.length,
    plagiarismScore,
    aiProbability: localAi.probability,
    aiProvider: "local",
    aiModel: undefined,
    aiNote: "Базовий звіт згенеровано локально. AI-думка підвантажується окремо після звіту.",
    scanNotes,
    skippedTitleWords: prepared.skippedTitleWords,
    matches,
    aiSignals: localAi.signals,
    summary: summarizeReport(plagiarismScore, localAi.probability, matches)
  };
}

app.use(cors());
app.use(express.json({ limit: "10mb" }));

app.get("/api/health", (_request, response) => {
  response.json({ ok: true, app: "nezbig" });
});

app.post("/api/extract", upload.single("file"), async (request, response) => {
  try {
    if (!request.file) {
      response.status(400).json({ error: "Додайте файл для обробки." });
      return;
    }
    response.json(await extractTextFromUpload(request.file));
  } catch (error) {
    response.status(400).json({ error: error instanceof Error ? error.message : "Не вдалося прочитати файл." });
  }
});

app.post("/api/scan", async (request, response) => {
  try {
    response.json(await runScan(request.body as ScanRequest));
  } catch (error) {
    response.status(400).json({ error: error instanceof Error ? error.message : "Не вдалося виконати перевірку." });
  }
});

app.post("/api/ai-opinion", async (request, response) => {
  try {
    const body = request.body as LlmOpinionRequest;
    const text = prepareDocumentText(body.text).text;
    if (text.length < 120) {
      response.status(400).json({ error: "Додайте щонайменше 120 символів тексту для AI-думки." });
      return;
    }

    const opinion = await analyzeWithLlmProviders(text, {
      probability: Number(body.localProbability) || 0,
      signals: Array.isArray(body.localSignals) ? body.localSignals : []
    });

    if (!opinion) {
      response.status(400).json({ error: "API-ключ або список AI-моделей не налаштовано." });
      return;
    }

    response.json(opinion);
  } catch (error) {
    response.status(502).json({ error: error instanceof Error ? error.message : "AI-думка недоступна." });
  }
});
