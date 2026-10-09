import "dotenv/config";
import crypto from "crypto";
import helmet from "helmet";
import cors from "cors";
import express from "express";
import cookieParser from "cookie-parser";
import multer from "multer";
import pino from "pino";
import * as diff from "diff";
import { rateLimit } from "express-rate-limit";
import { ScanRequestSchema, ScanSettingsSchema, LlmOpinionRequestSchema, HumanizeRequestSchema } from "../shared/validation.js";
import { saveReport, getReport } from "./db.js";
import { scanJobCache, reportCache } from "./jobStore.js";
import { chunkText, countWords } from "./chunking.js";
import { prepareDocumentText } from "./documentPreprocess.js";
import { mergeRevisedTextIntoHtml } from "./formattedDocument.js";
import { mergeRevisedTextIntoDocx } from "./formattedDocx.js";
import { humanizeText } from "./humanizer.js";
import { analyzeWithLlmProviders } from "./llmOpinion.js";
import { emptySearchDiagnostics, mergeSearchDiagnostics, searchDiagnosticsNotes } from "./searchDiagnostics.js";
import { calculateConfirmedPlagiarismScore, scoreCandidate, detectAiSignals, summarizeReport, rerankCandidates } from "./scoring.js";
import { isAcademicBoilerplate } from "./plagiarismScoring.js";
import { decodeUploadFileName, extractTextFromUpload } from "./textExtraction.js";
import { hydrateSearchCandidatesDetailed, searchWebCandidatesDetailed } from "./webSearch.js";
import { authMiddleware, saveUserReport } from "./auth.js";
import { authRouter } from "./authRoutes.js";
import { historyRouter } from "./historyRoutes.js";
import type { FileEvidence, LlmOpinion, PlagiarismMatch, ScanReport, ScanRequest, ScanSettings, SearchDiagnostics } from "../shared/types.js";

export const app = express();

async function persistLlmOpinion(reportId: string | undefined, opinion: LlmOpinion): Promise<void> {
  if (!reportId) return;
  try {
    const stored = await getReport(reportId);
    if (!stored) return;
    await saveReport(reportId, {
      ...stored,
      aiOpinionProbability: opinion.aiProbability,
      aiOpinionModel: opinion.aiModel,
      aiOpinionNote: opinion.aiNote,
      aiOpinionSignals: opinion.aiSignals,
      aiOpinionError: undefined
    });
  } catch (error) {
    logger.warn(error);
  }
}
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https:", "http:"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https:"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "https:", "data:"],
      imgSrc: ["'self'", "data:", "blob:", "https:", "http:"],
      connectSrc: ["'self'", "https:", "http:"],
      frameSrc: ["'self'", "https:", "http:"],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'", "https://accounts.google.com"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));
app.set("trust proxy", 1);

const logger = pino({ level: process.env.LOG_LEVEL || "info" });

app.use(
  cors({
    origin: process.env.CLIENT_URL ?? "http://localhost:5173",
    methods: ["POST", "GET"],
    credentials: true,
  })
);
app.use(cookieParser());
app.use(express.json({ limit: "10mb" }));
app.use(authMiddleware);

// Auth and History routes
app.use("/api/auth", authRouter);
app.use("/api/history", historyRouter);

const scanLimiter = rateLimit({ windowMs: 60 * 1000, max: 10, message: { error: "Забагато запитів" } });
const fileLimiter = rateLimit({ windowMs: 60 * 1000, max: 5, message: { error: "Забагато запитів з файлами" } });
const feedbackLimiter = rateLimit({ windowMs: 60 * 1000, max: 3, message: { error: "Забагато повідомлень" } });

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

function sanitizeSettings(settings?: unknown): ScanSettings {
  const parsed = ScanSettingsSchema.safeParse(settings);
  const safeSettings = parsed.success && parsed.data ? parsed.data : {};
  const sensitivity = safeSettings.sensitivity ?? defaultSettings.sensitivity;
  const maxBySensitivity = sensitivity === "deep" ? 48 : sensitivity === "quick" ? 8 : 14;

  return {
    maxChunks: Math.min(Math.max(Number(safeSettings.maxChunks ?? maxBySensitivity), 1), 2000),
    chunkWords: Math.min(Math.max(Number(safeSettings.chunkWords ?? defaultSettings.chunkWords), 70), 520),
    overlapWords: Math.min(Math.max(Number(safeSettings.overlapWords ?? defaultSettings.overlapWords), 0), 180),
    sensitivity
  };
}

function fullCoverageSettings(settings: ScanSettings, wordCount: number): ScanSettings {
  const chunkWords = wordCount > 20000 ? 520 : wordCount > 10000 ? 460 : wordCount > 5000 ? 380 : wordCount > 2000 ? Math.max(settings.chunkWords, 240) : settings.chunkWords;
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
  if (settings.sensitivity === "quick") return 32;
  if (settings.sensitivity === "deep") return 20;
  return 24;
}

function isValidPlagiarismMatch(match: PlagiarismMatch, settings: ScanSettings): boolean {
  const threshold = thresholdFor(settings);
  const evidence = match.submittedEvidence || match.sourceEvidence || "";
  const isBoilerplate = evidence ? isAcademicBoilerplate(evidence) : false;

  // Academic boilerplate (e.g. ministerial titles, introductory formulas, conference names)
  // must have substantial overall document match to not be discarded as academic clichés.
  if (isBoilerplate) {
    return match.score >= 35 && match.overlapPercent >= 35;
  }

  // 1. Verbatim continuous match: at least 9 consecutive words
  if (match.longestRun >= 9) {
    return true;
  }

  // 2. High overlap with solid score and phrase match
  if (match.score >= threshold && match.overlapPercent >= 24) {
    if (match.ngramOverlapPercent >= 16 || match.longestRun >= 6) {
      return true;
    }
  }

  // 3. Hydrated full page with verified high overlap
  if (match.confidence === "page" && match.score >= threshold && match.overlapPercent >= 28) {
    return true;
  }

  return false;
}

async function mapWithConcurrency<T, R>(items: T[], concurrency: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;

  async function runWorker(): Promise<void> {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index] as T);
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

type ChunkSearchResult = {
  matches: ChunkMatch[];
  diagnostics: SearchDiagnostics;
};

async function runScan(request: ScanRequest, fileEvidence?: FileEvidence, onProgress?: (checked: number, total: number) => void): Promise<ScanReport> {
  const prepared = prepareDocumentText(request.text);
  const text = prepared.text;
  const wordCount = countWords(text);
  if (wordCount < 25) {
    throw new Error("Додайте щонайменше 25 слів тексту для надійної перевірки.");
  }

  const settings = fullCoverageSettings(sanitizeSettings(request.settings), wordCount);
  const chunks = chunkText(text, settings.chunkWords, settings.overlapWords, settings.maxChunks);
  const longDocumentMode = wordCount > 2000 || chunks.length > 18;
  const veryLongDocumentMode = wordCount > 8000 || chunks.length > 45;
  const searchLimit = settings.sensitivity === "deep" ? (veryLongDocumentMode ? 5 : longDocumentMode ? 7 : 12) : veryLongDocumentMode ? 3 : longDocumentMode ? 4 : 8;
  const concurrency = veryLongDocumentMode ? 8 : settings.sensitivity === "deep" ? 4 : 5;
  const matchedByChunk = await mapWithConcurrency(chunks, concurrency, async (chunk): Promise<ChunkSearchResult> => {
    try {
      const search = await searchWebCandidatesDetailed(chunk.text, searchLimit, settings.sensitivity === "deep", {
        hydrateLimit: longDocumentMode ? 0 : undefined,
        includeAcademic: settings.sensitivity === "deep" && !veryLongDocumentMode,
        queryLimit: veryLongDocumentMode ? 1 : longDocumentMode ? 2 : undefined
      });
      let candidates = search.candidates;
      try {
        candidates = await rerankCandidates(chunk.text, candidates);
      } catch (rerankError) {
        logger.warn({ err: rerankError }, "Semantic reranking failed; falling back to raw candidates");
      }
      return {
        matches: candidates.map((candidate): ChunkMatch => ({ chunkText: chunk.text, match: scoreCandidate(chunk.text, candidate, chunk.index) })),
        diagnostics: search.diagnostics
      };
    } catch (error) {
      logger.warn(error);
      const diagnostics = emptySearchDiagnostics();
      diagnostics.providers.push({ provider: "Пошуковий pipeline", attempted: 1, succeeded: 0, failed: 1, timedOut: 0, results: 0 });
      return { matches: [], diagnostics };
    } finally {
      if (onProgress) {
        onProgress(chunk.index + 1, chunks.length);
      }
    }
  });
  const preliminaryMatches = matchedByChunk.flatMap((result) => result.matches);
  let searchDiagnostics = mergeSearchDiagnostics(...matchedByChunk.map((result) => result.diagnostics));
  const hydrationTargets = preliminaryMatches
    .filter(({ match }) => match.confidence === "snippet" && (match.score >= Math.max(12, thresholdFor(settings) - 6) || match.longestRun >= 4 || match.overlapPercent >= 20))
    .sort((a, b) => b.match.score - a.match.score || b.match.longestRun - a.match.longestRun)
    .slice(0, veryLongDocumentMode ? 32 : longDocumentMode ? 48 : 80);
  const hydration = await hydrateSearchCandidatesDetailed(
    hydrationTargets.map(({ match }) => match),
    hydrationTargets.length
  );
  searchDiagnostics = mergeSearchDiagnostics(searchDiagnostics, hydration.diagnostics);
  const hydratedMatches = hydration.candidates.map((candidate, index) => scoreCandidate(hydrationTargets[index]!.chunkText, candidate, hydrationTargets[index]!.match.chunkIndex));
  const allMatches = [...preliminaryMatches.map(({ match }) => match), ...hydratedMatches];

  const matches = uniqueMatches(allMatches)
    .filter((match) => isValidPlagiarismMatch(match, settings))
    .sort((a, b) => b.score - a.score || b.longestRun - a.longestRun)
    .slice(0, 24);

  const plagiarismScore = calculateConfirmedPlagiarismScore(matches);
  const localAi = detectAiSignals(text);
  const scanNotes = [...prepared.notes];
  if (fileEvidence) {
    const sizeKb = Math.max(1, Math.round(fileEvidence.sizeBytes / 1024));
    scanNotes.push(`Файл перевірено напряму: ${fileEvidence.fileName}, ${sizeKb} KB, метод ${fileEvidence.extractionMethod}, витягнуто ${fileEvidence.extractedWordCount} слів.`);
  }
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
    aiVerdict: localAi.verdict,
    aiReliability: localAi.reliability,
    aiLanguage: localAi.language,
    aiExclusions: localAi.exclusions,
    aiSuspiciousSegments: localAi.suspiciousSegments,
    aiProvider: "local",
    aiModel: undefined,
    aiNote: "Базовий звіт згенеровано локально. AI-думка підвантажується окремо після звіту.",
    scanNotes,
    searchDiagnostics,
    skippedTitleWords: prepared.skippedTitleWords,
    skippedBibliographyWords: prepared.skippedBibliographyWords,
    fileEvidence,
    matches,
    aiSignals: localAi.signals,
    summary: summarizeReport(plagiarismScore, localAi.probability, matches, searchDiagnostics, localAi.verdict),
    sourceText: request.text.slice(0, 100000)
  };
}

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

app.post("/api/feedback", feedbackLimiter, async (request, response) => {
  try {
    const { text, page } = request.body;
    logger.info({ feedback: text, page }, "User feedback");
    response.json({ ok: true });
  } catch {
    response.status(500).json({ error: "Failed to send feedback" });
  }
});

app.post("/api/scan", scanLimiter, async (request, response) => {
  try {
    const parsed = ScanRequestSchema.parse(request.body);
    const report = await runScan(parsed as unknown as ScanRequest);
    await saveReport(report.id, report);
    if (request.user?.id) {
      await saveUserReport(request.user.id, report.id);
    }
    response.json(report);
  } catch (error) {
    response.status(400).json({ error: error instanceof Error ? error.message : "Не вдалося виконати перевірку." });
  }
});

app.post("/api/scan/jobs", scanLimiter, async (request, response) => {
  try {
    const parsed = ScanRequestSchema.parse(request.body);
    const settings = sanitizeSettings(parsed.settings);
    const userId = request.user?.id;
    
    const textHash = crypto.createHash("sha256").update(parsed.text).digest("hex");
    const reportKey = `${textHash}:${settings.sensitivity}`;
    const cached = await reportCache.get(reportKey);
    
    if (cached) {
      if (userId) await saveUserReport(userId, cached.id);
      response.json({ jobId: cached.id, status: "completed", result: cached });
      return;
    }

    const jobId = crypto.randomUUID();

    if (process.env.VERCEL === "1") {
      const report = await runScan(parsed as unknown as ScanRequest);
      await saveReport(report.id, report);
      if (userId) await saveUserReport(userId, report.id);
      response.json({ jobId: jobId, status: "completed", result: report });
      return;
    }

    await scanJobCache.set(jobId, { id: jobId, status: "pending", createdAt: new Date().toISOString() });

    Promise.resolve().then(async () => {
      try {
        await scanJobCache.set(jobId, { id: jobId, status: "processing", createdAt: new Date().toISOString() });
        const report = await runScan(parsed as unknown as ScanRequest, undefined, (checked, total) => {
          scanJobCache.set(jobId, { id: jobId, status: "processing", progress: { chunksChecked: checked, totalChunks: total }, createdAt: new Date().toISOString() }).catch(() => {});
        });
        
        await saveReport(report.id, report);
        await reportCache.set(reportKey, report);
        if (userId) await saveUserReport(userId, report.id);
        
        await scanJobCache.set(jobId, { id: jobId, status: "completed", result: report, createdAt: new Date().toISOString() }, 1000 * 60 * 30);
      } catch (error) {
        logger.error(error);
        await scanJobCache.set(jobId, { id: jobId, status: "error", error: error instanceof Error ? error.message : "Помилка при перевірці", createdAt: new Date().toISOString() }, 1000 * 60 * 10);
      }
    });

    response.json({ jobId });
  } catch (error) {
    response.status(400).json({ error: error instanceof Error ? error.message : "Не вдалося запустити перевірку." });
  }
});

app.get("/api/scan-status/:jobId", async (request, response) => {
  try {
    const job = await scanJobCache.get(request.params.jobId);
    if (!job) {
      response.status(404).json({ error: "Завдання не знайдено" });
      return;
    }
    
    // Stale job detection (10 minutes)
    const createdAt = new Date(job.createdAt).getTime();
    if (job.status === "processing" && Date.now() - createdAt > 1000 * 60 * 10) {
      response.json({ ...job, status: "error", error: "Перевірка перервалась через таймаут сервера." });
      return;
    }
    
    response.json(job);
  } catch {
    response.status(500).json({ error: "Помилка сервера" });
  }
});

app.post("/api/scan-file", fileLimiter, upload.single("file"), async (request, response) => {
  try {
    if (!request.file) {
      response.status(400).json({ error: "Додайте файл для перевірки." });
      return;
    }

    const extracted = await extractTextFromUpload(request.file);
    const rawSettings = typeof request.body.settings === "string" ? JSON.parse(request.body.settings) : request.body.settings;
    const settings = ScanSettingsSchema.parse(rawSettings);
    response.json(await runScan({ text: extracted.text, fileName: extracted.fileName, settings: settings as ScanSettings }, extracted.fileEvidence));
  } catch (error) {
    response.status(400).json({ error: error instanceof Error ? error.message : "Не вдалося виконати файлову перевірку." });
  }
});

app.post("/api/scan-file/jobs", fileLimiter, upload.single("file"), async (request, response) => {
  try {
    if (!request.file) {
      response.status(400).json({ error: "Додайте файл для перевірки." });
      return;
    }
    const extracted = await extractTextFromUpload(request.file);
    const rawSettings = typeof request.body.settings === "string" ? JSON.parse(request.body.settings) : request.body.settings;
    const settings = ScanSettingsSchema.parse(rawSettings) as ScanSettings;
    const parsed = { text: extracted.text, fileName: extracted.fileName, settings };
    const userId = request.user?.id;

    const textHash = crypto.createHash("sha256").update(parsed.text).digest("hex");
    const reportKey = `${textHash}:${settings.sensitivity}`;
    const cached = await reportCache.get(reportKey);
    
    if (cached) {
      if (userId) await saveUserReport(userId, cached.id);
      response.json({ jobId: cached.id, status: "completed", result: cached });
      return;
    }

    const jobId = crypto.randomUUID();

    if (process.env.VERCEL === "1") {
      const report = await runScan(parsed, extracted.fileEvidence);
      await saveReport(report.id, report);
      if (userId) await saveUserReport(userId, report.id);
      response.json({ jobId: jobId, status: "completed", result: report });
      return;
    }

    await scanJobCache.set(jobId, { id: jobId, status: "pending", createdAt: new Date().toISOString() });

    Promise.resolve().then(async () => {
      try {
        await scanJobCache.set(jobId, { id: jobId, status: "processing", createdAt: new Date().toISOString() });
        const report = await runScan(parsed, extracted.fileEvidence, (checked, total) => {
          scanJobCache.set(jobId, { id: jobId, status: "processing", progress: { chunksChecked: checked, totalChunks: total }, createdAt: new Date().toISOString() }).catch(() => {});
        });
        
        await saveReport(report.id, report);
        await reportCache.set(reportKey, report);
        if (userId) await saveUserReport(userId, report.id);
        
        await scanJobCache.set(jobId, { id: jobId, status: "completed", result: report, createdAt: new Date().toISOString() }, 1000 * 60 * 30);
      } catch (error) {
        logger.error(error);
        await scanJobCache.set(jobId, { id: jobId, status: "error", error: error instanceof Error ? error.message : "Помилка при перевірці", createdAt: new Date().toISOString() }, 1000 * 60 * 10);
      }
    });

    response.json({ jobId });
  } catch (error) {
    response.status(400).json({ error: error instanceof Error ? error.message : "Не вдалося запустити файлову перевірку." });
  }
});

app.post("/api/ai-opinion", scanLimiter, async (request, response) => {
  try {
    const body = LlmOpinionRequestSchema.parse(request.body);
    const text = prepareDocumentText(body.text).text;
    const wordCount = countWords(text);
    if (wordCount < 25) {
      response.status(400).json({ error: "Додайте щонайменше 25 слів тексту для AI-думки." });
      return;
    }

    const opinion = await analyzeWithLlmProviders(text, {
      probability: Number(body.localProbability) || 0,
      signals: Array.isArray(body.localSignals) ? body.localSignals : [],
      suspiciousExcerpts: Array.isArray(body.suspiciousExcerpts) ? body.suspiciousExcerpts : []
    });

    if (!opinion) {
      response.status(400).json({ error: "API-ключ або список AI-моделей не налаштовано." });
      return;
    }

    await persistLlmOpinion(body.reportId, opinion);
    response.json(opinion);
  } catch (error) {
    response.status(502).json({ error: error instanceof Error ? error.message : "AI-думка недоступна." });
  }
});

app.post("/api/ai-opinion-file", fileLimiter, upload.single("file"), async (request, response) => {
  try {
    if (!request.file) {
      response.status(400).json({ error: "Додайте файл для AI-думки." });
      return;
    }

    const extracted = await extractTextFromUpload(request.file);
    const text = prepareDocumentText(extracted.text).text;
    const wordCount = countWords(text);
    if (wordCount < 25) {
      response.status(400).json({ error: "Файл має містити щонайменше 25 слів тексту для AI-думки." });
      return;
    }

    const localSignals = typeof request.body.localSignals === "string" ? JSON.parse(request.body.localSignals) : [];
    const rawExcerpts = typeof request.body.suspiciousExcerpts === "string" ? JSON.parse(request.body.suspiciousExcerpts) : [];
    const reportId = typeof request.body.reportId === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(request.body.reportId) ? request.body.reportId : undefined;
    const opinion = await analyzeWithLlmProviders(text, {
      probability: Number(request.body.localProbability) || 0,
      signals: Array.isArray(localSignals) ? localSignals : [],
      suspiciousExcerpts: Array.isArray(rawExcerpts) ? rawExcerpts.filter((item): item is string => typeof item === "string").slice(0, 8) : []
    });

    if (!opinion) {
      response.status(400).json({ error: "API-ключ або список AI-моделей не налаштовано." });
      return;
    }

    await persistLlmOpinion(reportId, opinion);
    response.json(opinion);
  } catch (error) {
    response.status(502).json({ error: error instanceof Error ? error.message : "AI-думка для файлу недоступна." });
  }
});

app.post("/api/humanize", scanLimiter, async (request, response) => {
  try {
    const body = HumanizeRequestSchema.parse(request.body);
    const result = humanizeText(body.text, body.mode);
    response.json({
      ...result,
      revisedHtml: body.html?.trim() ? mergeRevisedTextIntoHtml(body.html, result.revisedText) : undefined
    });
  } catch (error) {
    response.status(400).json({ error: error instanceof Error ? error.message : "Не вдалося олюднити текст." });
  }
});

app.post("/api/humanize-file", fileLimiter, upload.single("file"), async (request, response) => {
  try {
    if (!request.file) {
      response.status(400).json({ error: "Додайте файл для олюднення." });
      return;
    }

    const mode = request.body?.mode === "natural" || request.body?.mode === "concise" ? request.body.mode : "academic";
    const extracted = await extractTextFromUpload(request.file);
    const result = humanizeText(extracted.text, mode);
    response.json({
      ...result,
      revisedHtml: extracted.html ? mergeRevisedTextIntoHtml(extracted.html, result.revisedText) : undefined,
      notes: [
        `Файл прочитано напряму: ${extracted.fileName}.`,
        extracted.html ? "Абзаци, списки, таблиці та інлайн-форматування Word збережено у відредагованій версії." : "Для цього формату доступне лише текстове представлення.",
        ...result.notes
      ]
    });
  } catch (error) {
    response.status(400).json({ error: error instanceof Error ? error.message : "Не вдалося олюднити файл." });
  }
});

app.post("/api/diff", scanLimiter, async (request, response) => {
  try {
    const { original, modified } = request.body;
    if (typeof original !== "string" || typeof modified !== "string") {
      response.status(400).json({ error: "Очікуються рядки original та modified." });
      return;
    }
    
    // Захист від надто великих текстів, що можуть повісити diff (до ~50k символів)
    if (original.length > 50000 || modified.length > 50000) {
      response.status(400).json({ error: "Текст занадто великий для швидкого порівняння (ліміт 50 000 символів)." });
      return;
    }

    const diffResult = diff.diffWordsWithSpace(original, modified);
    response.json(diffResult);
  } catch {
    response.status(500).json({ error: "Помилка при порівнянні текстів." });
  }
});

app.post("/api/export-docx", fileLimiter, upload.single("file"), async (request, response) => {
  try {
    if (!request.file) {
      response.status(400).json({ error: "Додайте вихідний DOCX-файл." });
      return;
    }

    const fileName = decodeUploadFileName(request.file.originalname);
    if (!/\.docx$/i.test(fileName)) {
      response.status(400).json({ error: "Точне збереження форматування доступне для DOCX-файлів." });
      return;
    }

    const revisedText = typeof request.body.revisedText === "string" ? request.body.revisedText : "";
    if (!revisedText.trim()) {
      response.status(400).json({ error: "Відредагований текст порожній." });
      return;
    }

    const output = await mergeRevisedTextIntoDocx(request.file.buffer, revisedText);
    const baseName = fileName.replace(/\.docx$/i, "").trim() || "nezbig-document";
    const outputName = `${baseName}-edited.docx`;
    response.type("application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    response.setHeader("Content-Disposition", `attachment; filename="nezbig-edited.docx"; filename*=UTF-8''${encodeURIComponent(outputName)}`);
    response.send(output);
  } catch (error) {
    response.status(400).json({ error: error instanceof Error ? error.message : "Не вдалося зібрати відредагований DOCX." });
  }
});

// Serve frontend in production (Docker / Local deployment)
if (process.env.NODE_ENV === "production" && !process.env.VERCEL) {
  const path = await import("path");
  const { fileURLToPath } = await import("url");
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const distPath = path.resolve(__dirname, "../../dist");
  
  app.use(express.static(distPath));
  
  // SPA fallback
  app.use((req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
}
