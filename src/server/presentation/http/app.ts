import { humanizationRouter } from "./routes/humanizationRoutes.js";
import { scanLimiter, fileLimiter, feedbackLimiter, upload } from "./middleware/requestLimits.js";
import { scanService } from "../../composition/scanning.js";
import { sanitizeSettings } from "../../domain/analysis/scanPolicy.js";

import "dotenv/config";
import crypto from "crypto";
import helmet from "helmet";
import cors from "cors";
import express, { type Request, type Response } from "express";
import cookieParser from "cookie-parser";

import pino from "pino";

import { ScanRequestSchema, ScanSettingsSchema, LlmOpinionRequestSchema } from "../../../shared/validation/schemas.js";
import { reports } from "../../composition/reports.js";
import { scanJobCache, reportCache, reportCacheKey } from "../../infrastructure/cache/jobStore.js";
import { scanPrincipal } from "./auth/guestSession.js";
import { clientOrigins } from "../../infrastructure/config/clientOrigins.js";

import { countWords } from "../../domain/analysis/chunking.js";
import { prepareDocumentText } from "../../domain/analysis/documentPreprocess.js";

import { assessmentService } from "../../composition/ai.js";

import { extractTextFromUpload } from "../../infrastructure/documents/textExtraction.js";

import { authentication } from "./middleware/authentication.js";
import { sessionCookie, tokens } from "../../composition/auth.js";

import { authRouter } from "./routes/authRoutes.js";
import { historyRouter } from "./routes/historyRoutes.js";
import type { FileEvidence, LlmOpinion, ScanReport, ScanRequest, ScanSettings } from "../../../shared/types/index.js";

export const app = express();

async function persistLlmOpinion(reportId: string | undefined, opinion: LlmOpinion, userId?: string): Promise<void> {
  if (!reportId || !userId) return;
  try {
    await reports.updateOwnedReport(userId, reportId, {
      aiOpinionProbability: opinion.aiProbability,
      aiOpinionModel: opinion.aiModel,
      aiOpinionNote: opinion.aiNote,
      aiOpinionVerdict: opinion.aiVerdictText,
      aiOpinionSignals: opinion.aiSignals,
      aiOpinionError: undefined
    });
  } catch (error) {
    logger.warn(error);
  }
}
app.use(
  helmet({
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
        formAction: ["'self'", "https://accounts.google.com"]
      }
    },
    crossOriginEmbedderPolicy: false
  })
);
app.set("trust proxy", 1);

const logger = pino({ level: process.env.LOG_LEVEL || "info" });

app.use(
  cors({
    origin: clientOrigins(),
    methods: ["POST", "GET", "DELETE", "OPTIONS"],
    credentials: true
  })
);
app.use(cookieParser());
app.use(express.json({ limit: "10mb" }));
app.use("/api", (_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});
app.use(authentication(tokens, sessionCookie));

// Auth and History routes
app.use("/api/auth", authRouter);
app.use("/api/history", historyRouter);

async function saveAccountReport(report: ScanReport, userId?: string): Promise<void> {
  if (!userId) return;
  await reports.saveReport(report.id, report, userId);
  await reports.saveUserReport(userId, report.id);
}

// Reuse computation only within one principal and with every input included in the key.
// Each submission still gets its own report identity and current metadata.
async function submitScan(req: Request, res: Response, input: ScanRequest, evidence?: FileEvidence): Promise<void> {
  const principal = scanPrincipal(req, res);
  const userId = req.user?.id;
  const settings = sanitizeSettings(input.settings);
  const key = reportCacheKey(principal, { text: input.text, fileName: input.fileName || "Вставлений текст", settings, evidence: evidence ?? null, version: 6 });
  const candidate = reportCache.get(key);
  const cached = candidate && (!userId || (await reports.getOwnedReport(userId, candidate.id))) ? candidate : undefined;
  if (cached) {
    const report = { ...cached, id: crypto.randomUUID(), checkedAt: new Date().toISOString() };
    await saveAccountReport(report, userId);
    res.json({ jobId: report.id, status: "completed", result: report });
    return;
  }
  if (process.env.VERCEL === "1") {
    const report = await scanService.scan(input, evidence);
    await saveAccountReport(report, userId);
    reportCache.set(key, report);
    res.json({ jobId: report.id, status: "completed", result: report });
    return;
  }
  const jobId = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  await scanJobCache.set(jobId, { id: jobId, principal, status: "pending", createdAt });
  void (async () => {
    try {
      await scanJobCache.set(jobId, { id: jobId, principal, status: "processing", createdAt });
      const report = await scanService.scan(input, evidence, (checked, total) => {
        void scanJobCache
          .set(jobId, { id: jobId, principal, status: "processing", progress: { chunksChecked: checked, totalChunks: total }, createdAt })
          .catch((error) => logger.warn(error));
      });
      await saveAccountReport(report, userId);
      reportCache.set(key, report);
      await scanJobCache.set(jobId, { id: jobId, principal, status: "completed", result: report, createdAt });
    } catch (error) {
      logger.error(error);
      await scanJobCache.set(jobId, { id: jobId, principal, status: "error", error: error instanceof Error ? error.message : "Помилка при перевірці", createdAt });
    }
  })().catch((error) => logger.error(error));
  res.json({ jobId });
}

async function canUpdateOpinion(req: Request, res: Response, reportId?: string): Promise<boolean> {
  if (!reportId) return true;
  const existing = await reports.getReport(reportId);
  // Unsaved guest/local reports can receive a response, but are never persisted by this endpoint.
  if (!existing) return true;
  if (req.user && (await reports.getOwnedReport(req.user.id, reportId))) return true;
  res.status(404).json({ error: "Звіт не знайдено." });
  return false;
}

app.get("/api/health", (_request, response) => {
  response.json({ ok: true, app: "nezbig" });
});

app.post("/api/extract", fileLimiter, upload.single("file"), async (request, response) => {
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
    const report = await scanService.scan(parsed as unknown as ScanRequest);
    await saveAccountReport(report, request.user?.id);
    response.json(report);
  } catch (error) {
    response.status(400).json({ error: error instanceof Error ? error.message : "Не вдалося виконати перевірку." });
  }
});

app.post("/api/scan/jobs", scanLimiter, async (request, response) => {
  try {
    const parsed = ScanRequestSchema.parse(request.body);
    await submitScan(request, response, parsed as ScanRequest);
  } catch (error) {
    response.status(400).json({ error: error instanceof Error ? error.message : "Не вдалося запустити перевірку." });
  }
});

app.get("/api/scan-status/:jobId", async (request, response) => {
  try {
    const job = await scanJobCache.get(request.params.jobId);
    if (!job || job.principal !== scanPrincipal(request, response)) {
      response.status(404).json({ error: "Завдання не знайдено" });
      return;
    }

    // Stale job detection (10 minutes)
    const createdAt = new Date(job.createdAt).getTime();
    if (job.status === "processing" && Date.now() - createdAt > 1000 * 60 * 10) {
      response.json({ ...job, status: "error", error: "Перевірка перервалась через таймаут сервера." });
      return;
    }

    const result = job.reportId && request.user ? await reports.getOwnedReport(request.user.id, job.reportId) : job.result;
    if (job.status === "completed" && !result) {
      response.status(404).json({ error: "Звіт видалено або недоступний." });
      return;
    }
    const { principal: _principal, ...publicJob } = job;
    response.setHeader("Cache-Control", "no-store");
    response.json({ ...publicJob, result });
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
    const report = await scanService.scan({ text: extracted.text, fileName: extracted.fileName, settings: settings as ScanSettings }, extracted.fileEvidence);
    await saveAccountReport(report, request.user?.id);
    response.json(report);
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
    const settings = sanitizeSettings(ScanSettingsSchema.parse(rawSettings));
    await submitScan(request, response, { text: extracted.text, fileName: extracted.fileName, settings }, extracted.fileEvidence);
  } catch (error) {
    response.status(400).json({ error: error instanceof Error ? error.message : "Не вдалося запустити файлову перевірку." });
  }
});

app.post("/api/ai-opinion", scanLimiter, async (request, response) => {
  try {
    const body = LlmOpinionRequestSchema.parse(request.body);
    if (!(await canUpdateOpinion(request, response, body.reportId))) return;
    const text = prepareDocumentText(body.text).text;
    const wordCount = countWords(text);
    if (wordCount < 25) {
      response.status(400).json({ error: "Додайте щонайменше 25 слів тексту для AI-думки." });
      return;
    }

    const opinion = await assessmentService.assess(text, {
      probability: Number(body.localProbability) || 0,
      signals: Array.isArray(body.localSignals) ? body.localSignals : [],
      suspiciousExcerpts: Array.isArray(body.suspiciousExcerpts) ? body.suspiciousExcerpts : []
    });

    if (!opinion) {
      response.status(400).json({ error: "API-ключ або список AI-моделей не налаштовано." });
      return;
    }

    await persistLlmOpinion(body.reportId, opinion, request.user?.id);
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
    const reportId =
      typeof request.body.reportId === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(request.body.reportId)
        ? request.body.reportId
        : undefined;
    if (!(await canUpdateOpinion(request, response, reportId))) return;
    const opinion = await assessmentService.assess(text, {
      probability: Number(request.body.localProbability) || 0,
      signals: Array.isArray(localSignals) ? localSignals : [],
      suspiciousExcerpts: Array.isArray(rawExcerpts) ? rawExcerpts.filter((item): item is string => typeof item === "string").slice(0, 8) : []
    });

    if (!opinion) {
      response.status(400).json({ error: "API-ключ або список AI-моделей не налаштовано." });
      return;
    }

    await persistLlmOpinion(reportId, opinion, request.user?.id);
    response.json(opinion);
  } catch (error) {
    response.status(502).json({ error: error instanceof Error ? error.message : "AI-думка для файлу недоступна." });
  }
});

app.use(humanizationRouter);

// Serve frontend in production (Docker / Local deployment)
if (process.env.NODE_ENV === "production" && !process.env.VERCEL) {
  const path = await import("path");
  const { fileURLToPath } = await import("url");
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const distPath = path.resolve(__dirname, "../../../../dist");

  app.use(express.static(distPath));

  // SPA fallback
  app.use((req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
}
