import "dotenv/config";
import cors from "cors";
import express from "express";
import multer from "multer";
import { chunkText, countWords, normalizeWhitespace } from "./chunking.js";
import { analyzeWithOpenRouter } from "./openrouterAi.js";
import { detectAiSignals, scoreCandidate, summarizeReport } from "./scoring.js";
import { extractTextFromUpload } from "./textExtraction.js";
import { searchWebCandidates } from "./webSearch.js";
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
    maxChunks: Math.min(Math.max(Number(settings?.maxChunks ?? maxBySensitivity), 1), 80),
    chunkWords: Math.min(Math.max(Number(settings?.chunkWords ?? defaultSettings.chunkWords), 70), 260),
    overlapWords: Math.min(Math.max(Number(settings?.overlapWords ?? defaultSettings.overlapWords), 0), 120),
    sensitivity
  };
}

function thresholdFor(settings: ScanSettings): number {
  if (settings.sensitivity === "quick") return 38;
  if (settings.sensitivity === "deep") return 24;
  return 32;
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

async function runScan(request: ScanRequest): Promise<ScanReport> {
  const text = normalizeWhitespace(request.text);
  if (text.length < 120) {
    throw new Error("Додайте щонайменше 120 символів тексту для надійної перевірки.");
  }

  const settings = sanitizeSettings(request.settings);
  const chunks = chunkText(text, settings.chunkWords, settings.overlapWords, settings.maxChunks);
  const allMatches: PlagiarismMatch[] = [];

  for (const chunk of chunks) {
    try {
      const candidates = await searchWebCandidates(chunk.text, settings.sensitivity === "deep" ? 12 : 8, settings.sensitivity === "deep");
      allMatches.push(...candidates.map((candidate) => scoreCandidate(chunk.text, candidate, chunk.index)));
    } catch (error) {
      console.warn(error);
    }
  }

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

  return {
    id: crypto.randomUUID(),
    fileName: request.fileName || "Вставлений текст",
    checkedAt: new Date().toISOString(),
    wordCount: countWords(text),
    chunksChecked: chunks.length,
    plagiarismScore,
    aiProbability: localAi.probability,
    aiProvider: "local",
    aiModel: undefined,
    aiNote: "Базовий звіт згенеровано локально. AI-думка підвантажується окремо після звіту.",
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
    const text = normalizeWhitespace(body.text);
    if (text.length < 120) {
      response.status(400).json({ error: "Додайте щонайменше 120 символів тексту для AI-думки." });
      return;
    }

    const opinion = await analyzeWithOpenRouter(text, {
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
