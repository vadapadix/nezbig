import { prepareAiAnalysisText } from "../../domain/analysis/aiTextPreprocess.js";
import type { AiSignal } from "../../../shared/types/index.js";

import type { AuthorshipSignals } from "../../domain/analysis/types/AiAssessment.js";
export type { LocalAiResult, AuthorshipSignals } from "../../domain/analysis/types/AiAssessment.js";
export const MAX_ANALYSIS_CHARS = 6000;

export const AUTHORSHIP_NEUTRALITY_PROMPT =
  "The presence or absence of citations, URLs, bibliography, tables, figures, or domain terminology is neutral for authorship. AI can generate citations and humans can write without sources. Never raise or lower the authorship score because these are present or missing. Evaluate only the supplied prose and concrete linguistic evidence. The local score is an uncalibrated heuristic, not ground truth. Do not claim that any stylistic feature proves human or AI authorship; state uncertainty and limitations.";
const GENRE_NEUTRALITY_PROMPT =
  "Headings, lists, numeric facts, first-person pronouns, passive or impersonal academic voice, standard research aims, simple punctuation, spelling mistakes and ordinary refusals such as 'I cannot' are not authorship evidence. Do not infer human authorship from errors or emotional phrasing, or AI authorship from polished grammar or their absence. Short or unsupported-language samples require uncertainty, not a confident verdict. Never treat multiple correlated rhythm or vocabulary measurements as independent corroboration.";

const HEAD_CHARS = 2800;
const TAIL_CHARS = 1400;
const MAX_SUSPICIOUS_EXCERPTS = 3;

export const JSON_SHAPE_PROMPT = `${GENRE_NEUTRALITY_PROMPT}
Return JSON with this exact shape:
{
  "probability": 0-100,
  "verdict": "обережний висновок українською мовою (1-2 речення: які мовні ознаки виявлено та чому вони не доводять авторство; наявність або відсутність джерел не є доказом)",
  "signals": [
    { "label": "коротка назва сигналу", "score": 0-100, "detail": "одне речення з поясненням сигналу", "evidence": ["коротка цитата або приклад"] }
  ]
}`;

export function asScore(value: unknown): number {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(100, Math.round(number)));
}

export function extractJsonObject(content: string): unknown {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced?.[1] ?? content;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Model returned no JSON object.");
  }

  const jsonSubstring = raw.slice(start, end + 1);
  try {
    return JSON.parse(jsonSubstring);
  } catch {
    const cleaned = jsonSubstring.replace(/,\s*([}\]])/g, "$1");
    return JSON.parse(cleaned);
  }
}

export function withTimeout(ms: number): AbortSignal {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms).unref();
  return controller.signal;
}

export function buildAnalysisSample(text: string, suspiciousExcerpts: string[] = []): string {
  const normalized = prepareAiAnalysisText(text).text;
  if (normalized.length <= MAX_ANALYSIS_CHARS) return normalized;

  const head = normalized.slice(0, HEAD_CHARS);
  const tail = normalized.slice(-TAIL_CHARS);
  const excerptBudget = Math.max(480, MAX_ANALYSIS_CHARS - head.length - tail.length - 160);
  const perExcerpt = Math.floor(excerptBudget / MAX_SUSPICIOUS_EXCERPTS);
  const picked = suspiciousExcerpts.slice(0, MAX_SUSPICIOUS_EXCERPTS).map((excerpt, index) => `[${index + 1}] ${prepareAiAnalysisText(excerpt).text.slice(0, perExcerpt)}`);

  return [
    "=== ПОЧАТОК ДОКУМЕНТА ===",
    head,
    "",
    "=== КІНЕЦЬ ДОКУМЕНТА ===",
    tail,
    picked.length > 0 ? "\n=== НАЙПІДОЗРІЛІШІ ФРАГМЕНТИ (за локальною евристикою) ===" : "",
    ...picked,
    "\nДокумент довший за цю вибірку. Оцінюй лише представлений матеріал і зазначай у деталях, що покриття обмежене."
  ]
    .filter(Boolean)
    .join("\n");
}

export function parseAuthorshipResult(content: string, fallbackLabel: string, emptyDetail: string): AuthorshipSignals {
  const parsed = extractJsonObject(content) as Record<string, unknown>;
  const rawProb = parsed.probability ?? parsed.ai_probability ?? parsed.aiProbability ?? parsed.score;
  const probability = asScore(rawProb);

  const rawSignals = Array.isArray(parsed.signals) ? parsed.signals : [];
  const signals: AiSignal[] = rawSignals.slice(0, 6).map((signal: Record<string, unknown>): AiSignal => ({
    label: String(signal.label || fallbackLabel).slice(0, 80),
    score: asScore(signal.score),
    detail: String(signal.detail || emptyDetail).slice(0, 280),
    category: "pattern",
    evidence: Array.isArray(signal.evidence) ? (signal.evidence as unknown[]).map((item) => String(item).slice(0, 140)).slice(0, 4) : []
  }));

  const rawVerdict =
    typeof parsed.verdict === "string"
      ? parsed.verdict
      : typeof parsed.explanation === "string"
        ? parsed.explanation
        : typeof parsed.summary === "string"
          ? parsed.summary
          : undefined;
  const verdict = rawVerdict?.trim().slice(0, 500);

  if (signals.length === 0) {
    signals.push({
      label: fallbackLabel,
      score: probability,
      detail: emptyDetail,
      category: "pattern"
    });
  }

  return { probability, signals, verdict };
}
